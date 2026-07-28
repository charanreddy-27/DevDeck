import test from 'node:test';
import assert from 'node:assert/strict';

import { parseEvents, parseLogLines } from '../lib/logs.js';

const ESC = String.fromCharCode(27);

test('parseEvents reads a plain JSON array', () => {
  const events = parseEvents(JSON.stringify([{ payload: { text: 'one' } }, { payload: { text: 'two' } }]));
  assert.equal(events.length, 2);
});

test('parseEvents reads newline-delimited JSON', () => {
  const body = ['{"payload":{"text":"one"}}', '{"payload":{"text":"two"}}'].join('\n');
  assert.equal(parseEvents(body).length, 2);
});

test('parseEvents strips SSE data prefixes and DONE sentinels', () => {
  const body = ['data: {"payload":{"text":"one"}}', 'data: [DONE]'].join('\n');
  const events = parseEvents(body);
  assert.equal(events.length, 1);
  assert.equal(events[0].payload.text, 'one');
});

test('parseEvents keeps unparseable lines as raw text', () => {
  const body = ['{"payload":{"text":"good"}}', 'a bare log line'].join('\n');
  const events = parseEvents(body);
  assert.equal(events.length, 2);
  assert.equal(events[1].payload.text, 'a bare log line');
});

test('parseEvents handles empty and whitespace bodies', () => {
  assert.deepEqual(parseEvents(''), []);
  assert.deepEqual(parseEvents('   \n  '), []);
  assert.deepEqual(parseEvents(null), []);
});

test('parseLogLines strips ANSI colour codes but keeps literal brackets', () => {
  const body = JSON.stringify([
    { payload: { text: `${ESC}[32mBuild succeeded${ESC}[0m` } },
    { payload: { text: 'branch [main] is up to date' } },
  ]);

  const lines = parseLogLines(body);
  assert.equal(lines[0].text, 'Build succeeded');
  // A regex without the ESC anchor would eat "[m" here — guard against that.
  assert.equal(lines[1].text, 'branch [main] is up to date');
});

test('parseLogLines classifies error and warning lines', () => {
  const body = JSON.stringify([
    { payload: { text: 'Compiled successfully' } },
    { payload: { text: 'Error: cannot find module foo' } },
    { payload: { text: 'warning: deprecated API' } },
    { type: 'stderr', payload: { text: 'something on stderr' } },
  ]);

  const lines = parseLogLines(body);
  assert.equal(lines[0].level, 'info');
  assert.equal(lines[1].level, 'error');
  assert.equal(lines[2].level, 'warn');
  assert.equal(lines[3].level, 'error');
});

test('parseLogLines drops blank lines and trims trailing carriage returns', () => {
  const body = JSON.stringify([
    { payload: { text: '   ' } },
    { payload: { text: '' } },
    { payload: { text: 'real line\r' } },
  ]);

  const lines = parseLogLines(body);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].text, 'real line');
});

test('parseLogLines keeps the newest lines when over the cap', () => {
  const body = JSON.stringify(
    Array.from({ length: 50 }, (_, index) => ({ payload: { text: `line ${index}` } })),
  );

  const lines = parseLogLines(body, 10);
  assert.equal(lines.length, 10);
  assert.equal(lines[0].text, 'line 40');
  assert.equal(lines[9].text, 'line 49');
});

test('parseLogLines gives every line a unique key', () => {
  const body = JSON.stringify(Array.from({ length: 20 }, () => ({ payload: { text: 'same text' } })));
  const lines = parseLogLines(body);
  assert.equal(new Set(lines.map((line) => line.id)).size, lines.length);
});

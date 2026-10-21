/**
 * Line diff for "review before you commit". Pure, so it is tested directly.
 *
 * Myers' O(ND) algorithm, after trimming the common prefix and suffix — a
 * one-line edit in a 5,000-line file costs almost nothing. Edits that touch
 * more than MAX_EDIT_DISTANCE lines bail out with `tooLarge` rather than
 * spending seconds and megabytes on a diff nobody will read line by line.
 */

export const MAX_EDIT_DISTANCE = 2000;

export function splitLines(text) {
  const value = String(text ?? '');
  if (value === '') return [];
  const lines = value.split('\n');
  // A trailing newline ends the last line; it does not start an empty one.
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function myers(a, b) {
  const n = a.length;
  const m = b.length;
  if (n === 0) return b.map((line) => ({ type: 'add', line }));
  if (m === 0) return a.map((line) => ({ type: 'del', line }));

  const max = n + m;
  const offset = max;
  const v = new Int32Array(2 * max + 2);
  const trace = [];

  for (let d = 0; d <= max; d += 1) {
    if (d > MAX_EDIT_DISTANCE) return null;
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x =
        k === -d || (k !== d && v[k - 1 + offset] < v[k + 1 + offset]) ? v[k + 1 + offset] : v[k - 1 + offset] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      v[k + offset] = x;
      if (x >= n && y >= m) return backtrack(trace, a, b, offset);
    }
  }
  return null;
}

function backtrack(trace, a, b, offset) {
  const ops = [];
  let x = a.length;
  let y = b.length;
  for (let d = trace.length - 1; d >= 0; d -= 1) {
    const v = trace[d];
    const k = x - y;
    const prevK = k === -d || (k !== d && v[k - 1 + offset] < v[k + 1 + offset]) ? k + 1 : k - 1;
    const prevX = v[prevK + offset];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push({ type: 'eq', line: a[x - 1] });
      x -= 1;
      y -= 1;
    }
    if (d > 0) {
      if (x === prevX) ops.push({ type: 'add', line: b[y - 1] });
      else ops.push({ type: 'del', line: a[x - 1] });
    }
    x = prevX;
    y = prevY;
  }
  return ops.reverse();
}

/**
 * @returns {{ ops: Array<{type: 'eq'|'add'|'del', line: string}>|null, added: number, removed: number, tooLarge: boolean }}
 */
export function diffLines(before, after) {
  const a = splitLines(before);
  const b = splitLines(after);

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  const middle = myers(a.slice(start, endA), b.slice(start, endB));
  if (middle === null) {
    return { ops: null, added: endB - start, removed: endA - start, tooLarge: true };
  }

  const ops = [
    ...a.slice(0, start).map((line) => ({ type: 'eq', line })),
    ...middle,
    ...a.slice(endA).map((line) => ({ type: 'eq', line })),
  ];
  let added = 0;
  let removed = 0;
  for (const op of ops) {
    if (op.type === 'add') added += 1;
    else if (op.type === 'del') removed += 1;
  }
  return { ops, added, removed, tooLarge: false };
}

/**
 * Groups ops into unified-diff hunks with `context` unchanged lines around
 * each change; nearby changes share a hunk instead of repeating context.
 */
export function toHunks(ops, context = 3) {
  if (!ops) return [];
  const rows = [];
  let oldNo = 1;
  let newNo = 1;
  for (const op of ops) {
    rows.push({
      type: op.type,
      text: op.line,
      oldNo: op.type === 'add' ? null : oldNo,
      newNo: op.type === 'del' ? null : newNo,
    });
    if (op.type !== 'add') oldNo += 1;
    if (op.type !== 'del') newNo += 1;
  }

  const changed = rows.map((row, index) => (row.type === 'eq' ? -1 : index)).filter((index) => index >= 0);
  if (!changed.length) return [];

  const hunks = [];
  let from = Math.max(0, changed[0] - context);
  let to = Math.min(rows.length - 1, changed[0] + context);
  for (const index of changed.slice(1)) {
    if (index - context <= to + 1) {
      to = Math.min(rows.length - 1, index + context);
    } else {
      hunks.push(rows.slice(from, to + 1));
      from = Math.max(0, index - context);
      to = Math.min(rows.length - 1, index + context);
    }
  }
  hunks.push(rows.slice(from, to + 1));

  return hunks.map((lines) => {
    const firstOld = lines.find((row) => row.oldNo !== null);
    const firstNew = lines.find((row) => row.newNo !== null);
    return {
      oldStart: firstOld ? firstOld.oldNo : 0,
      oldLines: lines.filter((row) => row.type !== 'add').length,
      newStart: firstNew ? firstNew.newNo : 0,
      newLines: lines.filter((row) => row.type !== 'del').length,
      lines,
    };
  });
}

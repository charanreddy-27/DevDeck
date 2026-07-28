/**
 * Vercel's build-event endpoint answers with either a JSON array or
 * newline-delimited JSON depending on the deployment's state, and the text is
 * frequently ANSI-coloured. Parsing lives here so it can be tested directly.
 */

// ANSI colour codes look like: ESC [ <numbers> <letter>. Built from a char code
// so no raw control byte lands in this source file.
const ESC = String.fromCharCode(27);
const ANSI = new RegExp(ESC + '\\[[0-9;]*[A-Za-z]', 'g');

const ERROR_PATTERN = /\b(error|failed|fatal|cannot find)\b/i;
const WARN_PATTERN = /\bwarn(ing)?\b/i;

export function parseEvents(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.events)) return parsed.events;
    return [parsed];
  } catch {
    /* fall through to newline-delimited JSON */
  }

  const events = [];
  for (const line of trimmed.split('\n')) {
    const candidate = line.trim().replace(/^data:\s*/, '');
    if (!candidate || candidate === '[DONE]') continue;
    try {
      events.push(JSON.parse(candidate));
    } catch {
      // A non-JSON line is still worth showing as raw log output.
      events.push({ payload: { text: candidate } });
    }
  }
  return events;
}

export function toLogLine(event, index) {
  const raw = event?.payload?.text ?? event?.text ?? '';
  const text = String(raw).replace(ANSI, '').replace(/\r$/, '');
  if (!text.trim()) return null;

  const type = event?.type || 'stdout';
  const isError = type === 'stderr' || ERROR_PATTERN.test(text);

  return {
    id: `${event?.id || index}-${index}`,
    created: event?.created ?? event?.date ?? null,
    type,
    level: isError ? 'error' : WARN_PATTERN.test(text) ? 'warn' : 'info',
    text,
  };
}

/** Full pipeline: raw response body -> renderable log lines, newest kept. */
export function parseLogLines(text, maxLines = 3000) {
  return parseEvents(text)
    .flatMap((event, index) => {
      const line = toLogLine(event, index);
      return line ? [line] : [];
    })
    .slice(-maxLines);
}

/** Display helpers shared by the client components. */

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const UNITS = [
  { limit: 60, divisor: 1, unit: 's' },
  { limit: 3600, divisor: 60, unit: 'm' },
  { limit: 86400, divisor: 3600, unit: 'h' },
  { limit: 2592000, divisor: 86400, unit: 'd' },
  { limit: 31536000, divisor: 2592000, unit: 'mo' },
];

/** "2h ago" / "just now" / "in 3m". Accepts epoch ms, ISO string, or Date. */
export function relativeTime(value) {
  const ms = toMs(value);
  if (ms == null) return '—';

  const seconds = Math.round((Date.now() - ms) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 10) return 'just now';

  for (const { limit, divisor, unit } of UNITS) {
    if (abs < limit) {
      const amount = Math.floor(abs / divisor);
      return seconds >= 0 ? `${amount}${unit} ago` : `in ${amount}${unit}`;
    }
  }
  const years = Math.floor(abs / 31536000);
  return seconds >= 0 ? `${years}y ago` : `in ${years}y`;
}

export function absoluteTime(value) {
  const ms = toMs(value);
  if (ms == null) return '';
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function clockTime(value) {
  const ms = toMs(value);
  if (ms == null) return '';
  return new Date(ms).toLocaleTimeString(undefined, { hour12: false });
}

export function formatDuration(ms) {
  if (!ms || ms < 0) return null;
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function formatBytes(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function shortSha(sha) {
  return sha ? String(sha).slice(0, 7) : '';
}

export function hostOf(url) {
  if (!url) return '';
  try {
    return new URL(url).host;
  } catch {
    return String(url).replace(/^https?:\/\//, '');
  }
}

/** Derives the Vercel dashboard URL for a project from a deployment inspector URL. */
export function vercelProjectUrl(inspectorUrl) {
  if (!inspectorUrl) return null;
  try {
    const url = new URL(inspectorUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) return `${url.origin}/${parts[0]}/${parts[1]}`;
  } catch {
    /* ignore */
  }
  return null;
}

function toMs(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

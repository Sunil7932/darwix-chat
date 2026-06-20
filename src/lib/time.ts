/**
 * Time-formatting helpers.
 *
 * `Intl` formatters are comparatively expensive to construct, so we memoise a
 * single instance of each and reuse it for every message render.
 */

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

const fullFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
});

/** Short clock time, e.g. "4:08 PM" — shown inline next to each message. */
export function formatClockTime(epochMs: number): string {
  return timeFormatter.format(epochMs);
}

/** Full, unambiguous timestamp — revealed on hover / as a tooltip. */
export function formatFullTimestamp(epochMs: number): string {
  return fullFormatter.format(epochMs);
}

/** Machine-readable ISO string for the `<time dateTime>` attribute. */
export function toIso(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

/**
 * Concise, human-friendly relative time, e.g. "just now", "3 min ago", "2 h ago".
 * Returns the calendar date once an item is older than a day.
 */
export function formatRelativeTime(epochMs: number, now: number = Date.now()): string {
  const diffSeconds = Math.round((now - epochMs) / 1000);

  if (diffSeconds < 5) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h ago`;

  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    epochMs,
  );
}

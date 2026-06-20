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

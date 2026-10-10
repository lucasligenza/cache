const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function span(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.floor(ms / MIN))}m`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h`;
  if (ms < 30 * DAY) return `${Math.floor(ms / DAY)}d`;
  if (ms < 365 * DAY) return `${Math.floor(ms / (30 * DAY))}mo`;
  return `${Math.floor(ms / (365 * DAY))}y`;
}

/** Compact relative time for dense rows: `now`, `5m ago`, `in 3h`, `2mo ago`. */
export function shortTime(iso: string, now: number = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  if (Math.abs(diff) < MIN) return 'now';
  return diff > 0 ? `in ${span(diff)}` : `${span(-diff)} ago`;
}

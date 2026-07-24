// Pure, runtime-agnostic reminder logic — no Deno/esm imports, so it runs under
// both the Deno edge function (index.ts) and the Vitest suite. This is the
// business-critical "what fires, and once" rule; keep it dependency-free.

export interface ReminderRow {
  id: string;
  text: string;
  user_id: string;
  remind_at: string;
  reminded_at: string | null;
}

/**
 * The set of reminders that should fire now: past-due (`remind_at <= now`) AND
 * not already sent for their current `remind_at`. A note is "already sent" when
 * `reminded_at >= remind_at`; rescheduling to a later `remind_at` makes the old
 * `reminded_at` stale, which re-arms the reminder. The edge function's SQL query
 * already applies the `remind_at <= now` cutoff — re-checking it here keeps the
 * rule complete and testable in one place (the query stays a pre-filter).
 */
export function selectDue<T extends ReminderRow>(rows: T[], nowIso: string): T[] {
  const now = new Date(nowIso).getTime();
  return rows.filter(n => {
    if (new Date(n.remind_at).getTime() > now) return false;
    return !n.reminded_at || new Date(n.reminded_at).getTime() < new Date(n.remind_at).getTime();
  });
}

/** The web-push notification payload for a due reminder (body capped at 100 chars). */
export function reminderPayload(note: Pick<ReminderRow, 'text'>): string {
  return JSON.stringify({ title: 'cache reminder', body: note.text.slice(0, 100) });
}

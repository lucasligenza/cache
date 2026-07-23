import type { Note } from '../types';

// A note is "stale" once it has sat unsorted in the buffer this long.
export const STALE_DAYS = 3;
// After a stale/flagged note is "kept", suppress it from review for this long.
export const REVIEW_SUPPRESS_DAYS = 7;
// A note becomes eligible to resurface once untouched this long.
export const RESURFACE_DAYS = 21;
export const STALE_CAP = 5;
export const RESURFACE_CAP = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReviewBucketKey = 'overdue' | 'flagged' | 'stale' | 'resurfaced';

export interface ReviewBucket {
  key: ReviewBucketKey;
  notes: Note[];
}

export interface ReviewSet {
  buckets: ReviewBucket[]; // only non-empty buckets, in priority order
  count: number;           // badge = everything in review (incl. resurfaced) — never lies
  actionable: number;      // the urgent subset (overdue + flagged + stale) for header wording
}

function ageDays(iso: string, now: number): number {
  return (now - new Date(iso).getTime()) / DAY_MS;
}

// Most recent of "edited" or "reviewed" — how long since the note was engaged.
function lastTouch(n: Note): number {
  const u = new Date(n.updated_at).getTime();
  const r = n.reviewed_at ? new Date(n.reviewed_at).getTime() : 0;
  return Math.max(u, r);
}

function reviewedWithin(n: Note, now: number, days: number): boolean {
  if (!n.reviewed_at) return false;
  return now - new Date(n.reviewed_at).getTime() < days * DAY_MS;
}

/**
 * Assemble the review triage set. Each note lands in at most one bucket
 * (highest priority wins), so the total is naturally bounded.
 */
export function buildReviewSet(notes: Note[], now: number): ReviewSet {
  const used = new Set<string>();

  const overdue = notes
    .filter(n => n.remind_at && new Date(n.remind_at).getTime() < now)
    .sort((a, b) => new Date(a.remind_at!).getTime() - new Date(b.remind_at!).getTime());
  overdue.forEach(n => used.add(n.id));

  const flagged = notes.filter(n => !used.has(n.id) && n.pending_review);
  flagged.forEach(n => used.add(n.id));

  const stale = notes
    .filter(n =>
      !used.has(n.id) &&
      n.category_id === null &&
      ageDays(n.created_at, now) >= STALE_DAYS &&
      !reviewedWithin(n, now, REVIEW_SUPPRESS_DAYS)
    )
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(0, STALE_CAP);
  stale.forEach(n => used.add(n.id));

  const resurfaced = notes
    .filter(n =>
      !used.has(n.id) &&
      now - lastTouch(n) >= RESURFACE_DAYS * DAY_MS &&
      !reviewedWithin(n, now, RESURFACE_DAYS)
    )
    .sort((a, b) => lastTouch(a) - lastTouch(b))
    .slice(0, RESURFACE_CAP);
  resurfaced.forEach(n => used.add(n.id));

  const rawBuckets: ReviewBucket[] = [
    { key: 'overdue', notes: overdue },
    { key: 'flagged', notes: flagged },
    { key: 'stale', notes: stale },
    { key: 'resurfaced', notes: resurfaced },
  ];

  return {
    buckets: rawBuckets.filter(b => b.notes.length > 0),
    count: overdue.length + flagged.length + stale.length + resurfaced.length,
    actionable: overdue.length + flagged.length + stale.length,
  };
}

/** Count notes reviewed today (for the "cleared N today" empty-state reward). */
export function countReviewedToday(notes: Note[], now: number): number {
  const d = new Date(now);
  return notes.filter(n => {
    if (!n.reviewed_at) return false;
    const r = new Date(n.reviewed_at);
    return r.getFullYear() === d.getFullYear() && r.getMonth() === d.getMonth() && r.getDate() === d.getDate();
  }).length;
}

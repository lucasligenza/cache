// Guest (anonymous) sessions can't be signed back into, so every note on one is
// a note at risk. Nudge the guest to create an account as their cache grows —
// once per threshold, never on every capture.

export const GUEST_NUDGE_THRESHOLDS = [10, 25, 50, 100, 250] as const;

/**
 * The threshold to nudge at now, or null. `lastNudged` is the threshold most
 * recently shown (0 if never). A guest who arrives already past several
 * thresholds gets a single nudge for the highest one reached.
 */
export function guestNudgeDue(noteCount: number, lastNudged: number): number | null {
  let reached = 0;
  for (const t of GUEST_NUDGE_THRESHOLDS) {
    if (noteCount >= t) reached = t;
  }
  return reached > lastNudged ? reached : null;
}

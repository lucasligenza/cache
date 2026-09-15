import type { Category } from '@cache/core';

export type CaptureResolve =
  | { ok: true; text: string; categoryId?: string; warning?: string }
  | { ok: false; hint: string };

/**
 * Resolve typed capture into inbox semantics.
 *
 * Saving a thought files it to the buffer (or an explicit category) and never
 * arms reviews, reminders, or todo/work workflows — those stay opt-in elsewhere.
 *
 * Slash-routing matches web CaptureBar:
 *  - `/dir body` → that category
 *  - `/dir` with no body → hint, don't commit
 *  - unknown `/dir` → file verbatim to buffer
 */
export function resolveCaptureInput(
  raw: string,
  categories: Category[],
  selectedCategoryId: string | null,
): CaptureResolve {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, hint: 'type a note first' };

  const m = trimmed.match(/^\/(\S+)(?:\s+([\s\S]*))?$/);
  if (m) {
    const cat = categories.find(c => c.name.toLowerCase() === m[1].toLowerCase());
    if (cat) {
      const routed = (m[2] ?? '').trim();
      if (!routed) {
        return { ok: false, hint: `add a note after /${cat.name.toLowerCase()}` };
      }
      return { ok: true, text: routed, categoryId: cat.id };
    }
    return {
      ok: true,
      text: trimmed,
      categoryId: undefined,
      warning: `no category '${m[1]}' — filed to buffer`,
    };
  }

  return {
    ok: true,
    text: trimmed,
    categoryId: selectedCategoryId ?? undefined,
  };
}

/**
 * Bottom inset for a keyboard-docked composer.
 * When the software keyboard is up it already covers the home indicator, so we
 * must not add safe-area bottom on top of keyboard height (that jumps Save
 * above the thumb zone / leaves a gap). When the keyboard is down, use the
 * home-indicator inset — unless a parent (tab bar) already reserved it.
 */
export function composerBottomInset(
  keyboardHeight: number,
  safeAreaBottom: number,
  parentReservesSafeBottom = false,
): number {
  if (keyboardHeight > 0) return keyboardHeight;
  if (parentReservesSafeBottom) return 0;
  return Math.max(0, safeAreaBottom);
}

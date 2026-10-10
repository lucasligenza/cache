import { parseSlashRoute, type Category } from '@cache/core';

export type CaptureResolve =
  | { ok: true; text: string; categoryId?: string; warning?: string }
  | { ok: false; hint: string };

/**
 * Resolve typed capture into inbox semantics.
 *
 * Saving a thought files it to the buffer (or an explicit category) and never
 * arms reviews, reminders, or todo/work workflows — those stay opt-in elsewhere.
 *
 * Slash-routing matches web CaptureBar (both use `parseSlashRoute` from core):
 *  - `/dir body` → that category (multi-word names and slugs: `/date ideas`, `/date-ideas`)
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

  const route = parseSlashRoute(trimmed, categories);
  if (route.kind === 'match') {
    if (!route.body) {
      return { ok: false, hint: `add a note after /${route.category.name.toLowerCase()}` };
    }
    return { ok: true, text: route.body, categoryId: route.category.id };
  }
  if (route.kind === 'unknown') {
    return {
      ok: true,
      text: trimmed,
      categoryId: undefined,
      warning: `no category '${route.token}' — filed to buffer`,
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

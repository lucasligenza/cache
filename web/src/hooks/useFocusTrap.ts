import { useEffect } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE = 'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';

/**
 * When `active`, keeps keyboard focus inside `ref` (Tab/Shift+Tab cycle),
 * focuses the first focusable element on open, and restores focus to whatever
 * was focused before, on close/unmount.
 */
export function useFocusTrap(ref: RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    const prevFocused = document.activeElement as HTMLElement | null;

    const items = () =>
      container
        ? Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => !el.hasAttribute('disabled'))
        : [];

    items()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = items();
      if (list.length === 0) { e.preventDefault(); return; }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    container?.addEventListener('keydown', onKeyDown);
    return () => {
      container?.removeEventListener('keydown', onKeyDown);
      prevFocused?.focus?.();
    };
  }, [ref, active]);
}

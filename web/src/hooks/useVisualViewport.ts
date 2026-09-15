import { useLayoutEffect } from 'react';

/** Software keyboards are typically 250–350px; browser chrome is much smaller. */
export const KEYBOARD_THRESHOLD_PX = 120;

function viewportHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight;
}

function viewportOffsetTop(): number {
  return window.visualViewport?.offsetTop ?? 0;
}

/**
 * Pin the app chrome to the *visual* viewport.
 *
 * iOS Safari / Home Screen PWAs do not shrink `100vh` (or `window.innerHeight`)
 * when the software keyboard opens. They shrink `window.visualViewport` instead
 * and often pan the focused field, which jumps a `height: 100vh` flex shell and
 * can bury the capture bar under the keyboard.
 *
 * Writes `--vv-height` / `--vv-offset-top` on <html> and sets `data-keyboard="open"`
 * so CSS can sit the shell in the visible area and drop BottomNav while typing.
 *
 * Keyboard-open is inferred from the visual viewport vs. the last idle height
 * (not from input focus): tapping Save blurs the field before the keyboard
 * closes, and hiding the nav on that blur would yank Save out from under the thumb.
 */
export function useVisualViewport(): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    let idleHeight = viewportHeight();

    const apply = () => {
      const height = viewportHeight();
      const offsetTop = viewportOffsetTop();
      root.style.setProperty('--vv-height', `${height}px`);
      root.style.setProperty('--vv-offset-top', `${offsetTop}px`);

      const keyboardOpen =
        idleHeight - height > KEYBOARD_THRESHOLD_PX || offsetTop > KEYBOARD_THRESHOLD_PX;

      if (keyboardOpen) {
        root.setAttribute('data-keyboard', 'open');
      } else {
        root.removeAttribute('data-keyboard');
        idleHeight = height;
      }
    };

    const onOrientation = () => {
      idleHeight = viewportHeight();
      apply();
    };

    apply();

    const vv = window.visualViewport;
    vv?.addEventListener('resize', apply);
    vv?.addEventListener('scroll', apply);
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', onOrientation);

    return () => {
      vv?.removeEventListener('resize', apply);
      vv?.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', onOrientation);
      root.style.removeProperty('--vv-height');
      root.style.removeProperty('--vv-offset-top');
      root.removeAttribute('data-keyboard');
    };
  }, []);
}

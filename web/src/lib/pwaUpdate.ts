// Keeps installed PWAs on the latest deploy.
//
// The service worker skips waiting and claims clients (sw.ts), so a new deploy
// takes control as soon as it's found. Two things are left to the page:
//  1. Finding it. iOS home-screen apps resume from memory without navigating,
//     so the browser's own update check rarely runs — check on every return to
//     the foreground (throttled), on reconnect, and hourly.
//  2. Reloading onto it without eating a half-typed note: only while the app
//     is in the background, and never while any text field holds text (the
//     note isn't in the outbox until it's committed).

export const MIN_CHECK_GAP_MS = 5 * 60_000;
export const PERIODIC_CHECK_MS = 60 * 60_000;

export function hasUnsentText(root: ParentNode = document): boolean {
  const fields = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'textarea, input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"]'
  );
  return Array.from(fields).some(f => f.value.trim() !== '');
}

interface ReloadDeps {
  reload: () => void;
  isHidden: () => boolean;
  hasUnsentText: () => boolean;
  target: Pick<Document, 'addEventListener'>;
}

/** Defers a reload until the page is backgrounded with nothing unsent. */
export function createReloadScheduler(deps: ReloadDeps) {
  let pending = false;
  const attempt = () => {
    if (!pending || !deps.isHidden() || deps.hasUnsentText()) return;
    pending = false;
    deps.reload();
  };
  deps.target.addEventListener('visibilitychange', attempt);
  return {
    request() {
      pending = true;
      attempt();
    },
    isPending: () => pending,
  };
}

/** Throttled wrapper around `registration.update()`; never throws. */
export function createUpdateChecker(update: () => Promise<unknown>, now: () => number = Date.now) {
  let last = -Infinity;
  return () => {
    const t = now();
    if (t - last < MIN_CHECK_GAP_MS) return;
    last = t;
    update().catch(() => {
      /* offline or SW script fetch failed — try again next time */
    });
  };
}

export async function startPwa(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const { registerSW } = await import('virtual:pwa-register');

  const scheduler = createReloadScheduler({
    reload: () => window.location.reload(),
    isHidden: () => document.visibilityState === 'hidden',
    hasUnsentText: () => hasUnsentText(),
    target: document,
  });

  registerSW({
    immediate: true,
    onNeedReload: () => scheduler.request(),
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = createUpdateChecker(() => registration.update());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      window.addEventListener('online', check);
      window.setInterval(check, PERIODIC_CHECK_MS);
    },
  });
}

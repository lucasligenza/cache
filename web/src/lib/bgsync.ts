// Best-effort background flush of the offline outbox.
//
// A service worker can't read the outbox (localStorage) or the Supabase session,
// so it can't sync notes itself. Instead the page asks the SW to register a
// one-off Background Sync; when connectivity returns the browser fires a `sync`
// event — even for a backgrounded/suspended tab — and the SW postMessages the
// page (see web/src/sw.ts) to run the existing flushOutbox(). If the app is
// fully closed there's no page to message, so the flush happens on next open,
// exactly as it does today.

/** Shared between registerOutboxSync (page), the SW `sync` handler, and App's message listener. */
export const SYNC_TAG = 'cn-flush';

/**
 * Ask the service worker to fire `SYNC_TAG` once connectivity is available.
 * Feature-detected and error-swallowing — resolves `true` only when a sync was
 * actually registered, `false` (never throws) otherwise. Safe to call on every
 * offline capture.
 */
export async function registerOutboxSync(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return false;
  try {
    const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      sync: { register(tag: string): Promise<void> };
    };
    await reg.sync.register(SYNC_TAG);
    return true;
  } catch {
    return false;
  }
}

import { supabase } from './supabase';
import { clearOutboxFor } from './outbox';
import { runAccountDeletion } from './deleteAccount';

const PUSH_TEARDOWN_MS = 3000;

async function dropDevicePush(): Promise<void> {
  // getRegistration (not .ready) so a browser with no service worker doesn't hang.
  // Unsubscribe talks to the push service; cap it so a slow network can't block deletion.
  const work = async () => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    if (sub) await sub.unsubscribe();
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>(resolve => { timer = setTimeout(resolve, PUSH_TEARDOWN_MS); });
  try {
    await Promise.race([work().catch(() => undefined), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Delete the signed-in account on the server, then this browser's copy of it. */
export function deleteMyAccount(userId: string): Promise<{ error: string | null }> {
  return runAccountDeletion(userId, {
    async invoke() {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        method: 'POST',
        body: {},
      });
      return { data, error };
    },
    dropDevicePush,
    clearLocal(id) {
      try { clearOutboxFor(id); } catch { /* storage unavailable */ }
      try { localStorage.removeItem(`cn_guest_nudge:${id}`); } catch { /* storage unavailable */ }
    },
    async signOutLocal() {
      // The auth user is already gone, so don't wait on a server revoke.
      await supabase.auth.signOut({ scope: 'local' });
    },
  });
}

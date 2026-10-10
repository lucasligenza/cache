import { useEffect } from 'react';
import { useAuthCore, recoveryRedirectUrl, RECOVERY_REDIRECT_VALUE } from '@cache/core';
import { initialAuthRedirect, cleanAuthRedirectUrl } from '../lib/authRedirect';
import { supabase } from '../lib/supabase';
import { unsubscribeFromPush } from '../lib/push';

// Only touch push when this browser actually holds a subscription — otherwise
// `serviceWorker.ready` can hang (no SW in dev) and the delete would hit rows
// belonging to the user's other devices.
async function dropDevicePush(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager?.getSubscription();
  if (sub) await unsubscribeFromPush();
}

// Auth lives in @cache/core (shared with native). Web injects its client, the
// reset redirect, the launch-URL recovery flag, and push teardown on sign-out.
export function useAuth() {
  const auth = useAuthCore({
    supabase,
    passwordResetRedirectTo: recoveryRedirectUrl(window.location.origin),
    initialRecovery: initialAuthRedirect.type === RECOVERY_REDIRECT_VALUE && !initialAuthRedirect.error,
    beforeSignOut: dropDevicePush,
  });

  // Once the session has resolved, supabase-js has consumed any tokens in the URL.
  useEffect(() => {
    if (!auth.loading) cleanAuthRedirectUrl();
  }, [auth.loading]);

  return {
    ...auth,
    redirectError: initialAuthRedirect.error,
    redirectWasRecovery: initialAuthRedirect.type === RECOVERY_REDIRECT_VALUE,
  };
}

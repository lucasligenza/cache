import { supabase } from './supabase';

export type PushStatus = 'unavailable' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function vapidPublicKey(): string {
  return (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? '';
}

function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export const SW_READY_TIMEOUT_MS = 3000;

// `serviceWorker.ready` never settles when no service worker registers (dev
// without the SW, a failed registration, some private modes), so cap the wait.
async function readyRegistration(): Promise<ServiceWorkerRegistration | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>(resolve => {
    timer = setTimeout(() => resolve(null), SW_READY_TIMEOUT_MS);
  });
  try {
    return await Promise.race([navigator.serviceWorker.ready, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function subscribeToPush(): Promise<{ error: string | null }> {
  const vapidKey = vapidPublicKey();
  if (!vapidKey) {
    return { error: 'notifications are unavailable right now' };
  }
  if (!isPushSupported()) {
    return { error: 'Push notifications not supported in this browser' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { error: 'Notification permission denied' };
  }

  try {
    const reg = await readyRegistration();
    if (!reg) return { error: 'notifications are unavailable right now' };
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
    });

    const { endpoint } = subscription;
    const keys = subscription.toJSON().keys ?? {};

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    // One row per device endpoint; the RPC hands the endpoint to the current
    // user if another account subscribed on this browser before.
    const { error: dbError } = await supabase.rpc('register_push_subscription', {
      p_endpoint: endpoint,
      p_p256dh_key: keys.p256dh ?? '',
      p_auth_key: keys.auth ?? '',
    });

    if (dbError) return { error: dbError.message };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to subscribe' };
  }
}

/** Unsubscribes this device only; the user's other devices keep their reminders. */
export async function unsubscribeFromPush(): Promise<{ error: string | null }> {
  if (!isPushSupported()) return { error: null };
  try {
    const reg = await readyRegistration();
    if (!reg) return { error: null };
    const subscription = await reg.pushManager.getSubscription();
    if (!subscription) return { error: null };

    const { endpoint } = subscription;
    await subscription.unsubscribe();

    const { error: dbError } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    if (dbError) return { error: dbError.message };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to unsubscribe' };
  }
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!vapidPublicKey()) return 'unavailable';
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await readyRegistration();
  if (!reg) return 'unavailable';
  const subscription = await reg.pushManager.getSubscription();
  return subscription ? 'subscribed' : 'unsubscribed';
}

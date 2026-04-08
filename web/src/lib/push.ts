import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

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

export async function subscribeToPush(): Promise<{ error: string | null }> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { error: 'Push notifications not supported in this browser' };
  }
  if (!VAPID_PUBLIC_KEY) {
    return { error: 'VITE_VAPID_PUBLIC_KEY not set' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { error: 'Notification permission denied' };
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
    });

    const { endpoint } = subscription;
    const keys = subscription.toJSON().keys ?? {};

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    // Upsert: one subscription per user (replace on conflict)
    const { error: dbError } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh_key: keys.p256dh ?? '',
          auth_key: keys.auth ?? '',
        },
        { onConflict: 'user_id' }
      );

    if (dbError) return { error: dbError.message };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to subscribe' };
  }
}

export async function unsubscribeFromPush(): Promise<{ error: string | null }> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: null };

    await supabase.from('push_subscriptions').delete().eq('user_id', user.id);
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to unsubscribe' };
  }
}

export async function getPushStatus(): Promise<'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.getSubscription();
  return subscription ? 'subscribed' : 'unsubscribed';
}

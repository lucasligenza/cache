import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { auth: { getUser: vi.fn() }, from: vi.fn(), rpc: vi.fn() },
}));
vi.mock('./supabase', () => ({ supabase: supabaseMock }));

import { subscribeToPush, unsubscribeFromPush, getPushStatus, SW_READY_TIMEOUT_MS } from './push';

// Thennable chain for supabase.from('push_subscriptions').delete().eq(...)
function makeFrom(result: { error: unknown } = { error: null }) {
  const chain: Record<string, unknown> = {};
  ['delete', 'eq'].forEach(m => { chain[m] = vi.fn(() => chain); });
  chain.then = (r: (v: unknown) => unknown) => Promise.resolve(r(result));
  return chain;
}

const pushManager = { subscribe: vi.fn(), getSubscription: vi.fn() };

function setServiceWorkerReady(ready: Promise<unknown>) {
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready } });
}

function setSupported(supported: boolean) {
  const nav = navigator as unknown as { serviceWorker?: unknown };
  const win = window as unknown as { PushManager?: unknown };
  if (supported) {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager }) },
    });
    win.PushManager = function () {};
  } else {
    delete nav.serviceWorker;
    delete win.PushManager;
  }
}

type MockNotification = { requestPermission: ReturnType<typeof vi.fn>; permission: string };
const notif = () => (globalThis as unknown as { Notification: MockNotification }).Notification;

describe('push', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSupported(true);
    (globalThis as unknown as { Notification: MockNotification }).Notification = {
      requestPermission: vi.fn().mockResolvedValue('granted'),
      permission: 'granted',
    };
    supabaseMock.from.mockReturnValue(makeFrom());
    supabaseMock.rpc.mockResolvedValue({ error: null });
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    pushManager.subscribe.mockResolvedValue({
      endpoint: 'https://push.example/abc',
      toJSON: () => ({ keys: { p256dh: 'p', auth: 'a' } }),
    });
    pushManager.getSubscription.mockResolvedValue(null);
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'dGVzdA'); // valid base64url
  });
  afterEach(() => { vi.unstubAllEnvs(); });

  it('reports unsupported when the browser lacks serviceWorker/PushManager', async () => {
    setSupported(false);
    expect((await subscribeToPush()).error).toMatch(/not supported/i);
  });

  it('reports unavailable, not a developer message, when the VAPID key is missing', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '');
    const { error } = await subscribeToPush();
    expect(error).toMatch(/unavailable/i);
    expect(error).not.toMatch(/VAPID/);
    expect(await getPushStatus()).toBe('unavailable');
  });

  it('reports when notification permission is denied', async () => {
    notif().requestPermission.mockResolvedValue('denied');
    expect((await subscribeToPush()).error).toMatch(/denied/i);
  });

  it('registers this device\'s endpoint on success', async () => {
    const res = await subscribeToPush();
    expect(res.error).toBeNull();
    expect(pushManager.subscribe).toHaveBeenCalled();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('register_push_subscription', {
      p_endpoint: 'https://push.example/abc',
      p_p256dh_key: 'p',
      p_auth_key: 'a',
    });
  });

  it('reports Not authenticated when there is no user', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    expect((await subscribeToPush()).error).toMatch(/not authenticated/i);
  });

  it('surfaces a database error from the registration', async () => {
    supabaseMock.rpc.mockResolvedValue({ error: { message: 'db boom' } });
    expect((await subscribeToPush()).error).toBe('db boom');
  });

  it('unsubscribes and deletes only this device\'s row', async () => {
    const unsubscribe = vi.fn();
    pushManager.getSubscription.mockResolvedValue({ endpoint: 'https://push.example/abc', unsubscribe });
    const chain = makeFrom();
    supabaseMock.from.mockReturnValue(chain);
    const res = await unsubscribeFromPush();
    expect(res.error).toBeNull();
    expect(unsubscribe).toHaveBeenCalled();
    expect(supabaseMock.from).toHaveBeenCalledWith('push_subscriptions');
    expect(chain.eq).toHaveBeenCalledWith('endpoint', 'https://push.example/abc');
  });

  it('unsubscribe is a no-op when this device has no subscription', async () => {
    const res = await unsubscribeFromPush();
    expect(res.error).toBeNull();
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  describe('when no service worker ever registers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      setServiceWorkerReady(new Promise(() => {}));
    });
    afterEach(() => { vi.useRealTimers(); });

    it('getPushStatus falls back to unavailable instead of hanging', async () => {
      const status = getPushStatus();
      await vi.advanceTimersByTimeAsync(SW_READY_TIMEOUT_MS);
      await expect(status).resolves.toBe('unavailable');
    });

    it('subscribeToPush reports unavailable without writing a row', async () => {
      const res = subscribeToPush();
      await vi.advanceTimersByTimeAsync(SW_READY_TIMEOUT_MS);
      expect((await res).error).toMatch(/unavailable/i);
      expect(supabaseMock.rpc).not.toHaveBeenCalled();
    });

    it('unsubscribeFromPush resolves cleanly', async () => {
      const res = unsubscribeFromPush();
      await vi.advanceTimersByTimeAsync(SW_READY_TIMEOUT_MS);
      expect((await res).error).toBeNull();
      expect(supabaseMock.from).not.toHaveBeenCalled();
    });
  });

  it('getPushStatus reflects the current state', async () => {
    expect(await getPushStatus()).toBe('unsubscribed');
    pushManager.getSubscription.mockResolvedValue({});
    expect(await getPushStatus()).toBe('subscribed');
    notif().permission = 'denied';
    expect(await getPushStatus()).toBe('denied');
    setSupported(false);
    expect(await getPushStatus()).toBe('unsupported');
  });
});

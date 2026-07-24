import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { auth: { getUser: vi.fn() }, from: vi.fn() },
}));
vi.mock('./supabase', () => ({ supabase: supabaseMock }));

import { subscribeToPush, unsubscribeFromPush, getPushStatus } from './push';

// Thennable chain for supabase.from('push_subscriptions').upsert(...) / .delete().eq(...)
function makeFrom(result: { error: unknown } = { error: null }) {
  const chain: Record<string, unknown> = {};
  ['upsert', 'delete', 'eq'].forEach(m => { chain[m] = vi.fn(() => chain); });
  chain.then = (r: (v: unknown) => unknown) => Promise.resolve(r(result));
  return chain;
}

const pushManager = { subscribe: vi.fn(), getSubscription: vi.fn() };

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

  it('reports missing VAPID key', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '');
    expect((await subscribeToPush()).error).toMatch(/VAPID/i);
  });

  it('reports when notification permission is denied', async () => {
    notif().requestPermission.mockResolvedValue('denied');
    expect((await subscribeToPush()).error).toMatch(/denied/i);
  });

  it('subscribes and upserts the subscription on success', async () => {
    const res = await subscribeToPush();
    expect(res.error).toBeNull();
    expect(pushManager.subscribe).toHaveBeenCalled();
    expect(supabaseMock.from).toHaveBeenCalledWith('push_subscriptions');
  });

  it('reports Not authenticated when there is no user', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    expect((await subscribeToPush()).error).toMatch(/not authenticated/i);
  });

  it('surfaces a database error from the upsert', async () => {
    supabaseMock.from.mockReturnValue(makeFrom({ error: { message: 'db boom' } }));
    expect((await subscribeToPush()).error).toBe('db boom');
  });

  it('unsubscribes and deletes the row', async () => {
    const unsubscribe = vi.fn();
    pushManager.getSubscription.mockResolvedValue({ unsubscribe });
    const res = await unsubscribeFromPush();
    expect(res.error).toBeNull();
    expect(unsubscribe).toHaveBeenCalled();
    expect(supabaseMock.from).toHaveBeenCalledWith('push_subscriptions');
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

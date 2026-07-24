import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerOutboxSync, SYNC_TAG } from './bgsync';

const sync = { register: vi.fn() };

function setSupported(opts: { serviceWorker?: boolean; syncManager?: boolean }) {
  const nav = navigator as unknown as { serviceWorker?: unknown };
  const win = window as unknown as { SyncManager?: unknown };
  if (opts.serviceWorker) {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ sync }) },
    });
  } else {
    delete nav.serviceWorker;
  }
  if (opts.syncManager) win.SyncManager = function () {};
  else delete win.SyncManager;
}

describe('bgsync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sync.register.mockResolvedValue(undefined);
    setSupported({ serviceWorker: true, syncManager: true });
  });

  it('registers the flush tag when Background Sync is supported', async () => {
    expect(await registerOutboxSync()).toBe(true);
    expect(sync.register).toHaveBeenCalledWith(SYNC_TAG);
  });

  it('no-ops when serviceWorker is unavailable', async () => {
    setSupported({ serviceWorker: false, syncManager: true });
    expect(await registerOutboxSync()).toBe(false);
    expect(sync.register).not.toHaveBeenCalled();
  });

  it('no-ops when SyncManager is unavailable', async () => {
    setSupported({ serviceWorker: true, syncManager: false });
    expect(await registerOutboxSync()).toBe(false);
    expect(sync.register).not.toHaveBeenCalled();
  });

  it('swallows registration errors and returns false (never throws)', async () => {
    sync.register.mockRejectedValue(new Error('nope'));
    await expect(registerOutboxSync()).resolves.toBe(false);
  });
});

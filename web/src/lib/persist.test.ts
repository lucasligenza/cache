import { describe, it, expect, afterEach, vi } from 'vitest';
import { requestPersistentStorage } from './persist';

function stubStorage(storage: Partial<StorageManager> | undefined) {
  Object.defineProperty(navigator, 'storage', { value: storage, configurable: true });
}

describe('requestPersistentStorage', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'storage');
  afterEach(() => {
    if (original) Object.defineProperty(navigator, 'storage', original);
    else delete (navigator as { storage?: unknown }).storage;
  });

  it('reports unsupported without the StorageManager API', async () => {
    stubStorage(undefined);
    expect(await requestPersistentStorage()).toBe('unsupported');
  });

  it('skips the request when already persisted', async () => {
    const persist = vi.fn();
    stubStorage({ persisted: vi.fn().mockResolvedValue(true), persist });
    expect(await requestPersistentStorage()).toBe('persistent');
    expect(persist).not.toHaveBeenCalled();
  });

  it('asks and reflects the answer', async () => {
    stubStorage({ persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockResolvedValue(true) });
    expect(await requestPersistentStorage()).toBe('persistent');
    stubStorage({ persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockResolvedValue(false) });
    expect(await requestPersistentStorage()).toBe('best-effort');
  });

  it('never throws', async () => {
    stubStorage({ persisted: vi.fn().mockRejectedValue(new Error('nope')), persist: vi.fn() });
    expect(await requestPersistentStorage()).toBe('unsupported');
  });
});

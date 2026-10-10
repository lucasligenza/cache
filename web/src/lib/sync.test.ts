import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  classifySyncError,
  retryDelayMs,
  fetchAllPages,
  createTimeoutFetch,
  RETRY_MAX_MS,
} from '@cache/core';

describe('classifySyncError', () => {
  it.each([
    [{ code: '23505', message: 'duplicate key' }, 409, 'duplicate'],
    [{ code: '23503', message: 'fk violation' }, 409, 'missing-category'],
    [{ code: '', message: 'TypeError: Failed to fetch' }, 0, 'transient'],
    [{ code: '', message: 'AbortError: request timed out' }, 0, 'transient'],
    [{ code: 'PGRST301', message: 'JWT expired' }, 401, 'transient'],
    [{ code: '', message: 'unauthorized' }, 401, 'transient'],
    [{ code: '', message: 'bad gateway' }, 502, 'transient'],
    [{ code: '', message: 'too many requests' }, 429, 'transient'],
    [{ code: '57014', message: 'statement timeout' }, 500, 'transient'],
    [{ code: '08006', message: 'connection failure' }, 503, 'transient'],
    [{ code: '42501', message: 'row-level security' }, 403, 'permanent'],
    [{ code: '23514', message: 'check constraint' }, 400, 'permanent'],
    [{ code: '22001', message: 'value too long' }, 400, 'permanent'],
    [{ code: 'PGRST204', message: 'column not found' }, 400, 'permanent'],
  ] as const)('%o (HTTP %s) → %s', (error, status, kind) => {
    expect(classifySyncError(error, status)).toBe(kind);
  });

  it('treats an error with no code and no status as transient', () => {
    expect(classifySyncError({ message: 'network down' })).toBe('transient');
  });
});

describe('retryDelayMs', () => {
  it('doubles from 5s and caps at 5 minutes', () => {
    expect([1, 2, 3, 4].map(retryDelayMs)).toEqual([5_000, 10_000, 20_000, 40_000]);
    expect(retryDelayMs(30)).toBe(RETRY_MAX_MS);
  });
});

describe('fetchAllPages', () => {
  const rows = (from: number, n: number) => Array.from({ length: n }, (_, i) => ({ id: `r${from + i}` }));

  it('walks windows until a short page and de-duplicates by id', async () => {
    const page = vi.fn(async (from: number) => {
      if (from === 0) return { data: rows(0, 3), error: null };
      if (from === 3) return { data: [...rows(2, 1), ...rows(3, 2)], error: null }; // r2 shifted in again
      return { data: [], error: null };
    });
    const { data, error } = await fetchAllPages(page, 3);
    expect(error).toBeNull();
    expect(data.map(r => r.id)).toEqual(['r0', 'r1', 'r2', 'r3', 'r4']);
    expect(page.mock.calls.map(c => c.slice(0, 2))).toEqual([[0, 2], [3, 5], [6, 8]]);
  });

  it('stops at the first short page', async () => {
    const page = vi.fn(async () => ({ data: rows(0, 2), error: null }));
    const { data } = await fetchAllPages(page, 3);
    expect(data).toHaveLength(2);
    expect(page).toHaveBeenCalledTimes(1);
  });

  it('returns the error from a failed page', async () => {
    const err = { message: 'boom' };
    const page = vi.fn(async (from: number) => (from === 0 ? { data: rows(0, 3), error: null } : { data: null, error: err }));
    const { error } = await fetchAllPages(page, 3);
    expect(error).toBe(err);
  });
});

describe('createTimeoutFetch', () => {
  afterEach(() => { vi.useRealTimers(); });

  // A fetch that only settles when its signal aborts.
  const hangingFetch = vi.fn((_input: unknown, init?: { signal?: AbortSignal }) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    })
  );

  it('aborts a hung request after the timeout with an AbortError', async () => {
    vi.useFakeTimers();
    const f = createTimeoutFetch(15_000, hangingFetch as unknown as typeof fetch);
    const p = f('https://example.test');
    const settled = expect(p).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(15_000);
    await settled;
  });

  it('passes a fast response through and clears its timer', async () => {
    vi.useFakeTimers();
    const ok = new Response('ok');
    const base = vi.fn(async () => ok);
    const f = createTimeoutFetch(15_000, base as unknown as typeof fetch);
    await expect(f('https://example.test', { method: 'POST' })).resolves.toBe(ok);
    expect(base).toHaveBeenCalledWith('https://example.test', expect.objectContaining({ method: 'POST' }));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('still honours the caller’s own abort signal', async () => {
    const f = createTimeoutFetch(15_000, hangingFetch as unknown as typeof fetch);
    const ctrl = new AbortController();
    const p = f('https://example.test', { signal: ctrl.signal });
    ctrl.abort(new Error('cancelled by caller'));
    await expect(p).rejects.toThrow('cancelled by caller');
  });
});

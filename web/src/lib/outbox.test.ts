import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  readOutbox,
  writeOutbox,
  addToOutbox,
  removeFromOutbox,
  updateOutboxItem,
  setOutboxScope,
  newId,
  OUTBOX_KEY,
  OutboxItem,
} from './outbox';

function item(overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id: 'id-1',
    text: 'a fleeting thought',
    category_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    attempts: 0,
    ...overrides,
  };
}

describe('outbox', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    setOutboxScope(null);
  });

  it('readOutbox returns [] when nothing is stored', () => {
    expect(readOutbox()).toEqual([]);
  });

  it('addToOutbox persists an item that readOutbox reads back', () => {
    addToOutbox(item());
    const items = readOutbox();
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe('a fleeting thought');
  });

  it('addToOutbox appends, preserving insertion order', () => {
    addToOutbox(item({ id: 'a', created_at: '2026-01-01T00:00:00.000Z' }));
    addToOutbox(item({ id: 'b', created_at: '2026-01-02T00:00:00.000Z' }));
    expect(readOutbox().map(i => i.id)).toEqual(['a', 'b']);
  });

  it('readOutbox returns [] on corrupt JSON', () => {
    localStorage.setItem(OUTBOX_KEY, '{not json');
    expect(readOutbox()).toEqual([]);
  });

  it('removeFromOutbox removes the matching id', () => {
    addToOutbox(item({ id: 'a' }));
    addToOutbox(item({ id: 'b' }));
    removeFromOutbox('a');
    expect(readOutbox().map(i => i.id)).toEqual(['b']);
  });

  it('updateOutboxItem patches fields of the matching id', () => {
    addToOutbox(item({ id: 'a', text: 'old' }));
    updateOutboxItem('a', { text: 'new', attempts: 2, last_error: 'boom' });
    const [row] = readOutbox();
    expect(row.text).toBe('new');
    expect(row.attempts).toBe(2);
    expect(row.last_error).toBe('boom');
  });

  it('addToOutbox rethrows when the write fails (quota/disabled)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    expect(() => addToOutbox(item())).toThrow();
  });

  it('writeOutbox round-trips an array', () => {
    writeOutbox([item({ id: 'a' }), item({ id: 'b' })]);
    expect(readOutbox().map(i => i.id)).toEqual(['a', 'b']);
  });

  it('newId returns distinct values across rapid calls', () => {
    const ids = new Set([newId(), newId(), newId(), newId()]);
    expect(ids.size).toBe(4);
  });
});

describe('outbox scoping (per-user isolation)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    setOutboxScope(null);
  });

  it('isolates each user’s queue under a scoped key', () => {
    setOutboxScope('user-a');
    addToOutbox(item({ id: 'a1' }));
    expect(readOutbox().map(i => i.id)).toEqual(['a1']);
    // The scoped key — not the legacy unscoped one — holds the data.
    expect(localStorage.getItem('cn_outbox_v1:user-a')).toBeTruthy();

    // A different account sees an empty queue: no cross-account bleed.
    setOutboxScope('user-b');
    expect(readOutbox()).toEqual([]);
    addToOutbox(item({ id: 'b1' }));
    expect(readOutbox().map(i => i.id)).toEqual(['b1']);

    // Switching back restores the original user’s queue intact.
    setOutboxScope('user-a');
    expect(readOutbox().map(i => i.id)).toEqual(['a1']);
  });

  it('does not flush one user’s queued items into another account', () => {
    setOutboxScope('guest-uid');
    addToOutbox(item({ id: 'g1', text: 'guest secret' }));

    // Guest signs out; a different account signs in on the same browser.
    setOutboxScope('other-uid');
    expect(readOutbox()).toEqual([]);
  });

  it('adopts a legacy unscoped queue into the first user’s scoped queue, once', () => {
    // Pre-scoping data written under the legacy key.
    writeOutbox([item({ id: 'legacy1' })]);
    expect(localStorage.getItem(OUTBOX_KEY)).toBeTruthy();

    setOutboxScope('user-a');
    expect(readOutbox().map(i => i.id)).toEqual(['legacy1']); // migrated in
    expect(localStorage.getItem(OUTBOX_KEY)).toBeNull(); // legacy key drained

    // The migrated items belong to user-a only, not a later account.
    setOutboxScope('user-b');
    expect(readOutbox()).toEqual([]);
  });

  it('does not clobber an existing scoped queue with legacy items', () => {
    setOutboxScope('user-a');
    addToOutbox(item({ id: 'a1' }));
    // A stray legacy queue appears (e.g. from an older build) while user-a is active.
    localStorage.setItem(OUTBOX_KEY, JSON.stringify([item({ id: 'stray' })]));

    // Re-establishing scope for a *new* user must not fold legacy into their queue
    // on top of nothing, nor overwrite user-a’s.
    setOutboxScope('user-c');
    expect(readOutbox().map(i => i.id)).not.toContain('a1');
    setOutboxScope('user-a');
    expect(readOutbox().map(i => i.id)).toEqual(['a1']);
  });
});

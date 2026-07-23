import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  readOutbox,
  writeOutbox,
  addToOutbox,
  removeFromOutbox,
  updateOutboxItem,
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

import { describe, it, expect } from 'vitest';
import { createMemoryStorage } from './outboxStorage';
import {
  setOutboxStorage,
  setOutboxScope,
  addToOutbox,
  readOutbox,
  removeFromOutbox,
  writeOutbox,
} from '../../../packages/core/src/outbox';

describe('memory SyncStorage adapter for @cache/core outbox', () => {
  it('lets capture persist a buffer note synchronously before the editor would clear', () => {
    setOutboxStorage(createMemoryStorage());
    setOutboxScope('user-1');
    writeOutbox([]);

    addToOutbox({
      id: 'note-1',
      text: 'fleeting thought',
      category_id: null,
      created_at: '2026-04-08T12:00:00.000Z',
      attempts: 0,
    });

    expect(readOutbox()).toEqual([
      {
        id: 'note-1',
        text: 'fleeting thought',
        category_id: null,
        created_at: '2026-04-08T12:00:00.000Z',
        attempts: 0,
      },
    ]);

    removeFromOutbox('note-1');
    expect(readOutbox()).toEqual([]);
  });
});

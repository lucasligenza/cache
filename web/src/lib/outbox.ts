// The offline outbox now lives in @cache/core (shared with the native app; the
// storage backend is injected there). Re-exported here so existing `./outbox` /
// `../lib/outbox` imports keep working unchanged. Web uses the default
// localStorage fallback, so no setOutboxStorage() call is needed.
export {
  OUTBOX_KEY,
  readOutbox,
  writeOutbox,
  addToOutbox,
  removeFromOutbox,
  updateOutboxItem,
  newId,
  setOutboxStorage,
} from '@cache/core';
export type { OutboxItem, SyncStorage } from '@cache/core';

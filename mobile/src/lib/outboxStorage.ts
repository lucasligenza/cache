import type { SyncStorage } from '@cache/core';

/**
 * In-memory fallback (tests, or if sqlite fails to open). Not durable across process death.
 */
export function createMemoryStorage(): SyncStorage {
  const map = new Map<string, string>();
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: key => {
      map.delete(key);
    },
  };
}

/**
 * Durable *synchronous* outbox store for Expo Go.
 *
 * @cache/core's outbox requires SyncStorage so capture can prove the note is
 * written before the editor clears. Web uses localStorage; the core comment
 * mentions MMKV for native, but MMKV needs a custom dev client. expo-sqlite's
 * sync API ships in Expo Go (SDK 54) and satisfies the same contract.
 */
export function createSqliteStorage(): SyncStorage {
  // Lazy require so vitest (and any non-RN runner) can import other lib files
  // without loading native sqlite.
  const SQLite = require('expo-sqlite') as typeof import('expo-sqlite');
  const db = SQLite.openDatabaseSync('cache_outbox.db');
  db.execSync(
    'CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);',
  );
  return {
    getItem(key: string) {
      const row = db.getFirstSync<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key]);
      return row?.value ?? null;
    },
    setItem(key: string, value: string) {
      db.runSync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', [key, value]);
    },
    removeItem(key: string) {
      db.runSync('DELETE FROM kv WHERE key = ?', [key]);
    },
  };
}

export function createNativeOutboxStorage(): SyncStorage {
  try {
    return createSqliteStorage();
  } catch {
    return createMemoryStorage();
  }
}

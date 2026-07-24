// Durable local queue for notes captured but not yet confirmed by the server.
// A note lands here the instant it is typed, so a fleeting thought is never lost
// to an offline/flaky network — it syncs later on reconnect or app reload.
//
// Platform-agnostic: the *synchronous* key-value store is injected. Web passes
// `localStorage`; native passes a synchronous MMKV-backed adapter. Synchronous is
// the whole point — a note is provably durable before the capture UI clears.

export const OUTBOX_KEY = 'cn_outbox_v1';

export interface OutboxItem {
  /** Client-generated UUID — doubles as the optimistic note id AND the server row id. */
  id: string;
  text: string;
  category_id: string | null;
  /** ISO capture time, sent to the server so a long-queued note keeps its place in the timeline. */
  created_at: string;
  attempts: number;
  last_error?: string;
}

/** The synchronous storage surface the outbox needs (a subset of Web Storage). */
export interface SyncStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

let injected: SyncStorage | null = null;

/**
 * Point the outbox at a platform storage. Web can skip this (it falls back to
 * globalThis.localStorage); native must call it once at startup with an MMKV adapter.
 */
export function setOutboxStorage(storage: SyncStorage): void {
  injected = storage;
}

function storage(): SyncStorage {
  if (injected) return injected;
  const g = (globalThis as { localStorage?: SyncStorage }).localStorage;
  if (g) return g;
  throw new Error('outbox: no storage configured — call setOutboxStorage()');
}

// The queue is scoped to the signed-in user so one account never flushes another's
// queued notes (the outbox lives in a single shared localStorage; without scoping,
// a guest's offline captures would sync under whoever signs in next). The active
// storage key is `${OUTBOX_KEY}:${uid}`, or the bare legacy key when no user is set.
let scope: string | null = null;

function key(): string {
  return scope ? `${OUTBOX_KEY}:${scope}` : OUTBOX_KEY;
}

function parse(raw: string | null): OutboxItem[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? (p as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

/**
 * Bind the outbox to the current user id (null when signed out). Call this before
 * any outbox operation. On the first switch to a user it performs a one-time
 * migration of any pre-scoping legacy queue (see migrateLegacyOutbox).
 */
export function setOutboxScope(userId: string | null): void {
  if (userId === scope) return;
  scope = userId;
  if (scope) migrateLegacyOutbox();
}

// One-time transition off the old unscoped key. When a user first becomes active,
// adopt any items left in the legacy `cn_outbox_v1` into their scoped queue (the
// common case: the same person reloading into the new build). If they already have
// a scoped queue, just drop the legacy key rather than risk folding in another
// session's items. Idempotent — the legacy key is removed either way.
function migrateLegacyOutbox(): void {
  const s = storage();
  const legacy = parse(s.getItem(OUTBOX_KEY));
  if (legacy.length === 0) return;
  const scoped = parse(s.getItem(key()));
  if (scoped.length === 0) s.setItem(key(), JSON.stringify(legacy));
  s.removeItem(OUTBOX_KEY);
}

export function readOutbox(): OutboxItem[] {
  return parse(storage().getItem(key()));
}

/** Persist the queue. May throw (quota exceeded / storage disabled) — callers rely on this. */
export function writeOutbox(items: OutboxItem[]): void {
  storage().setItem(key(), JSON.stringify(items));
}

/** Append an item and persist. Rethrows on write failure so capture can preserve the editor text. */
export function addToOutbox(item: OutboxItem): void {
  const items = readOutbox();
  items.push(item);
  writeOutbox(items);
}

export function removeFromOutbox(id: string): void {
  writeOutbox(readOutbox().filter(i => i.id !== id));
}

export function updateOutboxItem(id: string, patch: Partial<OutboxItem>): void {
  writeOutbox(readOutbox().map(i => (i.id === id ? { ...i, ...patch } : i)));
}

/** A collision-proof id (replaces `temp-${Date.now()}`), used as the note's primary key. */
export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

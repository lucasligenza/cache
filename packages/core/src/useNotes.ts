import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Note } from './types';
import {
  OutboxItem,
  OUTBOX_NOTE_FIELDS,
  readOutbox,
  addToOutbox,
  removeFromOutbox,
  updateOutboxItem,
  setOutboxScope,
  newId,
} from './outbox';
import {
  classifySyncError,
  retryDelayMs,
  fetchAllPages,
  later,
  FOREGROUND_REFETCH_MIN_MS,
  type SubscribeForeground,
} from './sync';

/**
 * Platform dependencies injected by each app. Web passes its Supabase client and
 * `() => navigator.onLine`; native passes its client and a NetInfo-backed signal.
 * Deps are read through a ref, so the wrapper may pass fresh closures each render
 * without churning the hook's callbacks.
 */
export interface NotesDeps {
  supabase: SupabaseClient;
  isOnline?: () => boolean;
  enabled?: boolean;
  /** User-facing failure messages (web shows them as toasts). Load failures are not sent here — read `error` instead. */
  onError?: (msg: string) => void;
  /** Every failed request, for telemetry. `op` names what failed ('load', 'sync', 'update', …). */
  onRequestError?: (op: string, error: unknown) => void;
  /** Foreground / back-online signal. Each call flushes the outbox and quietly refetches. */
  subscribeForeground?: SubscribeForeground;
  /** Current user id — scopes the offline outbox so queues never bleed across accounts. */
  userId?: string | null;
}

// Pinned notes float to the top; within each group, newest first.
function sortNotes(arr: Note[]): Note[] {
  return [...arr].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function itemToNote(i: OutboxItem): Note {
  return {
    id: i.id,
    text: i.text,
    created_at: i.created_at,
    updated_at: i.created_at,
    category_id: i.category_id,
    color: i.color ?? null,
    remind_at: i.remind_at ?? null,
    pending_review: i.pending_review ?? false,
    pinned: i.pinned ?? false,
    archived_at: i.archived_at ?? null,
    reviewed_at: i.reviewed_at ?? null,
    review_muted: i.review_muted ?? false,
    pending: true,
    syncError: i.failed ? (i.last_error || 'rejected by server') : undefined,
  };
}

// The outbox is the local source of truth for any note it still holds: a queued
// edit (or archive) must win over the server copy until it syncs, and a server
// refetch must never hide a thought that hasn't synced yet.
function mergeWithOutbox(serverRows: Note[], wantArchived: boolean): Note[] {
  const queue = readOutbox();
  const queued = new Set(queue.map(i => i.id));
  return [
    ...serverRows.filter(n => !queued.has(n.id)),
    ...queue.filter(i => !!i.archived_at === wantArchived).map(itemToNote),
  ];
}

function insertPayload(i: OutboxItem): Record<string, unknown> {
  const p: Record<string, unknown> = { id: i.id, created_at: i.created_at };
  for (const f of OUTBOX_NOTE_FIELDS) if (i[f] !== undefined) p[f] = i[f];
  return p;
}

function patchPayload(i: OutboxItem): Record<string, unknown> {
  const p: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const f of OUTBOX_NOTE_FIELDS) if (i[f] !== undefined) p[f] = i[f];
  return p;
}

function outboxPatch(updates: Partial<Note>): Partial<OutboxItem> {
  const patch: Record<string, unknown> = {};
  for (const f of OUTBOX_NOTE_FIELDS) if (f in updates) patch[f] = updates[f] ?? null;
  if ('text' in patch && typeof patch.text !== 'string') delete patch.text;
  return patch as Partial<OutboxItem>;
}

function errorMessage(error: unknown): string {
  const m = (error as { message?: string } | null)?.message;
  return m || 'unknown error';
}

const findQueued = (id: string) => readOutbox().find(i => i.id === id);

type Res = { data: unknown; error: { code?: string; message?: string } | null; status?: number };

export function useNotesCore(deps: NotesDeps) {
  const enabled = deps.enabled ?? true;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // All platform deps flow through a ref so callback identity never depends on
  // the (possibly fresh-each-render) deps object.
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const db = () => depsRef.current.supabase;
  const online = () => depsRef.current.isOnline?.() ?? true;
  const fail = (msg: string) => depsRef.current.onError?.(msg);
  const report = (op: string, error: unknown) => {
    try { depsRef.current.onRequestError?.(op, error); } catch { /* telemetry must never break sync */ }
  };
  // Bind the outbox to the current user before every queue touch, so a queued
  // note can only ever sync under the account that captured it (no bleed).
  const scopeOutbox = () => setOutboxScope(depsRef.current.userId ?? null);

  const [notes, setNotes] = useState<Note[]>([]);
  const [archived, setArchived] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Bumped whenever dead-letter state changes, so `syncIssues` re-reads the outbox.
  const [outboxTick, setOutboxTick] = useState(0);
  const bump = () => setOutboxTick(t => t + 1);

  // Keep a live ref so archiveNote can find the note being removed without
  // depending on `notes` (which would churn the callback identity every render).
  const notesRef = useRef<Note[]>([]);
  useEffect(() => { notesRef.current = notes; }, [notes]);

  // Ids currently being synced — guards against two flushes double-inserting.
  const inFlight = useRef<Set<string>>(new Set());
  // Notes that finished syncing while a fetch was in flight. The fetch's server
  // snapshot may predate their insert, and they've already left the outbox, so
  // without this they'd blink out of the list until the next refetch.
  const syncedDuringFetch = useRef<Map<string, Note>>(new Map());
  const fetchSeq = useRef(0);
  const lastFetchAt = useRef(0);

  const patchLocal = (id: string, patch: Partial<Note>) => {
    const apply = (prev: Note[]) => prev.map(n => (n.id === id ? { ...n, ...patch } : n));
    setNotes(prev => sortNotes(apply(prev)));
    setArchived(apply);
  };

  const fetch = useCallback(async () => {
    scopeOutbox();
    const seq = ++fetchSeq.current;
    syncedDuringFetch.current = new Map();
    const { data, error } = await fetchAllPages<Note>((from, to) =>
      db()
        .from('notes')
        .select('*')
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to) as unknown as PromiseLike<{ data: Note[] | null; error: unknown }>
    );
    if (seq !== fetchSeq.current) return; // superseded by a newer fetch
    lastFetchAt.current = Date.now();
    if (error) {
      // No toast: the app shell shows an offline/retry banner off `error`, and
      // already-loaded (and queued) notes stay on screen.
      report('load', error);
      setLoadError(true);
      setLoading(false);
      return;
    }
    setLoadError(false);
    const rows = mergeWithOutbox(data, false);
    const ids = new Set(rows.map(n => n.id));
    for (const [id, n] of syncedDuringFetch.current) {
      if (!ids.has(id) && !n.archived_at) rows.push(n);
    }
    setNotes(sortNotes(rows));
    setLoading(false);
  }, []);

  const fetchArchived = useCallback(async () => {
    scopeOutbox();
    const { data, error } = await fetchAllPages<Note>((from, to) =>
      db()
        .from('notes')
        .select('*')
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to) as unknown as PromiseLike<{ data: Note[] | null; error: unknown }>
    );
    if (error) { report('load-archive', error); fail('failed to load archive'); return; }
    setArchived(mergeWithOutbox(data, true));
  }, []);

  const markRetry = (item: OutboxItem, error: unknown) => {
    const attempts = item.attempts + 1;
    updateOutboxItem(item.id, {
      attempts,
      last_error: errorMessage(error),
      next_attempt_at: Date.now() + retryDelayMs(attempts),
    });
  };

  const markFailed = (item: OutboxItem, error: unknown) => {
    const msg = errorMessage(error);
    updateOutboxItem(item.id, { attempts: item.attempts + 1, last_error: msg, failed: true, next_attempt_at: undefined });
    patchLocal(item.id, { syncError: msg });
    bump();
  };

  // Route a failed write to backoff or the dead-letter list. If the user edited
  // the note while it was in flight, the edit may be the fix — retry it now.
  const handleSyncFailure = (sent: OutboxItem, res: Res) => {
    report('sync', res.error);
    const latest = findQueued(sent.id);
    if (!latest) return;
    const kind = classifySyncError(res.error, res.status);
    if (kind === 'transient') markRetry(latest, res.error);
    else if ((latest.rev ?? 0) !== (sent.rev ?? 0)) flushAgain.current = true;
    else markFailed(latest, res.error);
  };

  // Push one queued note to the server. Idempotent: the note carries a
  // client-generated id, so a re-sync after a crash hits a unique-violation
  // (23505), treated as "already synced". Edits made while queued are carried in
  // the insert; edits made while the insert is in flight (rev changed) are sent
  // as a follow-up update before the item leaves the outbox.
  const syncItem = useCallback(async (start: OutboxItem): Promise<void> => {
    scopeOutbox();
    if (inFlight.current.has(start.id)) return;
    inFlight.current.add(start.id);
    try {
      let sent = start;
      const insert = (i: OutboxItem) =>
        db().from('notes').insert(insertPayload(i)).select().single() as unknown as Promise<Res>;
      let res = await insert(sent);
      let kind = res.error ? classifySyncError(res.error, res.status) : null;

      if (kind === 'missing-category' && sent.category_id) {
        // Its directory was deleted while the note sat in the queue: file it to
        // the buffer rather than dropping or endlessly retrying it.
        const latest = findQueued(sent.id);
        if (!latest) return;
        updateOutboxItem(sent.id, { category_id: null, rev: (latest.rev ?? 0) + 1 });
        patchLocal(sent.id, { category_id: null });
        sent = findQueued(sent.id) ?? { ...latest, category_id: null };
        res = await insert(sent);
        kind = res.error ? classifySyncError(res.error, res.status) : null;
      }

      if (res.error && kind !== 'duplicate') { handleSyncFailure(sent, res); return; }

      let server = (res.data as Note | null) ?? null;
      for (let round = 0; round < 3; round++) {
        const latest = findQueued(sent.id);
        if (!latest) {
          // Permanently deleted while the insert was in flight — undo the insert.
          await db().from('notes').delete().eq('id', sent.id);
          return;
        }
        const editedInFlight = (latest.rev ?? 0) !== (sent.rev ?? 0);
        // On a duplicate we can't see the server copy; if the note was ever edited
        // locally, push the local state so those edits aren't lost.
        const editedBeforeDup = kind === 'duplicate' && (latest.rev ?? 0) > 0;
        if (!editedInFlight && !editedBeforeDup) break;
        const upd = (await db()
          .from('notes')
          .update(patchPayload(latest))
          .eq('id', latest.id)
          .select()
          .single()) as unknown as Res;
        if (upd.error) { handleSyncFailure(latest, upd); return; }
        server = (upd.data as Note | null) ?? server;
        sent = latest;
        kind = null;
      }

      removeFromOutbox(sent.id);
      const local = notesRef.current.find(n => n.id === sent.id);
      const synced: Note = { ...(local ?? itemToNote(sent)), ...(server ?? {}), pending: false, syncError: undefined };
      syncedDuringFetch.current.set(sent.id, synced);
      const swap = (prev: Note[]) => prev.map(n => (n.id === sent.id ? synced : n));
      setNotes(prev => sortNotes(swap(prev)));
      setArchived(swap);
    } finally {
      inFlight.current.delete(start.id);
    }
  }, []);

  // Drain the outbox in capture order. Skips dead-lettered items, and items still
  // backing off unless `force` (reconnect / manual retry). Concurrent calls join
  // the running flush and trigger one more pass, so a capture made mid-flush
  // still goes out. No-op while offline.
  const flushing = useRef<Promise<void> | null>(null);
  const flushAgain = useRef(false);
  const forceAgain = useRef(false);
  const retryCancel = useRef<(() => void) | null>(null);
  const flushRef = useRef<(opts?: { force?: boolean }) => Promise<void>>(async () => {});

  const scheduleRetry = () => {
    retryCancel.current?.();
    retryCancel.current = null;
    if (!enabledRef.current) return;
    const waits = readOutbox()
      .filter(i => !i.failed && i.next_attempt_at)
      .map(i => i.next_attempt_at as number);
    if (!waits.length) return;
    const delay = Math.max(0, Math.min(...waits) - Date.now());
    retryCancel.current = later(() => { retryCancel.current = null; void flushRef.current(); }, delay);
  };

  const flushOutbox = useCallback(async (opts?: { force?: boolean }) => {
    const force = opts?.force === true;
    if (!online()) return;
    if (flushing.current) {
      flushAgain.current = true;
      if (force) forceAgain.current = true;
      return flushing.current;
    }
    const run = async () => {
      let pass = force;
      do {
        flushAgain.current = false;
        scopeOutbox();
        const now = Date.now();
        for (const item of readOutbox()) {
          if (!online()) return;
          const latest = findQueued(item.id);
          if (!latest || latest.failed) continue;
          if (!pass && latest.next_attempt_at && latest.next_attempt_at > now) continue;
          await syncItem(latest);
        }
        pass = forceAgain.current;
        forceAgain.current = false;
      } while (flushAgain.current);
    };
    const p = run().finally(() => {
      flushing.current = null;
      scheduleRetry();
    });
    flushing.current = p;
    return p;
  }, [syncItem]);
  flushRef.current = flushOutbox;

  useEffect(() => {
    if (!enabled) return;
    // Show anything still queued from a previous session immediately — before,
    // and regardless of, the network round-trip.
    scopeOutbox();
    setNotes(prev => (prev.length ? prev : sortNotes(mergeWithOutbox([], false))));
    bump();
    fetch().then(() => flushOutbox());
  }, [fetch, enabled, flushOutbox]);

  // On sign-out (enabled → false) drop the previous user's notes from memory so
  // nothing lingers between accounts; the next sign-in re-fetches under its own uid.
  useEffect(() => {
    if (enabled) return;
    retryCancel.current?.();
    retryCancel.current = null;
    setNotes([]);
    setArchived([]);
  }, [enabled]);

  useEffect(() => () => { retryCancel.current?.(); }, []);

  // Back in the foreground or back online: push the queue, then pick up changes
  // made on other devices (e.g. phone captures) without a full reload.
  useEffect(() => {
    const subscribe = depsRef.current.subscribeForeground;
    if (!enabled || !subscribe) return;
    return subscribe(reason => {
      if (!online()) return;
      const isOnlineEvent = reason === 'online';
      const due = isOnlineEvent || Date.now() - lastFetchAt.current >= FOREGROUND_REFETCH_MIN_MS;
      void flushOutbox({ force: isOnlineEvent }).then(() => { if (due) return fetch(); });
    });
  }, [enabled, fetch, flushOutbox]);

  // Capture is durable-first: the note is written to the local outbox (durable)
  // and shown immediately; the promise resolves as soon as it is *locally* safe
  // and the server sync runs in the background, so a slow or captive network
  // never holds up the next thought. It rejects ONLY if the local write fails —
  // the sole case where the editor text must be preserved.
  const createNote = useCallback(async (text: string, category_id?: string): Promise<Note> => {
    scopeOutbox();
    const id = newId();
    const created_at = new Date().toISOString();
    const cat = category_id || null;
    const item: OutboxItem = { id, text, category_id: cat, created_at, attempts: 0 };
    addToOutbox(item); // throws → rejects → caller keeps text
    const optimistic = itemToNote(item);
    setNotes(prev => sortNotes([optimistic, ...prev]));
    void flushOutbox();
    return optimistic;
  }, [flushOutbox]);

  // Edits to a still-queued note go into its outbox entry (they ride along with
  // the eventual insert); there's no server row to update yet.
  const editQueued = (item: OutboxItem, patch: Partial<OutboxItem>) => {
    const wasFailed = !!item.failed;
    updateOutboxItem(item.id, {
      ...patch,
      rev: (item.rev ?? 0) + 1,
      ...(wasFailed ? { failed: false, attempts: 0, next_attempt_at: undefined } : {}),
    });
    if (wasFailed) {
      // Editing a rejected note is how the user fixes it — try again right away.
      patchLocal(item.id, { syncError: undefined });
      bump();
      void flushOutbox({ force: true });
    }
  };

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    scopeOutbox();
    const stamp = new Date().toISOString();
    setNotes(prev => sortNotes(prev.map(n => n.id === id ? { ...n, ...updates, updated_at: stamp } : n)));
    const queued = findQueued(id);
    if (queued) { editQueued(queued, outboxPatch(updates)); return; }
    const { error } = await db()
      .from('notes')
      .update({ ...updates, updated_at: stamp })
      .eq('id', id);
    if (error) { report('update', error); fetch(); throw error; }
  }, [fetch, flushOutbox]);

  // Soft-delete: removes the note from the active list and returns it so the
  // caller can offer an undo. Also stages it into the archived list. A queued
  // note stays queued (now carrying archived_at), so it still reaches the server
  // and undo still works.
  const archiveNote = useCallback(async (id: string): Promise<Note | null> => {
    scopeOutbox();
    const removed = notesRef.current.find(n => n.id === id) ?? null;
    const stamp = new Date().toISOString();
    setNotes(prev => prev.filter(n => n.id !== id));
    if (removed) setArchived(prev => [{ ...removed, archived_at: stamp }, ...prev.filter(n => n.id !== id)]);
    const queued = findQueued(id);
    if (queued) { editQueued(queued, { archived_at: stamp }); return removed; }
    const { error } = await db()
      .from('notes')
      .update({ archived_at: stamp })
      .eq('id', id);
    if (error) { report('archive', error); fetch(); throw error; }
    return removed;
  }, [fetch, flushOutbox]);

  // Restore a previously archived note back to the active list.
  const unarchiveNote = useCallback(async (note: Note) => {
    scopeOutbox();
    setArchived(prev => prev.filter(n => n.id !== note.id));
    setNotes(prev => sortNotes([{ ...note, archived_at: null }, ...prev.filter(n => n.id !== note.id)]));
    const queued = findQueued(note.id);
    if (queued) { editQueued(queued, { archived_at: null }); return; }
    const { error } = await db()
      .from('notes')
      .update({ archived_at: null })
      .eq('id', note.id);
    if (error) { report('unarchive', error); fetch(); fetchArchived(); throw error; }
  }, [fetch, fetchArchived, flushOutbox]);

  // Permanent, irreversible delete (used from the archive view and to discard a
  // note the server rejected). The server delete is sent even for a queued note:
  // an earlier insert may have landed without us seeing the response.
  const deleteNote = useCallback(async (id: string) => {
    scopeOutbox();
    const wasQueued = !!findQueued(id);
    removeFromOutbox(id);
    if (wasQueued) bump();
    setNotes(prev => prev.filter(n => n.id !== id));
    setArchived(prev => prev.filter(n => n.id !== id));
    const { error } = await db().from('notes').delete().eq('id', id);
    if (error) {
      report('delete', error);
      if (wasQueued) return; // gone locally; a stray server row (if any) shows up on next load
      fetch();
      throw error;
    }
  }, [fetch]);

  // Re-queue dead-lettered notes (one, or all when no id) and sync now.
  const retrySync = useCallback(async (id?: string) => {
    scopeOutbox();
    for (const item of readOutbox()) {
      if (!item.failed || (id && item.id !== id)) continue;
      updateOutboxItem(item.id, { failed: false, attempts: 0, next_attempt_at: undefined });
      patchLocal(item.id, { syncError: undefined });
    }
    bump();
    await flushOutbox({ force: true });
  }, [flushOutbox]);

  const getNotesByCategory = useCallback(
    (categoryId: string) => notes.filter(n => n.category_id === categoryId),
    [notes]
  );

  // Dead-lettered notes stay on device, but they will not retry, so they are not "queued".
  const pendingCount = useMemo(
    () => notes.filter(n => n.pending && !n.syncError).length,
    [notes],
  );

  // Dead-lettered notes, read from the outbox so archived ones are included too.
  const syncIssues = useMemo(() => {
    if (!enabled) return [];
    scopeOutbox();
    return readOutbox().filter(i => i.failed).map(itemToNote);
  }, [outboxTick, enabled, deps.userId]);

  return {
    notes,
    archived,
    unsortedNotes: notes.filter(n => !n.category_id),
    loading,
    error: loadError,
    pendingCount,
    syncIssues,
    createNote,
    updateNote,
    archiveNote,
    unarchiveNote,
    deleteNote,
    retrySync,
    getNotesByCategory,
    fetchArchived,
    flushOutbox,
    refetch: fetch,
  };
}

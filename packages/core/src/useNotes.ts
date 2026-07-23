import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Note } from './types';
import {
  OutboxItem,
  readOutbox,
  addToOutbox,
  removeFromOutbox,
  updateOutboxItem,
  newId,
} from './outbox';

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
  onError?: (msg: string) => void;
}

// Pinned notes float to the top; within each group, newest first.
function sortNotes(arr: Note[]): Note[] {
  return [...arr].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

// Represent still-queued outbox items as pending Notes so a server refetch never
// hides a thought that hasn't synced yet.
function outboxAsNotes(present: Note[]): Note[] {
  const ids = new Set(present.map(n => n.id));
  return readOutbox()
    .filter(i => !ids.has(i.id))
    .map(i => ({
      id: i.id,
      text: i.text,
      created_at: i.created_at,
      updated_at: i.created_at,
      category_id: i.category_id,
      color: null,
      remind_at: null,
      pending_review: false,
      pinned: false,
      archived_at: null,
      reviewed_at: null,
      pending: true,
    }));
}
function mergeWithOutbox(serverRows: Note[]): Note[] {
  return [...serverRows, ...outboxAsNotes(serverRows)];
}

export function useNotesCore(deps: NotesDeps) {
  const enabled = deps.enabled ?? true;

  // All platform deps flow through a ref so callback identity never depends on
  // the (possibly fresh-each-render) deps object.
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const db = () => depsRef.current.supabase;
  const online = () => depsRef.current.isOnline?.() ?? true;
  const fail = (msg: string) => depsRef.current.onError?.(msg);

  const [notes, setNotes] = useState<Note[]>([]);
  const [archived, setArchived] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Keep a live ref so archiveNote can find the note being removed without
  // depending on `notes` (which would churn the callback identity every render).
  const notesRef = useRef<Note[]>([]);
  useEffect(() => { notesRef.current = notes; }, [notes]);

  // Ids currently being synced — guards against the inline sync in createNote
  // and a concurrent flush double-inserting the same note.
  const inFlight = useRef<Set<string>>(new Set());

  const fetch = useCallback(async () => {
    const { data, error } = await db()
      .from('notes')
      .select('*')
      .is('archived_at', null)
      .order('created_at', { ascending: false });
    if (error) { setLoadError(true); fail('failed to load notes'); setLoading(false); return; }
    setLoadError(false);
    setNotes(sortNotes(mergeWithOutbox((data as Note[]) || [])));
    setLoading(false);
  }, []);

  const fetchArchived = useCallback(async () => {
    const { data, error } = await db()
      .from('notes')
      .select('*')
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false });
    if (error) { fail('failed to load archive'); return; }
    setArchived((data as Note[]) || []);
  }, []);

  // Push one queued note to the server. Idempotent: the note carries a
  // client-generated id, so a re-sync after a crash hits a unique-violation
  // (23505) which we treat as "already synced". Stays queued on a real error.
  const syncItem = useCallback(async (item: OutboxItem): Promise<Note | null> => {
    if (inFlight.current.has(item.id)) return null;
    inFlight.current.add(item.id);
    try {
      const { data, error } = await db()
        .from('notes')
        .insert({ id: item.id, text: item.text, category_id: item.category_id, created_at: item.created_at })
        .select()
        .single();
      if (error && (error as { code?: string }).code !== '23505') {
        updateOutboxItem(item.id, { attempts: item.attempts + 1, last_error: error.message });
        return null;
      }
      removeFromOutbox(item.id);
      const server = (data as Note | null) ?? null;
      setNotes(prev => sortNotes(prev.map(n => (n.id === item.id ? { ...(server ?? n), pending: false } : n))));
      return server;
    } finally {
      inFlight.current.delete(item.id);
    }
  }, []);

  // Drain the outbox in capture order (preserves the timeline on the server).
  // No-op while offline — items stay queued until the next reconnect.
  const flushOutbox = useCallback(async () => {
    if (!online()) return;
    for (const item of readOutbox()) {
      await syncItem(item);
    }
  }, [syncItem]);

  useEffect(() => { if (enabled) fetch().then(() => flushOutbox()); }, [fetch, enabled, flushOutbox]);

  // Capture is durable-first: the note is written to the local outbox (durable)
  // and shown immediately; the promise resolves as soon as it is *locally* safe.
  // It rejects ONLY if the local write itself fails — the sole case where the
  // editor text must be preserved. A failed/offline server sync is not a loss.
  const createNote = useCallback(async (text: string, category_id?: string): Promise<Note> => {
    const id = newId();
    const created_at = new Date().toISOString();
    const cat = category_id || null;
    const optimistic: Note = {
      id, text, created_at, updated_at: created_at,
      category_id: cat, color: null, remind_at: null,
      pending_review: false, pinned: false, archived_at: null, reviewed_at: null,
      pending: true,
    };
    addToOutbox({ id, text, category_id: cat, created_at, attempts: 0 }); // throws → rejects → caller keeps text
    setNotes(prev => sortNotes([optimistic, ...prev]));
    if (online()) {
      await syncItem({ id, text, category_id: cat, created_at, attempts: 0 }).catch(() => {});
    }
    return optimistic;
  }, [syncItem]);

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    setNotes(prev => sortNotes(prev.map(n => n.id === id ? { ...n, ...updates, updated_at: new Date().toISOString() } : n)));
    // If the note hasn't synced yet, mirror the edit into the outbox so the
    // eventual insert carries the latest text/category, not the original draft.
    if (readOutbox().some(i => i.id === id)) {
      const patch: Partial<OutboxItem> = {};
      if ('text' in updates && typeof updates.text === 'string') patch.text = updates.text;
      if ('category_id' in updates) patch.category_id = updates.category_id ?? null;
      if (Object.keys(patch).length) updateOutboxItem(id, patch);
    }
    const { error } = await db()
      .from('notes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { fetch(); throw error; }
  }, [fetch]);

  // Soft-delete: removes the note from the active list and returns it so the
  // caller can offer an undo. Also stages it into the archived list.
  const archiveNote = useCallback(async (id: string): Promise<Note | null> => {
    const removed = notesRef.current.find(n => n.id === id) ?? null;
    const stamp = new Date().toISOString();
    removeFromOutbox(id); // don't let a pending sync resurrect a deleted note
    setNotes(prev => prev.filter(n => n.id !== id));
    if (removed) setArchived(prev => [{ ...removed, archived_at: stamp }, ...prev]);
    const { error } = await db()
      .from('notes')
      .update({ archived_at: stamp })
      .eq('id', id);
    if (error) { fetch(); throw error; }
    return removed;
  }, [fetch]);

  // Restore a previously archived note back to the active list.
  const unarchiveNote = useCallback(async (note: Note) => {
    setArchived(prev => prev.filter(n => n.id !== note.id));
    setNotes(prev => sortNotes([{ ...note, archived_at: null }, ...prev]));
    const { error } = await db()
      .from('notes')
      .update({ archived_at: null })
      .eq('id', note.id);
    if (error) { fetch(); fetchArchived(); throw error; }
  }, [fetch, fetchArchived]);

  // Permanent, irreversible delete (used only from the archive view).
  const deleteNote = useCallback(async (id: string) => {
    removeFromOutbox(id);
    setNotes(prev => prev.filter(n => n.id !== id));
    setArchived(prev => prev.filter(n => n.id !== id));
    const { error } = await db().from('notes').delete().eq('id', id);
    if (error) { fetch(); throw error; }
  }, [fetch]);

  const getNotesByCategory = useCallback(
    (categoryId: string) => notes.filter(n => n.category_id === categoryId),
    [notes]
  );

  const pendingCount = useMemo(() => notes.filter(n => n.pending).length, [notes]);

  return {
    notes,
    archived,
    unsortedNotes: notes.filter(n => !n.category_id),
    loading,
    error: loadError,
    pendingCount,
    createNote,
    updateNote,
    archiveNote,
    unarchiveNote,
    deleteNote,
    getNotesByCategory,
    fetchArchived,
    flushOutbox,
    refetch: fetch,
  };
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Note } from '../types';

// Pinned notes float to the top; within each group, newest first.
function sortNotes(arr: Note[]): Note[] {
  return [...arr].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function useNotes(enabled = true, onError?: (msg: string) => void) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [archived, setArchived] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Keep a live ref so archiveNote can find the note being removed without
  // depending on `notes` (which would churn the callback identity every render).
  const notesRef = useRef<Note[]>([]);
  useEffect(() => { notesRef.current = notes; }, [notes]);

  const fetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .is('archived_at', null)
      .order('created_at', { ascending: false });
    if (error) { setLoadError(true); onError?.('failed to load notes'); setLoading(false); return; }
    setLoadError(false);
    setNotes(sortNotes(data || []));
    setLoading(false);
  }, [onError]);

  useEffect(() => { if (enabled) fetch(); }, [fetch, enabled]);

  const fetchArchived = useCallback(async () => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false });
    if (error) { onError?.('failed to load archive'); return; }
    setArchived(data || []);
  }, [onError]);

  const createNote = useCallback(async (text: string, category_id?: string) => {
    const optimistic: Note = {
      id: `temp-${Date.now()}`,
      text,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      category_id: category_id || null,
      color: null,
      remind_at: null,
      pending_review: false,
      pinned: false,
      archived_at: null,
      reviewed_at: null,
    };
    setNotes(prev => sortNotes([optimistic, ...prev]));
    const { data, error } = await supabase
      .from('notes')
      .insert({ text, category_id: category_id || null })
      .select()
      .single();
    if (error) {
      setNotes(prev => prev.filter(n => n.id !== optimistic.id));
      throw error;
    }
    setNotes(prev => sortNotes(prev.map(n => n.id === optimistic.id ? data : n)));
    return data as Note;
  }, []);

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    setNotes(prev => sortNotes(prev.map(n => n.id === id ? { ...n, ...updates, updated_at: new Date().toISOString() } : n)));
    const { error } = await supabase
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
    setNotes(prev => prev.filter(n => n.id !== id));
    if (removed) setArchived(prev => [{ ...removed, archived_at: stamp }, ...prev]);
    const { error } = await supabase
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
    const { error } = await supabase
      .from('notes')
      .update({ archived_at: null })
      .eq('id', note.id);
    if (error) { fetch(); fetchArchived(); throw error; }
  }, [fetch, fetchArchived]);

  // Permanent, irreversible delete (used only from the archive view).
  const deleteNote = useCallback(async (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    setArchived(prev => prev.filter(n => n.id !== id));
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) { fetch(); throw error; }
  }, [fetch]);

  const getNotesByCategory = useCallback(
    (categoryId: string) => notes.filter(n => n.category_id === categoryId),
    [notes]
  );

  return {
    notes,
    archived,
    unsortedNotes: notes.filter(n => !n.category_id),
    loading,
    error: loadError,
    createNote,
    updateNote,
    archiveNote,
    unarchiveNote,
    deleteNote,
    getNotesByCategory,
    fetchArchived,
    refetch: fetch,
  };
}

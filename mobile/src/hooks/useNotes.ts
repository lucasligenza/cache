import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Note } from '../types';

export function useNotes(enabled = true) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .is('archived_at', null)
      .order('created_at', { ascending: false });

    if (error) { console.error(error); return; }
    setNotes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { if (enabled) fetch(); }, [fetch, enabled]);

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
    };
    setNotes(prev => [optimistic, ...prev]);

    const { data, error } = await supabase
      .from('notes')
      .insert({ text, category_id: category_id || null })
      .select()
      .single();

    if (error) {
      setNotes(prev => prev.filter(n => n.id !== optimistic.id));
      throw error;
    }
    setNotes(prev => prev.map(n => n.id === optimistic.id ? data : n));
    return data;
  }, []);

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates, updated_at: new Date().toISOString() } : n));
    const { error } = await supabase
      .from('notes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { fetch(); throw error; }
  }, [fetch]);

  const archiveNote = useCallback(async (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    const { error } = await supabase
      .from('notes')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { fetch(); throw error; }
  }, [fetch]);

  const deleteNote = useCallback(async (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) { fetch(); throw error; }
  }, [fetch]);

  const unsortedNotes = notes.filter(n => !n.category_id);
  const sortedNotes = notes.filter(n => !!n.category_id);
  const pendingNotes = notes.filter(n => n.pending_review);

  const getNotesByCategory = useCallback((categoryId: string) => {
    return notes.filter(n => n.category_id === categoryId);
  }, [notes]);

  return {
    notes,
    unsortedNotes,
    sortedNotes,
    pendingNotes,
    loading,
    createNote,
    updateNote,
    archiveNote,
    deleteNote,
    getNotesByCategory,
    refetch: fetch,
  };
}

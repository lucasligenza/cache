import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Note } from '../types';

export function useNoteConnections() {
  const [connections, setConnections] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConnections = useCallback(async (noteId: string) => {
    setLoading(true);
    // Fetch all connection rows where this note appears on either side
    const { data, error } = await supabase
      .from('note_connections')
      .select('source_note_id, target_note_id')
      .or(`source_note_id.eq.${noteId},target_note_id.eq.${noteId}`);

    if (error) { console.error(error); setLoading(false); return; }

    const connectedIds = (data || []).map(row =>
      row.source_note_id === noteId ? row.target_note_id : row.source_note_id
    );

    if (connectedIds.length === 0) {
      setConnections([]);
      setLoading(false);
      return;
    }

    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .in('id', connectedIds)
      .is('archived_at', null);

    if (notesError) { console.error(notesError); }
    setConnections(notes || []);
    setLoading(false);
  }, []);

  const addConnection = useCallback(async (aId: string, bId: string) => {
    // Normalise order to satisfy unique constraint
    const [src, tgt] = aId < bId ? [aId, bId] : [bId, aId];
    const { error } = await supabase
      .from('note_connections')
      .insert({ source_note_id: src, target_note_id: tgt });
    if (error && error.code !== '23505') console.error(error); // ignore duplicate
  }, []);

  const removeConnection = useCallback(async (aId: string, bId: string) => {
    const [src, tgt] = aId < bId ? [aId, bId] : [bId, aId];
    const { error } = await supabase
      .from('note_connections')
      .delete()
      .eq('source_note_id', src)
      .eq('target_note_id', tgt);
    if (error) console.error(error);
  }, []);

  return { connections, loading, fetchConnections, addConnection, removeConnection };
}

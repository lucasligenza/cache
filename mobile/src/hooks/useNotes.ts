import { useNotesCore } from '@cache/core';
import { supabase } from '../lib/supabase';
import { isOnline } from '../lib/online';

export function useNotes(enabled = true, onError?: (msg: string) => void, userId?: string | null) {
  return useNotesCore({
    supabase,
    isOnline,
    enabled,
    onError,
    userId,
  });
}

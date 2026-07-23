import { useNotesCore } from '@cache/core';
import { supabase } from '../lib/supabase';

// The notes data layer + offline-sync orchestration now lives in @cache/core
// (shared with native). Web injects its Supabase client and browser connectivity;
// the public API is unchanged, so callers and tests are untouched.
export function useNotes(enabled = true, onError?: (msg: string) => void) {
  return useNotesCore({
    supabase,
    isOnline: () => navigator.onLine,
    enabled,
    onError,
  });
}

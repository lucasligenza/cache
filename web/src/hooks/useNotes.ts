import { useNotesCore } from '@cache/core';
import { supabase } from '../lib/supabase';
import { subscribeForeground } from '../lib/foreground';

// The notes data layer + offline-sync orchestration now lives in @cache/core
// (shared with native). Web injects its Supabase client, browser connectivity and
// the foreground signal; the public API is unchanged, so callers are untouched.
export function useNotes(
  enabled = true,
  onError?: (msg: string) => void,
  userId?: string | null,
  onRequestError?: (op: string, error: unknown) => void,
) {
  return useNotesCore({
    supabase,
    isOnline: () => navigator.onLine,
    subscribeForeground,
    enabled,
    onError,
    onRequestError,
    userId,
  });
}

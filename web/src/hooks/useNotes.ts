import { useNotesCore } from '@cache/core';
import { supabase } from '../lib/supabase';
import { subscribeForeground } from '../lib/foreground';
import { reportRequestError } from '../lib/requestErrors';

// The notes data layer + offline-sync orchestration now lives in @cache/core
// (shared with native). Web injects its Supabase client, browser connectivity,
// the foreground signal and telemetry; the public API is unchanged.
export function useNotes(
  enabled = true,
  onError?: (msg: string) => void,
  userId?: string | null,
  onRequestError: (op: string, error: unknown) => void = reportRequestError,
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

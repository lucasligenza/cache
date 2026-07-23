import { useAuthCore } from '@cache/core';
import { supabase } from '../lib/supabase';

// Auth now lives in @cache/core (shared with native). Web just injects its client.
export function useAuth() {
  return useAuthCore({ supabase });
}

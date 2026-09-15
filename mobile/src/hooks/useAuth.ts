import { useAuthCore } from '@cache/core';
import { supabase } from '../lib/supabase';

export function useAuth() {
  return useAuthCore({ supabase });
}

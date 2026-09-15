import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';

const { url, anonKey } = getSupabaseConfig();

// Placeholder URL/key keeps createClient from throwing when extras are missing;
// App.tsx gates the UI on isSupabaseConfigured() before any query runs.
export const supabase = createClient(
  url || 'https://example.invalid.supabase.co',
  anonKey || 'public-anon-placeholder',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

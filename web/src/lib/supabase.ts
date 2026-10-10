import { createClient } from '@supabase/supabase-js';
import { createTimeoutFetch } from '@cache/core';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — copy web/.env.example to web/.env and fill in your credentials');
}

// Every request (data + auth) aborts after 15s, so a captive portal or dead
// connection fails fast instead of hanging until the OS TCP timeout.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: createTimeoutFetch<typeof fetch>(15_000) },
});

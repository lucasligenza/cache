import Constants from 'expo-constants';

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

function extra(): Extra {
  return (Constants.expoConfig?.extra ?? {}) as Extra;
}

/** Public Supabase credentials — env wins, app.json extras are the committed fallback. */
export function getSupabaseConfig(): { url: string; anonKey: string } {
  const ex = extra();
  const url = (process.env.EXPO_PUBLIC_SUPABASE_URL || ex.supabaseUrl || '').trim();
  const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ex.supabaseAnonKey || '').trim();
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return false;
  if (anonKey.includes('YOUR_') || url.includes('your-project')) return false;
  return true;
}

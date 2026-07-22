import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; successMessage?: string }>;
  signInAsGuest: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signUp = async (email: string, password: string): Promise<{ error: string | null; successMessage?: string }> => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };

    // Attempt immediate login. If Supabase requires email confirmation,
    // signInWithPassword will fail — we surface a message instead.
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) {
      return {
        error: null,
        successMessage: 'registration successful — check your email to confirm, then sign in',
      };
    }
    return { error: null };
  };

  const signInAsGuest = async (): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut();
  };

  return { user, loading, signIn, signUp, signInAsGuest, signOut };
}

import { useState, useEffect, useRef } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export interface AuthDeps {
  supabase: SupabaseClient;
}

export interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; successMessage?: string }>;
  signInAsGuest: () => Promise<{ error: string | null }>;
  upgradeGuest: (email: string, password: string) => Promise<{ error: string | null; successMessage?: string }>;
  signOut: () => Promise<void>;
}

export function useAuthCore(deps: AuthDeps): UseAuthReturn {
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const auth = () => depsRef.current.supabase.auth;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Resolve the current session immediately on mount — onAuthStateChange only
    // fires on *changes*, so without this `loading` would hang (and the app would
    // flash the login screen) until the first event.
    auth().getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = auth().onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await auth().signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signUp = async (email: string, password: string): Promise<{ error: string | null; successMessage?: string }> => {
    const { error } = await auth().signUp({ email, password });
    if (error) return { error: error.message };

    // Attempt immediate login. If Supabase requires email confirmation,
    // signInWithPassword will fail — we surface a message instead.
    const { error: loginError } = await auth().signInWithPassword({ email, password });
    if (loginError) {
      return {
        error: null,
        successMessage: 'registration successful — check your email to confirm, then sign in',
      };
    }
    return { error: null };
  };

  const signInAsGuest = async (): Promise<{ error: string | null }> => {
    const { error } = await auth().signInAnonymously();
    if (error) return { error: error.message };
    return { error: null };
  };

  // Convert the current anonymous user into a permanent account, preserving
  // their notes (same user_id). If the project requires email confirmation, the
  // change is *pending* (not applied) until the user clicks the link — Supabase
  // signals this via a populated `new_email` on the returned user. Surface that
  // instead of claiming success outright (mirrors signUp's successMessage).
  const upgradeGuest = async (
    email: string,
    password: string
  ): Promise<{ error: string | null; successMessage?: string }> => {
    const { data, error } = await auth().updateUser({ email, password });
    if (error) return { error: error.message };
    const pending = !!(data?.user as { new_email?: string } | null | undefined)?.new_email;
    return {
      error: null,
      successMessage: pending
        ? 'account saved — check your email to confirm your new address'
        : undefined,
    };
  };

  const signOut = async (): Promise<void> => {
    await auth().signOut();
  };

  return { user, loading, signIn, signUp, signInAsGuest, upgradeGuest, signOut };
}

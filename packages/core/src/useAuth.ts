import { useState, useEffect, useRef } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { friendlyAuthError, MIN_PASSWORD_LENGTH } from './authErrors';
import { clearOutboxFor } from './outbox';

export interface AuthDeps {
  supabase: SupabaseClient;
  /** Where reset emails link back to. Must be in the Supabase redirect allow-list. */
  passwordResetRedirectTo?: string;
  /**
   * The app was opened from a password-reset link. Platforms capture this from
   * the launch URL, because the PASSWORD_RECOVERY event can fire before the
   * hook subscribes.
   */
  initialRecovery?: boolean;
  /**
   * Platform teardown while the session is still valid (e.g. drop this device's
   * push subscription so the next person on it doesn't get these reminders).
   * Best-effort: errors are swallowed and it's cut off after a few seconds so
   * logout never hangs offline.
   */
  beforeSignOut?: (user: User) => Promise<void> | void;
}

type AuthResult = { error: string | null; successMessage?: string };

export interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  /** Signed in via a reset link and should choose a new password before continuing. */
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signInAsGuest: () => Promise<{ error: string | null }>;
  upgradeGuest: (email: string, password: string) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
}

export const SIGN_OUT_TEARDOWN_MS = 3000;

async function settleWithin(work: () => Promise<void> | void, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>(resolve => { timer = setTimeout(resolve, ms); });
  try {
    await Promise.race([Promise.resolve().then(work).catch(() => undefined), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function useAuthCore(deps: AuthDeps): UseAuthReturn {
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const auth = () => depsRef.current.supabase.auth;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(() => !!deps.initialRecovery);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  useEffect(() => {
    let mounted = true;

    // Resolve the current session immediately on mount — onAuthStateChange only
    // fires on *changes*, so without this `loading` would hang (and the app would
    // flash the login screen) until the first event.
    auth().getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      // A reset link that didn't produce a session (expired / already used)
      // isn't a recovery — the login screen shows the link error instead.
      if (!data.session) setRecovering(false);
      setLoading(false);
    });

    const { data: { subscription } } = auth().onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
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
    if (error) return { error: friendlyAuthError(error.message) };
    return { error: null };
  };

  const signUp = async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await auth().signUp({ email, password });
    if (error) return { error: friendlyAuthError(error.message) };

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
    if (error) return { error: friendlyAuthError(error.message) };
    return { error: null };
  };

  // Convert the current anonymous user into a permanent account, preserving
  // their notes (same user_id). If the project requires email confirmation, the
  // change is *pending* (not applied) until the user clicks the link — Supabase
  // signals this via a populated `new_email` on the returned user. Surface that
  // instead of claiming success outright (mirrors signUp's successMessage).
  const upgradeGuest = async (email: string, password: string): Promise<AuthResult> => {
    const { data, error } = await auth().updateUser({ email, password });
    if (error) return { error: friendlyAuthError(error.message) };
    const pending = !!(data?.user as { new_email?: string } | null | undefined)?.new_email;
    return {
      error: null,
      successMessage: pending
        ? 'account saved — check your email to confirm your new address'
        : undefined,
    };
  };

  // Supabase answers success whether or not the address has an account (so the
  // form can't be used to probe for users); the copy has to say "if".
  const requestPasswordReset = async (email: string): Promise<AuthResult> => {
    const { error } = await auth().resetPasswordForEmail(email, {
      redirectTo: depsRef.current.passwordResetRedirectTo,
    });
    if (error) return { error: friendlyAuthError(error.message) };
    return {
      error: null,
      successMessage: `if ${email} has an account, a reset link is on its way — check your inbox`,
    };
  };

  const updatePassword = async (password: string): Promise<{ error: string | null }> => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      return { error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` };
    }
    const { error } = await auth().updateUser({ password });
    if (error) return { error: friendlyAuthError(error.message) };
    setRecovering(false);
    return { error: null };
  };

  const signOut = async (): Promise<{ error: string | null }> => {
    const current = userRef.current;
    const teardown = depsRef.current.beforeSignOut;
    if (current && teardown) await settleWithin(() => teardown(current), SIGN_OUT_TEARDOWN_MS);

    // supabase-js drops the local session even when the revoke request fails
    // (e.g. offline), so check what's actually left rather than trusting `error`.
    const { error } = await auth().signOut();
    const { data } = await auth().getSession();
    const signedOut = !data.session;

    if (signedOut && current?.is_anonymous) {
      try { clearOutboxFor(current.id); } catch { /* storage unavailable — nothing to clear */ }
    }
    if (signedOut) setRecovering(false);
    return { error: signedOut ? null : friendlyAuthError(error?.message) };
  };

  return {
    user,
    loading,
    recovering,
    signIn,
    signUp,
    signInAsGuest,
    upgradeGuest,
    requestPasswordReset,
    updatePassword,
    signOut,
  };
}

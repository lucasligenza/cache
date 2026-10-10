import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signInAnonymously: vi.fn(),
      updateUser: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import { useAuthCore, addToOutbox, setOutboxScope, OUTBOX_KEY, SIGN_OUT_TEARDOWN_MS } from '@cache/core';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('useAuth.signUp', () => {
  const mockSignUp = () => vi.mocked(supabase.auth.signUp);
  const mockSignIn = () => vi.mocked(supabase.auth.signInWithPassword);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    } as any);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } } as any);
  });

  it('attempts signIn immediately after successful signUp', async () => {
    mockSignUp().mockResolvedValue({ error: null } as any);
    mockSignIn().mockResolvedValue({ error: null } as any);

    const { result } = renderHook(() => useAuth());
    let response: Awaited<ReturnType<typeof result.current.signUp>>;
    await act(async () => {
      response = await result.current.signUp('a@b.com', 'password123');
    });

    expect(mockSignIn()).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123' });
    expect(response!.error).toBeNull();
    expect(response!.successMessage).toBeUndefined();
  });

  it('returns successMessage when auto-login fails (email confirmation required)', async () => {
    mockSignUp().mockResolvedValue({ error: null } as any);
    mockSignIn().mockResolvedValue({ error: { message: 'Email not confirmed' } } as any);

    const { result } = renderHook(() => useAuth());
    let response: Awaited<ReturnType<typeof result.current.signUp>>;
    await act(async () => {
      response = await result.current.signUp('a@b.com', 'password123');
    });

    expect(response!.error).toBeNull();
    expect(response!.successMessage).toBe(
      'registration successful — check your email to confirm, then sign in'
    );
  });

  it('returns error and does not attempt signIn when signUp fails', async () => {
    mockSignUp().mockResolvedValue({ error: { message: 'Email already registered' } } as any);

    const { result } = renderHook(() => useAuth());
    let response: Awaited<ReturnType<typeof result.current.signUp>>;
    await act(async () => {
      response = await result.current.signUp('a@b.com', 'password123');
    });

    expect(response!.error).toBe('that email already has an account');
    expect(mockSignIn()).not.toHaveBeenCalled();
  });
});

describe('useAuth.getSession bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    } as any);
  });

  it('resolves user + loading from getSession without waiting for an auth event', async () => {
    // onAuthStateChange never fires its callback here — only getSession can resolve state.
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'u1', email: 'a@b.com' } } },
    } as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await Promise.resolve(); });

    expect(result.current.loading).toBe(false);
    expect(result.current.user?.id).toBe('u1');
  });

  it('resolves to signed-out (loading false, user null) when there is no session', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } } as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await Promise.resolve(); });

    expect(result.current.loading).toBe(false);
    expect(result.current.user).toBeNull();
  });
});

describe('useAuth.upgradeGuest', () => {
  const mockUpdate = () => vi.mocked(supabase.auth.updateUser);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    } as any);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } } as any);
  });

  it('returns a confirm-your-email message when the change is pending', async () => {
    mockUpdate().mockResolvedValue({
      data: { user: { id: 'u1', email: 'guest', new_email: 'real@b.com' } },
      error: null,
    } as any);

    const { result } = renderHook(() => useAuth());
    let response: Awaited<ReturnType<typeof result.current.upgradeGuest>>;
    await act(async () => {
      response = await result.current.upgradeGuest('real@b.com', 'password123');
    });

    expect(response!.error).toBeNull();
    expect(response!.successMessage).toMatch(/confirm/i);
  });

  it('returns no message when the upgrade applied immediately', async () => {
    mockUpdate().mockResolvedValue({
      data: { user: { id: 'u1', email: 'real@b.com' } },
      error: null,
    } as any);

    const { result } = renderHook(() => useAuth());
    let response: Awaited<ReturnType<typeof result.current.upgradeGuest>>;
    await act(async () => {
      response = await result.current.upgradeGuest('real@b.com', 'password123');
    });

    expect(response!.error).toBeNull();
    expect(response!.successMessage).toBeUndefined();
  });

  it('surfaces an updateUser error', async () => {
    mockUpdate().mockResolvedValue({ data: { user: null }, error: { message: 'weak password' } } as any);

    const { result } = renderHook(() => useAuth());
    let response: Awaited<ReturnType<typeof result.current.upgradeGuest>>;
    await act(async () => {
      response = await result.current.upgradeGuest('real@b.com', 'x');
    });

    expect(response!.error).toBe('password too weak — use 8+ characters');
    expect(response!.successMessage).toBeUndefined();
  });
});

function resetMocks(session: unknown = null) {
  vi.clearAllMocks();
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  } as any);
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session } } as any);
}

describe('useAuth friendly errors', () => {
  beforeEach(() => resetMocks());

  it('maps bad credentials on sign-in', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ error: { message: 'Invalid login credentials' } } as any);
    const { result } = renderHook(() => useAuth());
    let response: { error: string | null };
    await act(async () => { response = await result.current.signIn('a@b.com', 'nope'); });
    expect(response!.error).toBe('wrong email or password');
  });

  it('maps disabled anonymous sign-ins on guest', async () => {
    vi.mocked(supabase.auth.signInAnonymously).mockResolvedValue({ error: { message: 'Anonymous sign-ins are disabled' } } as any);
    const { result } = renderHook(() => useAuth());
    let response: { error: string | null };
    await act(async () => { response = await result.current.signInAsGuest(); });
    expect(response!.error).toBe('guest mode unavailable — sign up instead');
  });
});

describe('useAuth password reset', () => {
  beforeEach(() => resetMocks());

  it('sends the reset email with the recovery redirect', async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({ data: {}, error: null } as any);
    const { result } = renderHook(() => useAuth());
    let response: Awaited<ReturnType<typeof result.current.requestPasswordReset>>;
    await act(async () => { response = await result.current.requestPasswordReset('a@b.com'); });

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.com', {
      redirectTo: `${window.location.origin}/?auth=recovery`,
    });
    expect(response!.error).toBeNull();
    expect(response!.successMessage).toMatch(/if a@b.com has an account/);
  });

  it('surfaces a rate-limit error', async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({ data: null, error: { message: 'email rate limit exceeded' } } as any);
    const { result } = renderHook(() => useAuth());
    let response: Awaited<ReturnType<typeof result.current.requestPasswordReset>>;
    await act(async () => { response = await result.current.requestPasswordReset('a@b.com'); });
    expect(response!.error).toMatch(/too many attempts/);
  });

  it('enters recovery on PASSWORD_RECOVERY and leaves it once the password is updated', async () => {
    let emit: (event: string, session: unknown) => void = () => {};
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(((cb: typeof emit) => {
      emit = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }) as any);
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({ data: { user: { id: 'u1' } }, error: null } as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.recovering).toBe(false);

    act(() => emit('PASSWORD_RECOVERY', { user: { id: 'u1', email: 'a@b.com' } }));
    expect(result.current.recovering).toBe(true);
    expect(result.current.user?.id).toBe('u1');

    let response: { error: string | null };
    await act(async () => { response = await result.current.updatePassword('brand-new-pass'); });
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'brand-new-pass' });
    expect(response!.error).toBeNull();
    expect(result.current.recovering).toBe(false);
  });

  it('rejects a short new password without calling Supabase', async () => {
    const { result } = renderHook(() => useAuth());
    let response: { error: string | null };
    await act(async () => { response = await result.current.updatePassword('short'); });
    expect(response!.error).toBe('password must be at least 8 characters');
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });
});

describe('useAuthCore signOut', () => {
  const guest = { id: 'guest-1', is_anonymous: true };
  const member = { id: 'user-1', email: 'a@b.com', is_anonymous: false };
  const queued = { id: 'n1', text: 'unsynced', category_id: null, created_at: '2026-01-01T00:00:00Z', attempts: 0 };

  function client(user: unknown, signOutError: unknown = null) {
    let session: unknown = { user };
    return {
      auth: {
        getSession: vi.fn(async () => ({ data: { session } })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        signOut: vi.fn(async () => { session = null; return { error: signOutError }; }),
      },
    } as unknown as SupabaseClient;
  }

  beforeEach(() => {
    localStorage.clear();
    setOutboxScope(null);
  });

  it("clears a guest's leftover queue and runs device teardown first", async () => {
    setOutboxScope(guest.id);
    addToOutbox(queued);
    const supabaseClient = client(guest);
    const order: string[] = [];
    const beforeSignOut = vi.fn(async () => { order.push('teardown'); });
    vi.mocked(supabaseClient.auth.signOut).mockImplementation((async () => {
      order.push('signOut');
      vi.mocked(supabaseClient.auth.getSession).mockResolvedValue({ data: { session: null } } as any);
      return { error: null };
    }) as any);

    const { result } = renderHook(() => useAuthCore({ supabase: supabaseClient, beforeSignOut }));
    await act(async () => { await Promise.resolve(); });

    let response: { error: string | null };
    await act(async () => { response = await result.current.signOut(); });

    expect(beforeSignOut).toHaveBeenCalledWith(guest);
    expect(order).toEqual(['teardown', 'signOut']);
    expect(localStorage.getItem(`${OUTBOX_KEY}:${guest.id}`)).toBeNull();
    expect(response!.error).toBeNull();
  });

  it("keeps a real account's queue so it syncs on next login", async () => {
    setOutboxScope(member.id);
    addToOutbox(queued);
    const { result } = renderHook(() => useAuthCore({ supabase: client(member) }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await result.current.signOut(); });
    expect(localStorage.getItem(`${OUTBOX_KEY}:${member.id}`)).not.toBeNull();
  });

  it('treats an offline revoke failure as signed out (the local session is gone)', async () => {
    const { result } = renderHook(() =>
      useAuthCore({ supabase: client(member, { message: 'Failed to fetch' }) })
    );
    await act(async () => { await Promise.resolve(); });
    let response: { error: string | null };
    await act(async () => { response = await result.current.signOut(); });
    expect(response!.error).toBeNull();
  });

  it('does not let a hung or failing teardown block logout', async () => {
    vi.useFakeTimers();
    try {
      const supabaseClient = client(member);
      const hung = vi.fn(() => new Promise<void>(() => {}));
      const { result } = renderHook(() => useAuthCore({ supabase: supabaseClient, beforeSignOut: hung }));
      await act(async () => { await Promise.resolve(); });

      let done = false;
      await act(async () => {
        const p = result.current.signOut().then(() => { done = true; });
        await vi.advanceTimersByTimeAsync(SIGN_OUT_TEARDOWN_MS);
        await p;
      });
      expect(done).toBe(true);
      expect(supabaseClient.auth.signOut).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

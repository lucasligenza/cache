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
      signOut: vi.fn(),
    },
  },
}));

import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

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

    expect(response!.error).toBe('Email already registered');
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

    expect(response!.error).toBe('weak password');
    expect(response!.successMessage).toBeUndefined();
  });
});

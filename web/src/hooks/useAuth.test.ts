import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useNotes } from './useNotes';

// Build a thennable Supabase chain mock
function makeChain(result: { data: unknown; error: null | { message: string } }) {
  const chain: Record<string, unknown> = {};
  ['select','insert','update','delete','eq','is','in','order','single'].forEach(m => {
    chain[m] = vi.fn(() => chain);
  });
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(result));
  return chain;
}

const mockChain = makeChain({ data: [], error: null });
vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(() => mockChain) },
}));

import { supabase } from '../lib/supabase';

const NOTE = {
  id: '1', text: 'hello', category_id: null, created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z', color: null, remind_at: null,
  pending_review: false, pinned: false, archived_at: null,
};

describe('useNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.from).mockImplementation(() =>
      makeChain({ data: [NOTE], error: null }) as ReturnType<typeof supabase.from>
    );
  });

  it('fetches notes on mount', async () => {
    const { result } = renderHook(() => useNotes());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notes).toHaveLength(1);
    expect(result.current.notes[0].text).toBe('hello');
  });

  it('unsortedNotes contains only notes without category_id', async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.unsortedNotes).toHaveLength(1);
  });

  it('getNotesByCategory filters by category', async () => {
    vi.mocked(supabase.from).mockImplementation(() =>
      makeChain({ data: [{ ...NOTE, category_id: 'cat-1' }], error: null }) as ReturnType<typeof supabase.from>
    );
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.getNotesByCategory('cat-1')).toHaveLength(1);
    expect(result.current.getNotesByCategory('cat-2')).toHaveLength(0);
  });

  it('does not fetch when enabled=false', () => {
    renderHook(() => useNotes(false));
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

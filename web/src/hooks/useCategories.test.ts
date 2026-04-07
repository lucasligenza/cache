import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCategories } from './useCategories';

function makeChain(result: { data: unknown; error: null | { message: string } }) {
  const chain: Record<string, unknown> = {};
  ['select','insert','update','delete','eq','order','single'].forEach(m => {
    chain[m] = vi.fn(() => chain);
  });
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(result));
  return chain;
}

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from '../lib/supabase';

const CAT = { id: 'c1', name: 'Work', color: '#F5A623', created_at: '2026-01-01T00:00:00Z' };

describe('useCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.from).mockImplementation(() =>
      makeChain({ data: [CAT], error: null }) as ReturnType<typeof supabase.from>
    );
  });

  it('fetches categories on mount', async () => {
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categories).toHaveLength(1);
    expect(result.current.categories[0].name).toBe('Work');
  });

  it('does not fetch when enabled=false', () => {
    renderHook(() => useCategories(false));
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

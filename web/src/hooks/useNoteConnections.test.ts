import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNoteConnections } from './useNoteConnections';

function makeChain(result: { data: unknown; error: null }) {
  const chain: Record<string, unknown> = {};
  ['select','insert','delete','eq','or','in','is'].forEach(m => {
    chain[m] = vi.fn(() => chain);
  });
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(result));
  return chain;
}

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from '../lib/supabase';

describe('useNoteConnections', () => {
  it('starts with empty connections and loading=false', () => {
    const { result } = renderHook(() => useNoteConnections());
    expect(result.current.connections).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('fetchConnections sets loading then resolves connections', async () => {
    const NOTE = {
      id: 'n2', text: 'connected', category_id: null, created_at: '', updated_at: '',
      color: null, remind_at: null, pending_review: false, pinned: false, archived_at: null,
    };
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'note_connections') {
        return makeChain({ data: [{ source_note_id: 'n1', target_note_id: 'n2' }], error: null }) as ReturnType<typeof supabase.from>;
      }
      return makeChain({ data: [NOTE], error: null }) as ReturnType<typeof supabase.from>;
    });

    const { result } = renderHook(() => useNoteConnections());
    await act(async () => { await result.current.fetchConnections('n1'); });
    expect(result.current.connections).toHaveLength(1);
    expect(result.current.connections[0].id).toBe('n2');
  });
});

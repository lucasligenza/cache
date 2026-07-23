import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useNotes } from './useNotes';
import { readOutbox, writeOutbox } from '../lib/outbox';

// Captures every insert payload across all chains so ordering can be asserted.
const insertCalls: Array<Record<string, unknown>> = [];

type OpResult = { data: unknown; error: null | { message: string; code?: string } };
type Cfg = Partial<Record<'select' | 'insert' | 'update' | 'delete', OpResult>> | OpResult;

// Thennable Supabase chain mock. Pass a uniform {data,error} for every op, or a
// per-op map ({ select, insert, ... }) to give fetch and insert different results.
function makeChain(cfg: Cfg) {
  const uniform = 'data' in cfg || 'error' in cfg ? (cfg as OpResult) : null;
  const perOp = cfg as Partial<Record<string, OpResult>>;
  const state = { op: 'select' as 'select' | 'insert' | 'update' | 'delete' };
  const chain: Record<string, unknown> = {};
  ['select', 'eq', 'is', 'not', 'in', 'order', 'single'].forEach(m => {
    chain[m] = vi.fn(() => chain);
  });
  chain.insert = vi.fn((payload: Record<string, unknown>) => {
    state.op = 'insert';
    insertCalls.push(payload);
    return chain;
  });
  chain.update = vi.fn(() => { state.op = 'update'; return chain; });
  chain.delete = vi.fn(() => { state.op = 'delete'; return chain; });
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(uniform ?? perOp[state.op] ?? { data: null, error: null }));
  return chain;
}

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }));
import { supabase } from '../lib/supabase';

const NOTE = {
  id: '1', text: 'hello', category_id: null, created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z', color: null, remind_at: null,
  pending_review: false, pinned: false, archived_at: null, reviewed_at: null,
};

function setOnline(v: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: v });
}
function useChain(cfg: Cfg) {
  vi.mocked(supabase.from).mockImplementation(
    () => makeChain(cfg) as unknown as ReturnType<typeof supabase.from>
  );
}

describe('useNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    insertCalls.length = 0;
    setOnline(true);
    useChain({ data: [NOTE], error: null });
  });
  afterEach(() => { vi.restoreAllMocks(); });

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
    useChain({ data: [{ ...NOTE, category_id: 'cat-1' }], error: null });
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.getNotesByCategory('cat-1')).toHaveLength(1);
    expect(result.current.getNotesByCategory('cat-2')).toHaveLength(0);
  });

  it('does not fetch when enabled=false', () => {
    renderHook(() => useNotes(false));
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('sorts pinned notes above unpinned regardless of age', async () => {
    const pinnedOlder = { ...NOTE, id: 'a', pinned: true, created_at: '2026-01-01T00:00:00Z' };
    const unpinnedNewer = { ...NOTE, id: 'b', pinned: false, created_at: '2026-02-01T00:00:00Z' };
    useChain({ data: [unpinnedNewer, pinnedOlder], error: null });
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notes[0].id).toBe('a');
  });

  it('archiveNote removes the note from the active list and returns it', async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let removed: unknown;
    await act(async () => { removed = await result.current.archiveNote('1'); });
    expect((removed as { id: string }).id).toBe('1');
    expect(result.current.notes).toHaveLength(0);
  });

  it('unarchiveNote restores a note to the active list', async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.unarchiveNote({ ...NOTE, id: 'x', archived_at: '2026-01-02T00:00:00Z' });
    });
    expect(result.current.notes.some(n => n.id === 'x')).toBe(true);
  });

  // --- offline-safe capture --------------------------------------------------

  it('createNote queues to the outbox and shows a pending row when offline', async () => {
    setOnline(false);
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.createNote('offline thought'); });

    expect(readOutbox().map(i => i.text)).toEqual(['offline thought']);
    expect(result.current.notes[0].text).toBe('offline thought');
    expect(result.current.notes[0].pending).toBe(true);
  });

  it('createNote resolves and keeps the note when the server insert fails (no loss)', async () => {
    useChain({ select: { data: [NOTE], error: null }, insert: { data: null, error: { message: 'network down' } } });
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Must NOT throw — a failed sync is not a lost thought.
    await act(async () => { await result.current.createNote('keep me'); });

    expect(result.current.notes.some(n => n.text === 'keep me' && n.pending)).toBe(true);
    expect(readOutbox().map(i => i.text)).toContain('keep me');
  });

  it('createNote reconciles the optimistic row with the server row on success', async () => {
    useChain({
      select: { data: [NOTE], error: null },
      insert: { data: { ...NOTE, id: 'srv', text: 'synced' }, error: null },
    });
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.createNote('synced'); });

    expect(readOutbox()).toHaveLength(0);
    const row = result.current.notes.find(n => n.text === 'synced');
    expect(row).toBeTruthy();
    expect(row?.pending).toBeFalsy();
  });

  it('createNote rejects and adds no row when the local outbox write fails', async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });

    await act(async () => {
      await expect(result.current.createNote('cannot save')).rejects.toBeTruthy();
    });
    expect(result.current.notes.some(n => n.text === 'cannot save')).toBe(false);
  });

  it('flushOutbox on mount syncs items queued in a previous session', async () => {
    writeOutbox([{ id: 'q1', text: 'seeded', category_id: null, created_at: '2026-01-05T00:00:00Z', attempts: 0 }]);
    useChain({
      select: { data: [NOTE], error: null },
      insert: { data: { ...NOTE, id: 'q1', text: 'seeded' }, error: null },
    });
    const { result } = renderHook(() => useNotes());

    await waitFor(() => expect(readOutbox()).toHaveLength(0));
    expect(result.current.notes.some(n => n.text === 'seeded' && !n.pending)).toBe(true);
  });

  it('flush treats a 23505 duplicate as already-synced (no duplicate row)', async () => {
    writeOutbox([{ id: 'q1', text: 'seeded', category_id: null, created_at: '2026-01-05T00:00:00Z', attempts: 0 }]);
    useChain({
      select: { data: [NOTE], error: null },
      insert: { data: null, error: { code: '23505', message: 'duplicate key value' } },
    });
    const { result } = renderHook(() => useNotes());

    await waitFor(() => expect(readOutbox()).toHaveLength(0));
    const seeded = result.current.notes.filter(n => n.text === 'seeded');
    expect(seeded).toHaveLength(1);
    expect(seeded[0].pending).toBeFalsy();
  });

  it('flush sends queued items in insertion order, each with its created_at', async () => {
    writeOutbox([
      { id: 'a', text: 'first', category_id: null, created_at: '2026-01-05T00:00:00Z', attempts: 0 },
      { id: 'b', text: 'second', category_id: null, created_at: '2026-01-06T00:00:00Z', attempts: 0 },
    ]);
    useChain({ select: { data: [], error: null }, insert: { data: null, error: null } });
    renderHook(() => useNotes());

    await waitFor(() => expect(readOutbox()).toHaveLength(0));
    expect(insertCalls.map(c => c.id)).toEqual(['a', 'b']);
    expect(insertCalls[0].created_at).toBe('2026-01-05T00:00:00Z');
  });

  it('editing a still-pending note updates its outbox entry', async () => {
    setOnline(false);
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let id = '';
    await act(async () => { id = (await result.current.createNote('draft')).id; });
    await act(async () => { await result.current.updateNote(id, { text: 'draft edited' }); });

    expect(readOutbox()[0].text).toBe('draft edited');
  });

  it('does not attempt to sync while offline, then flushes on reconnect', async () => {
    writeOutbox([{ id: 'q1', text: 'seeded', category_id: null, created_at: '2026-01-05T00:00:00Z', attempts: 0 }]);
    setOnline(false);
    useChain({ select: { data: [], error: null }, insert: { data: null, error: null } });
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(insertCalls).toHaveLength(0);
    expect(readOutbox()).toHaveLength(1);

    setOnline(true);
    await act(async () => { await result.current.flushOutbox(); });
    await waitFor(() => expect(readOutbox()).toHaveLength(0));
  });

  it('archiving a still-pending note removes it from the outbox', async () => {
    setOnline(false);
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let id = '';
    await act(async () => { id = (await result.current.createNote('trash')).id; });
    await act(async () => { await result.current.archiveNote(id); });

    expect(readOutbox()).toHaveLength(0);
  });
});

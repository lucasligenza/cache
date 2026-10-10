import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useNotes } from './useNotes';
import { readOutbox, writeOutbox, setOutboxScope } from '../lib/outbox';

// Captures every write payload across all chains so ordering can be asserted.
const insertCalls: Array<Record<string, unknown>> = [];
const updateCalls: Array<Record<string, unknown>> = [];
const rangeCalls: Array<[number, number]> = [];

type OpResult = { data: unknown; error: null | { message: string; code?: string }; status?: number };
type Op = 'select' | 'insert' | 'update' | 'delete';
// Each op result may be fixed, or computed per call (select gets its range window,
// insert/update their payload). A Promise result lets a test hold a request open.
type OpCfg = OpResult | Promise<OpResult> | ((arg: never) => OpResult | Promise<OpResult>);
type Cfg = Partial<Record<Op, OpCfg>> | OpResult;

// Thennable Supabase chain mock. Pass a uniform {data,error} for every op, or a
// per-op map ({ select, insert, ... }) to give fetch and insert different results.
function makeChain(cfg: Cfg) {
  const uniform = 'data' in cfg || 'error' in cfg ? (cfg as OpResult) : null;
  const perOp = cfg as Partial<Record<Op, OpCfg>>;
  const state: { op: Op; arg: unknown } = { op: 'select', arg: undefined };
  const chain: Record<string, unknown> = {};
  ['select', 'eq', 'is', 'not', 'in', 'order', 'single'].forEach(m => {
    chain[m] = vi.fn(() => chain);
  });
  chain.range = vi.fn((from: number, to: number) => {
    rangeCalls.push([from, to]);
    if (state.op === 'select') state.arg = [from, to];
    return chain;
  });
  chain.insert = vi.fn((payload: Record<string, unknown>) => {
    state.op = 'insert';
    state.arg = payload;
    insertCalls.push(payload);
    return chain;
  });
  chain.update = vi.fn((payload: Record<string, unknown>) => {
    state.op = 'update';
    state.arg = payload;
    updateCalls.push(payload);
    return chain;
  });
  chain.delete = vi.fn(() => { state.op = 'delete'; return chain; });
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
    const c = uniform ?? perOp[state.op] ?? { data: null, error: null };
    const r = typeof c === 'function' ? (c as (a: unknown) => OpResult | Promise<OpResult>)(state.arg) : c;
    return Promise.resolve(r).then(resolve, reject);
  };
  return chain;
}

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }));
import { supabase } from '../lib/supabase';

const NOTE = {
  id: '1', text: 'hello', category_id: null, created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z', color: null, remind_at: null,
  pending_review: false, pinned: false, archived_at: null, reviewed_at: null,
};

const QUEUED = { id: 'q1', text: 'seeded', category_id: null, created_at: '2026-01-05T00:00:00Z', attempts: 0 };

function setOnline(v: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: v });
}
function useChain(cfg: Cfg) {
  vi.mocked(supabase.from).mockImplementation(
    () => makeChain(cfg) as unknown as ReturnType<typeof supabase.from>
  );
}
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
describe('useNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setOutboxScope(null);
    insertCalls.length = 0;
    updateCalls.length = 0;
    rangeCalls.length = 0;
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

  it('queues offline captures under the current user’s scoped key (no bleed)', async () => {
    setOnline(false);
    const { result } = renderHook(() => useNotes(true, undefined, 'user-a'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.createNote('scoped thought'); });

    // Stored under the per-user key, never the legacy unscoped key.
    expect(localStorage.getItem('cn_outbox_v1:user-a')).toContain('scoped thought');
    expect(localStorage.getItem('cn_outbox_v1')).toBeNull();
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

  // --- loading ---------------------------------------------------------------

  it('pages past the 1,000-row cap until a short page comes back', async () => {
    const rows = (n: number, offset: number) =>
      Array.from({ length: n }, (_, i) => ({ ...NOTE, id: `n${offset + i}` }));
    useChain({
      select: (([from]: [number, number]) =>
        ({ data: from === 0 ? rows(1000, 0) : rows(5, 1000), error: null })) as never,
    });
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notes).toHaveLength(1005);
    expect(rangeCalls).toEqual([[0, 999], [1000, 1999]]);
  });

  it('a failed load sets error without a toast and still shows queued notes', async () => {
    writeOutbox([QUEUED]);
    setOnline(false);
    const onError = vi.fn();
    useChain({ select: { data: null, error: { message: 'Failed to fetch' }, status: 0 } });
    const onRequestError = vi.fn();
    const { result } = renderHook(() => useNotes(true, onError, null, onRequestError));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(onError).not.toHaveBeenCalled();
    expect(onRequestError).toHaveBeenCalledWith('load', expect.objectContaining({ message: 'Failed to fetch' }));
    expect(result.current.notes.map(n => n.text)).toEqual(['seeded']);
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
    expect(result.current.pendingCount).toBe(1);
  });

  it('createNote resolves without waiting for a slow server insert', async () => {
    const insert = deferred<OpResult>();
    useChain({ select: { data: [], error: null }, insert: () => insert.promise });
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let resolved = false;
    await act(async () => {
      await result.current.createNote('fast').then(() => { resolved = true; });
    });
    // Resolved while the insert is still hanging; the note is durable locally.
    expect(resolved).toBe(true);
    expect(insertCalls).toHaveLength(1);
    expect(readOutbox().map(i => i.text)).toEqual(['fast']);

    await act(async () => { insert.resolve({ data: null, error: null }); });
    await waitFor(() => expect(readOutbox()).toHaveLength(0));
  });

  it('createNote resolves and keeps the note when the server insert fails (no loss)', async () => {
    useChain({ select: { data: [NOTE], error: null }, insert: { data: null, error: { message: 'network down' } } });
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Must NOT throw — a failed sync is not a lost thought.
    await act(async () => { await result.current.createNote('keep me'); });
    await waitFor(() => expect(insertCalls).toHaveLength(1));

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

    await waitFor(() => expect(readOutbox()).toHaveLength(0));
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
    writeOutbox([QUEUED]);
    useChain({
      select: { data: [NOTE], error: null },
      insert: { data: { ...NOTE, id: 'q1', text: 'seeded' }, error: null },
    });
    const { result } = renderHook(() => useNotes());

    await waitFor(() => expect(readOutbox()).toHaveLength(0));
    expect(result.current.notes.some(n => n.text === 'seeded' && !n.pending)).toBe(true);
  });

  it('flush treats a 23505 duplicate as already-synced (no duplicate row)', async () => {
    writeOutbox([QUEUED]);
    useChain({
      select: { data: [NOTE], error: null },
      insert: { data: null, error: { code: '23505', message: 'duplicate key value' }, status: 409 },
    });
    const { result } = renderHook(() => useNotes());

    await waitFor(() => expect(readOutbox()).toHaveLength(0));
    const seeded = result.current.notes.filter(n => n.text === 'seeded');
    expect(seeded).toHaveLength(1);
    expect(seeded[0].pending).toBeFalsy();
    expect(updateCalls).toHaveLength(0);
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

  it('does not attempt to sync while offline, then flushes on reconnect', async () => {
    writeOutbox([QUEUED]);
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

  // --- queued edits (P2-4) ---------------------------------------------------

  it('editing a still-pending note updates its outbox entry', async () => {
    setOnline(false);
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let id = '';
    await act(async () => { id = (await result.current.createNote('draft')).id; });
    await act(async () => { await result.current.updateNote(id, { text: 'draft edited' }); });

    expect(readOutbox()[0].text).toBe('draft edited');
    expect(updateCalls).toHaveLength(0); // no server row to update yet
  });

  it('pin, flag and reminder edits on a queued note ride along with the insert', async () => {
    setOnline(false);
    useChain({ select: { data: [], error: null }, insert: { data: null, error: null } });
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let id = '';
    await act(async () => { id = (await result.current.createNote('todo')).id; });
    await act(async () => {
      await result.current.updateNote(id, { pinned: true });
      await result.current.updateNote(id, { pending_review: true });
      await result.current.updateNote(id, { remind_at: '2026-03-01T09:00:00Z' });
    });

    setOnline(true);
    await act(async () => { await result.current.flushOutbox(); });
    await waitFor(() => expect(readOutbox()).toHaveLength(0));
    expect(insertCalls[0]).toMatchObject({ id, text: 'todo', pinned: true, pending_review: true, remind_at: '2026-03-01T09:00:00Z' });
  });

  it('archiving a still-queued note keeps it queued and syncs it as archived; undo restores it', async () => {
    setOnline(false);
    useChain({ select: { data: [], error: null }, insert: { data: null, error: null } });
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let id = '';
    await act(async () => { id = (await result.current.createNote('trash me')).id; });
    let removed: unknown;
    await act(async () => { removed = await result.current.archiveNote(id); });

    expect(removed).toBeTruthy();
    expect(result.current.notes.some(n => n.id === id)).toBe(false);
    expect(result.current.archived.some(n => n.id === id)).toBe(true);
    expect(readOutbox()[0].archived_at).toBeTruthy();
    expect(updateCalls).toHaveLength(0);

    // Undo → back in the active list, still queued, no longer archived.
    await act(async () => { await result.current.unarchiveNote(removed as never); });
    expect(result.current.notes.some(n => n.id === id)).toBe(true);
    expect(readOutbox()[0].archived_at).toBeNull();

    // Archive again and sync: the insert carries archived_at, so it lands in trash.
    await act(async () => { await result.current.archiveNote(id); });
    setOnline(true);
    await act(async () => { await result.current.flushOutbox(); });
    await waitFor(() => expect(readOutbox()).toHaveLength(0));
    expect(insertCalls[0].archived_at).toBeTruthy();
  });

  it('an edit made while the insert is in flight is sent as a follow-up update', async () => {
    const insert = deferred<OpResult>();
    useChain({ select: { data: [], error: null }, insert: () => insert.promise, update: { data: null, error: null } });
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let id = '';
    await act(async () => { id = (await result.current.createNote('v1')).id; });
    await act(async () => { await result.current.updateNote(id, { text: 'v2' }); });
    expect(insertCalls[0].text).toBe('v1');

    await act(async () => { insert.resolve({ data: null, error: null }); });
    await waitFor(() => expect(readOutbox()).toHaveLength(0));
    expect(updateCalls[updateCalls.length - 1]).toMatchObject({ text: 'v2' });
  });

  it('permanently deleting a queued note removes it from the outbox', async () => {
    setOnline(false);
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let id = '';
    await act(async () => { id = (await result.current.createNote('gone')).id; });
    await act(async () => { await result.current.deleteNote(id); });

    expect(readOutbox()).toHaveLength(0);
    expect(result.current.notes.some(n => n.id === id)).toBe(false);
  });

  // --- poisoned items (P1-4) -------------------------------------------------

  it('retries with no category when the queued note’s directory was deleted (23503)', async () => {
    writeOutbox([{ ...QUEUED, category_id: 'deleted-cat' }]);
    useChain({
      select: { data: [], error: null },
      insert: ((p: Record<string, unknown>) =>
        p.category_id
          ? { data: null, error: { code: '23503', message: 'violates foreign key constraint' }, status: 409 }
          : { data: { ...NOTE, id: 'q1', text: 'seeded' }, error: null }) as never,
    });
    const { result } = renderHook(() => useNotes());

    await waitFor(() => expect(readOutbox()).toHaveLength(0));
    expect(insertCalls.map(c => c.category_id)).toEqual(['deleted-cat', null]);
    expect(result.current.unsortedNotes.some(n => n.id === 'q1')).toBe(true);
  });

  it('dead-letters a permanent rejection, surfaces it, and stops retrying', async () => {
    writeOutbox([QUEUED]);
    const onRequestError = vi.fn();
    useChain({
      select: { data: [], error: null },
      insert: { data: null, error: { code: '23514', message: 'note too long' }, status: 400 },
    });
    const { result } = renderHook(() => useNotes(true, undefined, null, onRequestError));

    await waitFor(() => expect(result.current.syncIssues).toHaveLength(1));
    expect(result.current.syncIssues[0]).toMatchObject({ id: 'q1', syncError: 'note too long' });
    expect(readOutbox()[0]).toMatchObject({ failed: true, attempts: 1 });
    expect(result.current.notes.find(n => n.id === 'q1')?.syncError).toBe('note too long');
    expect(result.current.notes.find(n => n.id === 'q1')?.pending).toBe(true);
    expect(result.current.pendingCount).toBe(0);
    expect(onRequestError).toHaveBeenCalledWith('sync', expect.objectContaining({ code: '23514' }));

    await act(async () => { await result.current.flushOutbox({ force: true }); });
    expect(insertCalls).toHaveLength(1);
  });

  it('retrySync re-queues a dead-lettered note and syncs it', async () => {
    writeOutbox([{ ...QUEUED, failed: true, attempts: 3, last_error: 'boom' }]);
    useChain({ select: { data: [], error: null }, insert: { data: { ...NOTE, id: 'q1', text: 'seeded' }, error: null } });
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.syncIssues).toHaveLength(1);
    expect(insertCalls).toHaveLength(0);

    await act(async () => { await result.current.retrySync('q1'); });
    expect(readOutbox()).toHaveLength(0);
    expect(result.current.syncIssues).toHaveLength(0);
  });

  it('editing a dead-lettered note clears the failure and retries it', async () => {
    writeOutbox([{ ...QUEUED, failed: true, attempts: 1, last_error: 'note too long' }]);
    useChain({ select: { data: [], error: null }, insert: { data: null, error: null } });
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.updateNote('q1', { text: 'shorter' }); });
    await waitFor(() => expect(readOutbox()).toHaveLength(0));
    expect(insertCalls[0].text).toBe('shorter');
    expect(result.current.syncIssues).toHaveLength(0);
  });

  it('backs off after a transient failure: skipped by a normal flush, retried when forced', async () => {
    writeOutbox([QUEUED]);
    useChain({
      select: { data: [], error: null },
      insert: { data: null, error: { code: '', message: 'TypeError: Failed to fetch' }, status: 0 },
    });
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(readOutbox()[0].attempts).toBe(1));
    const item = readOutbox()[0];
    expect(item.failed).toBeFalsy();
    expect(item.next_attempt_at).toBeGreaterThan(Date.now());

    await act(async () => { await result.current.flushOutbox(); });
    expect(insertCalls).toHaveLength(1);

    await act(async () => { await result.current.flushOutbox({ force: true }); });
    expect(insertCalls).toHaveLength(2);
    expect(readOutbox()[0].attempts).toBe(2);
    expect(result.current.syncIssues).toHaveLength(0);
  });

  // --- foreground refresh (P1-8) ---------------------------------------------

  it('refetches when the network comes back, so captures from other devices appear', async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    useChain({ data: [NOTE, { ...NOTE, id: 'phone', text: 'from phone' }], error: null });
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(result.current.notes.some(n => n.id === 'phone')).toBe(true));
  });

  it('refetches on return to the foreground, throttled to one per 5s', async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const fromCalls = () => vi.mocked(supabase.from).mock.calls.length;
    const visible = () => document.dispatchEvent(new Event('visibilitychange'));

    const start = fromCalls();
    await act(async () => { visible(); });
    expect(fromCalls()).toBe(start); // just loaded — throttled

    const realNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(realNow + 6_000);
    useChain({ data: [NOTE, { ...NOTE, id: 'phone', text: 'from phone' }], error: null });
    await act(async () => { visible(); });
    await waitFor(() => expect(result.current.notes.some(n => n.id === 'phone')).toBe(true));
  });

  it('a refetch never hides queued notes and keeps their local edits', async () => {
    writeOutbox([{ ...QUEUED, id: '1', text: 'edited offline', rev: 1 }]);
    setOnline(false);
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    // The server copy of id 1 says 'hello'; the queued edit wins.
    expect(result.current.notes.filter(n => n.id === '1').map(n => n.text)).toEqual(['edited offline']);
  });
});

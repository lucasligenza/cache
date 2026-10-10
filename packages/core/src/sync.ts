// Pure sync policy shared by web and native: how to classify a failed outbox
// sync, how long to back off, how to page past PostgREST's row cap, and a fetch
// wrapper that bounds every request. No platform APIs are referenced directly —
// core compiles against plain ES2020, so timers and fetch go through globalThis.

/** Supabase/PostgREST error surface we care about (PostgrestError is a superset). */
export interface SyncErrorLike {
  code?: string;
  message?: string;
}

/**
 * What to do with a queued note whose insert failed:
 * - `duplicate`: the row already exists (an earlier attempt landed) — treat as synced.
 * - `missing-category`: FK violation — the target directory was deleted while queued.
 * - `transient`: network / timeout / server hiccup / expired session — retry with backoff.
 * - `permanent`: the server will never accept this payload as-is — stop and surface it.
 */
export type SyncErrorKind = 'duplicate' | 'missing-category' | 'transient' | 'permanent';

// Postgres SQLSTATE classes that indicate a condition which can clear on its own:
// 08 connection, 40 transaction rollback (serialization/deadlock), 53 insufficient
// resources, 57 operator intervention (statement timeout, admin shutdown).
const TRANSIENT_SQLSTATE_CLASSES = ['08', '40', '53', '57'];
// PostgREST JWT problems resolve once supabase-js refreshes the session.
const TRANSIENT_POSTGREST = ['PGRST301', 'PGRST302', 'PGRST303'];

export function classifySyncError(error: SyncErrorLike | null | undefined, status?: number): SyncErrorKind {
  const code = error?.code ?? '';
  if (code === '23505') return 'duplicate';
  if (code === '23503') return 'missing-category';
  if (TRANSIENT_POSTGREST.includes(code)) return 'transient';
  if (code && TRANSIENT_SQLSTATE_CLASSES.includes(code.slice(0, 2))) return 'transient';
  // No status / status 0 = the request never got an HTTP answer (offline, DNS,
  // CORS, abort/timeout). 401 = session needs a refresh. 408/429/5xx = retry later.
  if (status === undefined || status === 0) return code ? 'permanent' : 'transient';
  if (status === 401 || status === 408 || status === 429 || status >= 500) return 'transient';
  // Any other answered 4xx (RLS denial 42501, check/length violation 23514/22001,
  // unknown column, bad payload) will fail identically on every retry.
  if (status >= 400) return 'permanent';
  return code ? 'permanent' : 'transient';
}

export const RETRY_BASE_MS = 5_000;
export const RETRY_MAX_MS = 5 * 60_000;

/** Exponential backoff for the n-th consecutive transient failure (1-based): 5s, 10s, 20s … capped at 5 min. */
export function retryDelayMs(attempts: number): number {
  const n = Math.max(1, attempts);
  return Math.min(RETRY_BASE_MS * 2 ** (n - 1), RETRY_MAX_MS);
}

/** Supabase's default `max_rows`; a page shorter than this is the last one. */
export const PAGE_SIZE = 1000;

/**
 * Load every row of a query by walking `.range()` windows until a short page comes
 * back, so lists never silently stop at PostgREST's 1,000-row cap. `page(from, to)`
 * builds the query for one inclusive window. Rows are de-duplicated by id because
 * an insert landing mid-walk can shift offset windows by one.
 */
export async function fetchAllPages<T extends { id: string }>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize: number = PAGE_SIZE,
): Promise<{ data: T[]; error: unknown }> {
  const out: T[] = [];
  const seen = new Set<string>();
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) return { data: out, error };
    const rows = data ?? [];
    for (const r of rows) {
      if (!seen.has(r.id)) { seen.add(r.id); out.push(r); }
    }
    if (rows.length < pageSize) return { data: out, error: null };
  }
}

// Minimal structural types so core doesn't need the DOM lib.
interface AbortSignalLike {
  aborted: boolean;
  reason?: unknown;
  addEventListener(type: 'abort', cb: () => void, opts?: { once?: boolean }): void;
  removeEventListener(type: 'abort', cb: () => void): void;
}
interface AbortControllerLike {
  signal: AbortSignalLike;
  abort(reason?: unknown): void;
}
type RequestInitLike = { signal?: AbortSignalLike | null } & Record<string, unknown>;
export type FetchLike = (input: never, init?: never) => Promise<unknown>;

interface TimerGlobals {
  setTimeout(cb: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  AbortController: new () => AbortControllerLike;
  fetch: FetchLike;
}
const timers = () => globalThis as unknown as TimerGlobals;

/** Run `cb` after `ms`; returns a cancel function. */
export function later(cb: () => void, ms: number): () => void {
  const g = timers();
  const h = g.setTimeout(cb, ms);
  return () => g.clearTimeout(h);
}

/**
 * Why the app is asking for a refresh: it came back to the foreground (tab visible,
 * PWA resumed, native AppState active) or the network came back.
 */
export type ForegroundReason = 'foreground' | 'online';
/** Platform hook: call `cb` on foreground/online; return an unsubscribe. */
export type SubscribeForeground = (cb: (reason: ForegroundReason) => void) => () => void;

/** Minimum gap between foreground-triggered refetches, so tab flicking doesn't spam the API. */
export const FOREGROUND_REFETCH_MIN_MS = 5_000;

export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

// Named AbortError so supabase-js treats it as a cancellation and returns an
// error right away, rather than re-running a timed-out GET up to 3 more times.
function timeoutError(ms: number): Error {
  const e = new Error(`request timed out after ${ms}ms`);
  e.name = 'AbortError';
  return e;
}

/**
 * Wrap `fetch` so every request aborts after `timeoutMs` (default 15s). Pass the
 * result as `createClient(url, key, { global: { fetch } })`. Without it a request on
 * a captive portal / "lie-fi" hangs until the OS TCP timeout — minutes. A caller's
 * own abort signal is still honoured. Typed generically so the same wrapper works
 * with the DOM `fetch` (web) and React Native's.
 */
export function createTimeoutFetch<F extends FetchLike>(
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
  base?: F,
): F {
  const wrapped = (input: unknown, init?: RequestInitLike) => {
    const g = timers();
    const doFetch = (base ?? g.fetch) as unknown as (i: unknown, o?: RequestInitLike) => Promise<unknown>;
    const ctrl = new g.AbortController();
    const outer = init?.signal ?? null;
    const forward = () => ctrl.abort(outer?.reason);
    if (outer) {
      if (outer.aborted) ctrl.abort(outer.reason);
      else outer.addEventListener('abort', forward, { once: true });
    }
    const timer = g.setTimeout(() => ctrl.abort(timeoutError(timeoutMs)), timeoutMs);
    return doFetch(input, { ...(init ?? {}), signal: ctrl.signal }).finally(() => {
      g.clearTimeout(timer);
      outer?.removeEventListener('abort', forward);
    });
  };
  return wrapped as unknown as F;
}

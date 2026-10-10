// Provider-agnostic error telemetry. Inert until a destination is configured:
//  - `VITE_SENTRY_DSN`: events go to Sentry's envelope endpoint (no SDK needed;
//    raw stacks ride along in `extra` since frames aren't parsed/symbolicated).
//  - `VITE_ERROR_REPORT_URL`: every report is POSTed as JSON to your own collector.
// Both may be set. Bodies are sent as text/plain so cross-origin beacons stay
// CORS-simple (no preflight, which sendBeacon can't do). Telemetry must NEVER throw.

export type ErrorKind = 'react' | 'window' | 'unhandledrejection' | 'manual';

type Lazy = string | undefined | (() => string | undefined);

export interface TelemetryOptions {
  /** Collector URL, or a getter (read lazily so env can change / be stubbed in tests). */
  endpoint?: Lazy;
  /** Sentry DSN (`https://<key>@<host>/<project>`), or a getter. */
  dsn?: Lazy;
  release?: string;
  environment?: string;
  maxPerSession?: number;
  isDev?: boolean;
  /** Injectable transport (defaults to sendBeacon, falling back to fetch keepalive). */
  send?: (url: string, body: string) => void;
}

function defaultSend(url: string, body: string) {
  try {
    const queued =
      typeof navigator !== 'undefined' &&
      typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon(url, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
    if (!queued) {
      fetch(url, { method: 'POST', body, keepalive: true, mode: 'cors', credentials: 'omit' }).catch(() => {});
    }
  } catch {
    /* ignore transport errors */
  }
}

function normalize(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) return { name: error.name || 'Error', message: error.message, stack: error.stack };
  if (typeof error === 'string') return { name: 'Error', message: error };
  try {
    return { name: 'Error', message: JSON.stringify(error) };
  } catch {
    return { name: 'Error', message: String(error) };
  }
}

/** Sentry envelope URL for a DSN, or null if the DSN is malformed. */
export function sentryEnvelopeUrl(dsn: string): string | null {
  try {
    const u = new URL(dsn);
    const segments = u.pathname.split('/').filter(Boolean);
    const project = segments.pop();
    if (!u.username || !project) return null;
    const prefix = segments.length ? '/' + segments.join('/') : '';
    return `${u.protocol}//${u.host}${prefix}/api/${project}/envelope/?sentry_key=${encodeURIComponent(u.username)}&sentry_version=7`;
  } catch {
    return null;
  }
}

function eventId(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '');
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

const read = (v: Lazy) => (typeof v === 'function' ? v() : v) || undefined;

export function createTelemetry(opts: TelemetryOptions = {}) {
  const seen = new Set<string>();
  let sent = 0;
  const max = opts.maxPerSession ?? 20;
  const isDev = opts.isDev ?? false;
  const send = opts.send ?? defaultSend;

  function reportError(error: unknown, kind: ErrorKind = 'manual', context?: Record<string, unknown>) {
    try {
      const err = normalize(error);
      const key = `${kind}:${err.message}`;
      if (seen.has(key)) return; // dedupe identical errors within the session
      seen.add(key);
      if (isDev) console.error('[telemetry]', kind, err.message, error);

      const endpoint = read(opts.endpoint);
      const dsn = read(opts.dsn);
      const sentryUrl = dsn ? sentryEnvelopeUrl(dsn) : null;
      if ((!endpoint && !sentryUrl) || sent >= max) return;
      sent++;

      const url = typeof location !== 'undefined' ? location.href : undefined;
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
      const ts = new Date();

      if (endpoint) {
        send(endpoint, JSON.stringify({
          message: err.message,
          stack: err.stack,
          kind,
          release: opts.release,
          environment: opts.environment,
          url,
          userAgent,
          ts: ts.toISOString(),
          context,
        }));
      }

      if (sentryUrl && dsn) {
        const id = eventId();
        const event = {
          event_id: id,
          timestamp: ts.getTime() / 1000,
          platform: 'javascript',
          level: 'error',
          logger: kind,
          release: opts.release,
          environment: opts.environment,
          exception: { values: [{ type: err.name, value: err.message }] },
          request: url ? { url, headers: userAgent ? { 'User-Agent': userAgent } : undefined } : undefined,
          tags: { kind },
          extra: { stack: err.stack, ...context },
        };
        const envelope = [
          JSON.stringify({ event_id: id, sent_at: ts.toISOString(), dsn }),
          JSON.stringify({ type: 'event' }),
          JSON.stringify(event),
        ].join('\n');
        send(sentryUrl, envelope);
      }
    } catch {
      /* telemetry must never throw and take the app down with it */
    }
  }

  let installed = false;
  function init() {
    if (installed || typeof window === 'undefined') return;
    installed = true;
    window.addEventListener('error', (e: ErrorEvent) => reportError(e.error ?? e.message, 'window'));
    window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) =>
      reportError(e.reason, 'unhandledrejection')
    );
  }

  return { reportError, init };
}

// Web singleton wired to the Vite env. `VITE_RELEASE` defaults to the commit SHA
// on Vercel builds and `VITE_DEPLOY_ENV` to the Vercel environment (vite.config.ts).
export const telemetry = createTelemetry({
  endpoint: () => import.meta.env.VITE_ERROR_REPORT_URL as string | undefined,
  dsn: () => import.meta.env.VITE_SENTRY_DSN as string | undefined,
  release: import.meta.env.VITE_RELEASE as string | undefined,
  environment: (import.meta.env.VITE_DEPLOY_ENV as string | undefined) || import.meta.env.MODE,
  isDev: import.meta.env.DEV,
});

export const reportError = telemetry.reportError;
export const initTelemetry = telemetry.init;

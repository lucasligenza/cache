// Provider-agnostic error telemetry. Inert until `VITE_ERROR_REPORT_URL` is set;
// then every crash/rejection is POSTed as JSON to that collector (your own
// endpoint, a serverless function, a Sentry tunnel, …). Swap in a vendor SDK
// later by replacing the `send` transport. Telemetry must NEVER throw.

export type ErrorKind = 'react' | 'window' | 'unhandledrejection' | 'manual';

export interface TelemetryOptions {
  /** Collector URL, or a getter (read lazily so env can change / be stubbed in tests). */
  endpoint?: string | (() => string | undefined);
  release?: string;
  maxPerSession?: number;
  isDev?: boolean;
  /** Injectable transport (defaults to sendBeacon, falling back to fetch keepalive). */
  send?: (url: string, body: string) => void;
}

function defaultSend(url: string, body: string) {
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    } else {
      fetch(url, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* ignore transport errors */
  }
}

function normalize(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) return { message: error.message, stack: error.stack };
  if (typeof error === 'string') return { message: error };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

export function createTelemetry(opts: TelemetryOptions = {}) {
  const seen = new Set<string>();
  let sent = 0;
  const max = opts.maxPerSession ?? 20;
  const isDev = opts.isDev ?? false;
  const send = opts.send ?? defaultSend;
  const getEndpoint =
    typeof opts.endpoint === 'function' ? opts.endpoint : () => opts.endpoint as string | undefined;

  function reportError(error: unknown, kind: ErrorKind = 'manual', context?: Record<string, unknown>) {
    try {
      const err = normalize(error);
      const key = `${kind}:${err.message}`;
      if (seen.has(key)) return; // dedupe identical errors within the session
      seen.add(key);
      if (isDev) console.error('[telemetry]', kind, err.message, error);

      const endpoint = getEndpoint();
      if (!endpoint || sent >= max) return;
      sent++;

      const payload = {
        message: err.message,
        stack: err.stack,
        kind,
        release: opts.release,
        url: typeof location !== 'undefined' ? location.href : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        ts: new Date().toISOString(),
        context,
      };
      send(endpoint, JSON.stringify(payload));
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

// Web singleton wired to the Vite env. `VITE_RELEASE` (optional) tags reports with
// a build/commit id.
export const telemetry = createTelemetry({
  endpoint: () => import.meta.env.VITE_ERROR_REPORT_URL as string | undefined,
  release: import.meta.env.VITE_RELEASE as string | undefined,
  isDev: import.meta.env.DEV,
});

export const reportError = telemetry.reportError;
export const initTelemetry = telemetry.init;

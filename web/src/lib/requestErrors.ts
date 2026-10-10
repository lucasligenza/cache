import { reportError } from './telemetry';

// Bridges the core data hooks' `onRequestError(op, error)` to telemetry. Supabase
// errors are plain objects whose `details` can hold a full stack, so report a
// short `op: message` and keep the code/hint as context. Failures while the
// device is offline are expected (the outbox covers them) and aren't reported.
export function reportRequestError(op: string, error: unknown): void {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const e = (error ?? {}) as { message?: string; code?: string; hint?: string };
  const message = e.message || (error instanceof Error ? error.message : String(error));
  reportError(`${op}: ${message}`, 'manual', {
    source: 'supabase',
    op,
    ...(e.code ? { code: e.code } : {}),
    ...(e.hint ? { hint: e.hint } : {}),
  });
}

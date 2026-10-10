import { describe, it, expect, vi } from 'vitest';
import { createTelemetry, sentryEnvelopeUrl } from './telemetry';

function make(endpoint: string | undefined = 'https://collector.example/err', extra = {}) {
  const send = vi.fn();
  const t = createTelemetry({ endpoint, send, isDev: false, ...extra });
  return { t, send };
}

describe('telemetry', () => {
  it('does nothing when no endpoint is configured (inert until set up)', () => {
    const send = vi.fn();
    const t = createTelemetry({ send, isDev: false }); // no endpoint
    t.reportError(new Error('boom'));
    expect(send).not.toHaveBeenCalled();
  });

  it('reports an error to the endpoint as a JSON payload', () => {
    const { t, send } = make();
    t.reportError(new Error('kaboom'), 'react', { view: 'buffer' });
    expect(send).toHaveBeenCalledTimes(1);
    const [url, body] = send.mock.calls[0];
    expect(url).toBe('https://collector.example/err');
    const payload = JSON.parse(body as string);
    expect(payload.message).toBe('kaboom');
    expect(payload.kind).toBe('react');
    expect(payload.context).toEqual({ view: 'buffer' });
    expect(typeof payload.ts).toBe('string');
  });

  it('dedupes identical errors within a session', () => {
    const { t, send } = make();
    t.reportError(new Error('same'));
    t.reportError(new Error('same'));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('reports distinct errors separately', () => {
    const { t, send } = make();
    t.reportError(new Error('a'));
    t.reportError(new Error('b'));
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('caps the number of reports per session', () => {
    const { t, send } = make('https://x', { maxPerSession: 2 });
    t.reportError(new Error('e1'));
    t.reportError(new Error('e2'));
    t.reportError(new Error('e3'));
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('builds the Sentry envelope URL from a DSN', () => {
    expect(sentryEnvelopeUrl('https://abc123@o42.ingest.us.sentry.io/4507')).toBe(
      'https://o42.ingest.us.sentry.io/api/4507/envelope/?sentry_key=abc123&sentry_version=7'
    );
    expect(sentryEnvelopeUrl('https://k@sentry.example.com/prefix/7')).toBe(
      'https://sentry.example.com/prefix/api/7/envelope/?sentry_key=k&sentry_version=7'
    );
    expect(sentryEnvelopeUrl('not a dsn')).toBeNull();
    expect(sentryEnvelopeUrl('https://sentry.example.com/7')).toBeNull();
  });

  it('sends a Sentry envelope when only a DSN is configured', () => {
    const send = vi.fn();
    const t = createTelemetry({ dsn: 'https://abc@o1.ingest.sentry.io/99', release: 'sha1', environment: 'production', send, isDev: false });
    t.reportError(new TypeError('nope'), 'window', { view: 'board' });
    expect(send).toHaveBeenCalledTimes(1);
    const [url, body] = send.mock.calls[0] as [string, string];
    expect(url).toBe('https://o1.ingest.sentry.io/api/99/envelope/?sentry_key=abc&sentry_version=7');
    const [header, item, event] = body.split('\n').map(l => JSON.parse(l));
    expect(header.dsn).toBe('https://abc@o1.ingest.sentry.io/99');
    expect(item).toEqual({ type: 'event' });
    expect(event.event_id).toMatch(/^[0-9a-f]{32}$/);
    expect(header.event_id).toBe(event.event_id);
    expect(event.exception.values[0]).toEqual({ type: 'TypeError', value: 'nope' });
    expect(event.release).toBe('sha1');
    expect(event.environment).toBe('production');
    expect(event.tags).toEqual({ kind: 'window' });
    expect(event.extra.view).toBe('board');
  });

  it('sends to both destinations when both are configured, counting one report', () => {
    const send = vi.fn();
    const t = createTelemetry({ endpoint: 'https://collector', dsn: 'https://k@s.io/1', maxPerSession: 1, send, isDev: false });
    t.reportError(new Error('one'));
    t.reportError(new Error('two'));
    expect(send.mock.calls.map(c => c[0])).toEqual(['https://collector', 'https://s.io/api/1/envelope/?sentry_key=k&sentry_version=7']);
  });

  it('stays inert with a malformed DSN', () => {
    const send = vi.fn();
    createTelemetry({ dsn: 'garbage', send, isDev: false }).reportError(new Error('x'));
    expect(send).not.toHaveBeenCalled();
  });

  it('beacons as text/plain so cross-origin collectors need no CORS preflight', async () => {
    const beacon = vi.fn((_url: string, _data?: BodyInit | null) => true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: beacon });
    try {
      createTelemetry({ endpoint: 'https://collector', isDev: false }).reportError(new Error('beam'));
      expect(beacon).toHaveBeenCalledTimes(1);
      const blob = beacon.mock.calls[0][1] as Blob;
      expect(blob.type).toBe('text/plain;charset=utf-8');
      const text = await new Promise<string>(resolve => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.readAsText(blob);
      });
      expect(JSON.parse(text).message).toBe('beam');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('never throws, even when the transport fails or the value is not an Error', () => {
    const send = vi.fn(() => { throw new Error('transport down'); });
    const t = createTelemetry({ endpoint: 'https://x', send, isDev: false });
    expect(() => t.reportError('a plain string')).not.toThrow();
  });
});

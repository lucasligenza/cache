import { describe, it, expect, vi } from 'vitest';
import { createTelemetry } from './telemetry';

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

  it('never throws, even when the transport fails or the value is not an Error', () => {
    const send = vi.fn(() => { throw new Error('transport down'); });
    const t = createTelemetry({ endpoint: 'https://x', send, isDev: false });
    expect(() => t.reportError('a plain string')).not.toThrow();
  });
});

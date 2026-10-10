import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./telemetry', () => ({ reportError: vi.fn() }));
import { reportError } from './telemetry';
import { reportRequestError } from './requestErrors';

function setOnline(v: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: v });
}

describe('reportRequestError', () => {
  beforeEach(() => { vi.clearAllMocks(); setOnline(true); });

  it('reports a Supabase error as a short message with code and hint as context', () => {
    reportRequestError('sync', {
      message: 'new row violates check constraint',
      code: '23514',
      hint: null,
      details: 'a very long stack…',
    });
    expect(reportError).toHaveBeenCalledWith('sync: new row violates check constraint', 'manual', {
      source: 'supabase',
      op: 'sync',
      code: '23514',
    });
  });

  it('handles Error instances', () => {
    reportRequestError('load', new Error('request timed out after 15000ms'));
    expect(reportError).toHaveBeenCalledWith('load: request timed out after 15000ms', 'manual', { source: 'supabase', op: 'load' });
  });

  it('stays quiet while the device is offline', () => {
    setOnline(false);
    reportRequestError('load', { message: 'TypeError: Failed to fetch' });
    expect(reportError).not.toHaveBeenCalled();
  });
});

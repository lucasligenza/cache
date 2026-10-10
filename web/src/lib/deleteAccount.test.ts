import { describe, it, expect, vi } from 'vitest';
import {
  deletionErrorMessage,
  deletionSucceeded,
  runAccountDeletion,
  type AccountDeletionClient,
  type InvokeResult,
} from './deleteAccount';

function client(overrides: Partial<AccountDeletionClient> = {}): AccountDeletionClient {
  return {
    invoke: vi.fn(async () => ({ data: { ok: true }, error: null })),
    dropDevicePush: vi.fn(async () => undefined),
    clearLocal: vi.fn(),
    signOutLocal: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('deletionSucceeded', () => {
  it('requires ok: true', () => {
    expect(deletionSucceeded({ ok: true })).toBe(true);
    expect(deletionSucceeded({ ok: false })).toBe(false);
    expect(deletionSucceeded(null)).toBe(false);
    expect(deletionSucceeded({ error: 'nope' })).toBe(false);
  });
});

describe('deletionErrorMessage', () => {
  it('explains a missing function', async () => {
    const result: InvokeResult = {
      data: null,
      error: { name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code', context: { status: 404 } },
    };
    expect(await deletionErrorMessage(result)).toBe("account deletion isn't available yet — try again later");
  });

  it('explains a network failure', async () => {
    const result: InvokeResult = {
      data: null,
      error: { name: 'FunctionsFetchError', message: 'Failed to send a request to the Edge Function' },
    };
    expect(await deletionErrorMessage(result)).toBe("couldn't reach the server — try again");
  });

  it('prefers the server message on a 500', async () => {
    const result: InvokeResult = {
      data: null,
      error: {
        name: 'FunctionsHttpError',
        message: 'Edge Function returned a non-2xx status code',
        context: { status: 500, json: async () => ({ error: 'could not delete your notes' }) },
      },
    };
    expect(await deletionErrorMessage(result)).toBe('could not delete your notes');
  });

  it('asks for a fresh sign-in on 401 when the body is empty', async () => {
    const result: InvokeResult = {
      data: null,
      error: { context: { status: 401, json: async () => { throw new Error('not json'); } } },
    };
    expect(await deletionErrorMessage(result)).toBe('sign in again, then retry');
  });
});

describe('runAccountDeletion', () => {
  it('clears local data and signs out only after the server confirms', async () => {
    const order: string[] = [];
    const c = client({
      dropDevicePush: vi.fn(async () => { order.push('push'); }),
      invoke: vi.fn(async () => { order.push('invoke'); return { data: { ok: true }, error: null }; }),
      clearLocal: vi.fn(() => { order.push('local'); }),
      signOutLocal: vi.fn(async () => { order.push('signout'); }),
    });

    expect(await runAccountDeletion('user-1', c)).toEqual({ error: null });
    expect(order).toEqual(['push', 'invoke', 'local', 'signout']);
    expect(c.clearLocal).toHaveBeenCalledWith('user-1');
  });

  it('keeps the outbox when the server refuses', async () => {
    const c = client({
      invoke: vi.fn(async () => ({
        data: null,
        error: {
          context: { status: 500, json: async () => ({ error: 'could not delete your notes' }) },
        },
      })),
    });

    expect(await runAccountDeletion('user-1', c)).toEqual({ error: 'could not delete your notes' });
    expect(c.clearLocal).not.toHaveBeenCalled();
    expect(c.signOutLocal).not.toHaveBeenCalled();
    expect(c.dropDevicePush).toHaveBeenCalled();
  });

  it('still finishes when unsubscribing this device throws', async () => {
    const c = client({
      dropDevicePush: vi.fn(async () => { throw new Error('no push'); }),
    });
    expect(await runAccountDeletion('user-1', c)).toEqual({ error: null });
    expect(c.clearLocal).toHaveBeenCalledWith('user-1');
    expect(c.signOutLocal).toHaveBeenCalled();
  });

  it('still signs out when clearing local storage throws', async () => {
    const c = client({
      clearLocal: vi.fn(() => { throw new Error('quota'); }),
    });
    expect(await runAccountDeletion('user-1', c)).toEqual({ error: null });
    expect(c.signOutLocal).toHaveBeenCalled();
  });
});

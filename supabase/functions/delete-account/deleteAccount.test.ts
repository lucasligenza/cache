import { describe, it, expect, vi } from 'vitest';
import {
  USER_TABLES,
  handleDeleteAccount,
  purgeAccount,
  type AccountStore,
  type UserTable,
} from './deleteAccount';

function store(overrides: Partial<AccountStore> = {}): AccountStore {
  return {
    deleteOwnedRows: vi.fn(async () => null),
    deleteAuthUser: vi.fn(async () => null),
    ...overrides,
  };
}

function request(method: string, jwt?: string, body?: unknown): Request {
  const headers = new Headers();
  if (jwt) headers.set('Authorization', `Bearer ${jwt}`);
  return new Request('https://example.test/delete-account', {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('purgeAccount', () => {
  it('deletes notes, directories, and push subscriptions before the auth user', async () => {
    const order: string[] = [];
    const s = store({
      deleteOwnedRows: vi.fn(async (table: UserTable) => {
        order.push(table);
        return null;
      }),
      deleteAuthUser: vi.fn(async () => {
        order.push('auth');
        return null;
      }),
    });

    const result = await purgeAccount(s, 'user-1');

    expect(result).toEqual({ error: null });
    expect(order).toEqual([...USER_TABLES, 'auth']);
    expect(s.deleteOwnedRows).toHaveBeenCalledWith('notes', 'user-1');
    expect(s.deleteOwnedRows).toHaveBeenCalledWith('categories', 'user-1');
    expect(s.deleteOwnedRows).toHaveBeenCalledWith('push_subscriptions', 'user-1');
    expect(s.deleteAuthUser).toHaveBeenCalledWith('user-1');
  });

  it('stops before the auth user when notes cannot be deleted', async () => {
    const s = store({
      deleteOwnedRows: vi.fn(async (table: UserTable) =>
        table === 'notes' ? { message: 'fk violation' } : null,
      ),
    });

    const result = await purgeAccount(s, 'user-1');

    expect(result).toEqual({ error: 'could not delete your notes' });
    expect(s.deleteAuthUser).not.toHaveBeenCalled();
    expect(s.deleteOwnedRows).toHaveBeenCalledTimes(1);
  });

  it('does not delete the auth user when directories fail after notes', async () => {
    const s = store({
      deleteOwnedRows: vi.fn(async (table: UserTable) =>
        table === 'categories' ? { message: 'timeout' } : null,
      ),
    });

    const result = await purgeAccount(s, 'user-1');

    expect(result.error).toBe('could not delete your directories');
    expect(s.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('reports a reminder failure without deleting the auth user', async () => {
    const s = store({
      deleteOwnedRows: vi.fn(async (table: UserTable) =>
        table === 'push_subscriptions' ? { message: 'timeout' } : null,
      ),
    });

    expect(await purgeAccount(s, 'user-1')).toEqual({ error: 'could not delete your reminders' });
    expect(s.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('keeps the rows message off the auth-user failure', async () => {
    const s = store({
      deleteAuthUser: vi.fn(async () => ({ message: 'user not found' })),
    });

    expect(await purgeAccount(s, 'user-1')).toEqual({ error: 'could not delete the account' });
    expect(s.deleteOwnedRows).toHaveBeenCalledTimes(USER_TABLES.length);
  });

  it('rejects an empty user id', async () => {
    const s = store();
    expect(await purgeAccount(s, '')).toEqual({ error: 'not signed in' });
    expect(s.deleteOwnedRows).not.toHaveBeenCalled();
  });
});

describe('handleDeleteAccount', () => {
  it('rejects anything but POST', async () => {
    const res = await handleDeleteAccount(request('GET', 'jwt'), {
      userFromJwt: vi.fn(),
      store: store(),
    });
    expect(res.status).toBe(405);
  });

  it('answers a CORS preflight without touching the store', async () => {
    const s = store();
    const res = await handleDeleteAccount(request('OPTIONS'), {
      userFromJwt: vi.fn(),
      store: s,
    });
    expect(res.status).toBe(204);
    expect(s.deleteOwnedRows).not.toHaveBeenCalled();
  });

  it('requires a bearer token', async () => {
    const res = await handleDeleteAccount(request('POST'), {
      userFromJwt: vi.fn(),
      store: store(),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'not signed in' });
  });

  it('rejects a token Auth does not recognize', async () => {
    const res = await handleDeleteAccount(request('POST', 'expired'), {
      userFromJwt: vi.fn(async () => null),
      store: store(),
    });
    expect(res.status).toBe(401);
  });

  it('deletes only the user Auth returns, ignoring a body user id', async () => {
    const s = store();
    const res = await handleDeleteAccount(
      request('POST', 'good-jwt', { user_id: 'someone-else' }),
      {
        userFromJwt: vi.fn(async (jwt: string) => (jwt === 'good-jwt' ? { id: 'caller' } : null)),
        store: s,
      },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(s.deleteOwnedRows).toHaveBeenCalledWith('notes', 'caller');
    expect(s.deleteAuthUser).toHaveBeenCalledWith('caller');
    expect(s.deleteAuthUser).not.toHaveBeenCalledWith('someone-else');
  });

  it('returns the purge error and skips a success body', async () => {
    const res = await handleDeleteAccount(request('POST', 'good-jwt'), {
      userFromJwt: async () => ({ id: 'caller' }),
      store: store({
        deleteOwnedRows: async () => ({ message: 'nope' }),
      }),
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'could not delete your notes' });
  });
});

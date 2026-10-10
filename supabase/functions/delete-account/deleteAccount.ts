// Account deletion, without Deno or a Supabase client, so Vitest can run it.
// The edge function (index.ts) plugs in the real clients.
//
// Production notes.user_id and categories.user_id do not cascade when the
// auth user is deleted. Rows are removed here, explicitly, before the auth
// user. note_connections cascade from notes (ON DELETE CASCADE) and have no
// user_id of their own. push_subscriptions already cascade, and are deleted
// here too so a reminder can't fire after the account is gone.

export const USER_TABLES = ['notes', 'categories', 'push_subscriptions'] as const;
export type UserTable = (typeof USER_TABLES)[number];

export interface DeleteError {
  message: string;
}

export interface AccountStore {
  deleteOwnedRows(table: UserTable, userId: string): Promise<DeleteError | null>;
  deleteAuthUser(userId: string): Promise<DeleteError | null>;
}

export interface CallerLookup {
  /**
   * The Auth server's answer for this bearer token. The request body is never
   * a source of the user id — a caller can only delete their own account.
   */
  userFromJwt(jwt: string): Promise<{ id: string } | null>;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function failureCopy(table: UserTable): string {
  switch (table) {
    case 'notes':
      return 'could not delete your notes';
    case 'categories':
      return 'could not delete your directories';
    case 'push_subscriptions':
      return 'could not delete your reminders';
  }
}

/**
 * Delete this user's notes, directories, and push subscriptions, then the
 * auth user. Stops on the first failure so a half-finished delete doesn't
 * remove the login while notes are still there (the foreign keys would
 * block that anyway, until the cascade migration is applied).
 */
export async function purgeAccount(store: AccountStore, userId: string): Promise<{ error: string | null }> {
  if (!userId) return { error: 'not signed in' };
  for (const table of USER_TABLES) {
    const err = await store.deleteOwnedRows(table, userId);
    if (err) return { error: failureCopy(table) };
  }
  const authErr = await store.deleteAuthUser(userId);
  if (authErr) return { error: 'could not delete the account' };
  return { error: null };
}

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export async function handleDeleteAccount(
  req: Request,
  deps: CallerLookup & { store: AccountStore },
): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405);
  }

  const header = req.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+(\S+)/i.exec(header);
  if (!match) return jsonResponse({ error: 'not signed in' }, 401);

  const user = await deps.userFromJwt(match[1]);
  if (!user?.id) return jsonResponse({ error: 'not signed in' }, 401);

  const result = await purgeAccount(deps.store, user.id);
  if (result.error) return jsonResponse({ error: result.error }, 500);
  return jsonResponse({ ok: true }, 200);
}

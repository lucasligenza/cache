// Pure account-deletion flow. The Supabase client is wired in deleteMyAccount.ts
// so this module can be imported from the settings screen without booting the client.

/** What the user must type before the account is deleted. */
export const DELETE_CONFIRM_WORD = 'delete';

export interface InvokeFailure {
  name?: string;
  message?: string;
  context?: { status?: number; json?: () => Promise<unknown> };
}

export interface InvokeResult {
  data: unknown;
  error: InvokeFailure | null;
}

export interface AccountDeletionClient {
  invoke(): Promise<InvokeResult>;
  /** Drop this browser's push subscription. Best-effort; must not block deletion. */
  dropDevicePush(): Promise<void>;
  clearLocal(userId: string): void;
  signOutLocal(): Promise<void>;
}

function readServerError(body: unknown): string | null {
  if (!body || typeof body !== 'object' || !('error' in body)) return null;
  const message = (body as { error: unknown }).error;
  return typeof message === 'string' && message.trim() ? message : null;
}

export function deletionSucceeded(data: unknown): boolean {
  return !!data && typeof data === 'object' && (data as { ok?: unknown }).ok === true;
}

export async function deletionErrorMessage(result: InvokeResult): Promise<string> {
  const status = result.error?.context?.status;
  const name = result.error?.name ?? '';
  const message = result.error?.message ?? '';

  if (name === 'FunctionsFetchError' || /failed to (send|fetch)|network/i.test(message)) {
    return "couldn't reach the server — try again";
  }
  if (status === 404) {
    return "account deletion isn't available yet — try again later";
  }

  let serverMessage: string | null = null;
  if (result.error?.context?.json) {
    try {
      serverMessage = readServerError(await result.error.context.json());
    } catch {
      serverMessage = null;
    }
  }
  if (!serverMessage) serverMessage = readServerError(result.data);

  if (status === 401 || status === 403) return serverMessage ?? 'sign in again, then retry';
  if (serverMessage) return serverMessage;
  return 'could not delete account';
}

/**
 * Unsubscribe this device, ask the server to delete the account, then drop
 * local leftovers and the session. Local notes are cleared only after the
 * server confirms — a failed call keeps the outbox.
 */
export async function runAccountDeletion(
  userId: string,
  client: AccountDeletionClient,
): Promise<{ error: string | null }> {
  try {
    await client.dropDevicePush();
  } catch {
    /* the edge function still deletes the server subscription */
  }

  const result = await client.invoke();
  if (result.error || !deletionSucceeded(result.data)) {
    return { error: await deletionErrorMessage(result) };
  }

  try {
    client.clearLocal(userId);
  } catch {
    /* storage unavailable — the server copy is already gone */
  }
  try {
    await client.signOutLocal();
  } catch {
    /* the auth user is already gone; the UI still needs to leave the session */
  }
  return { error: null };
}

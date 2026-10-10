import { friendlyAuthError } from './authErrors';

// Supabase email links (password reset, signup confirm) land back on the app
// with the outcome in the URL: `#access_token=…&type=recovery` on success, or
// `#error=…&error_code=otp_expired&error_description=…` on failure. We also add
// our own `?auth=recovery` marker to the reset redirect so a recovery landing
// is recognisable even after supabase-js has consumed and cleared the hash.

export const AUTH_REDIRECT_PARAM = 'auth';
export const RECOVERY_REDIRECT_VALUE = 'recovery';

export interface AuthRedirect {
  /** 'recovery' when this is a password-reset landing (valid or not). */
  type: string | null;
  /** Friendly copy when the link failed (expired, already used, …). */
  error: string | null;
}

const ERROR_KEYS = ['error', 'error_code', 'error_description'];

function hashParams(url: URL): URLSearchParams {
  return new URLSearchParams(url.hash.replace(/^#/, ''));
}

export function parseAuthRedirect(href: string): AuthRedirect {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { type: null, error: null };
  }
  const hash = hashParams(url);
  const get = (k: string) => hash.get(k) ?? url.searchParams.get(k);

  const marker = url.searchParams.get(AUTH_REDIRECT_PARAM);
  const type = hash.get('type') ?? (marker === RECOVERY_REDIRECT_VALUE ? RECOVERY_REDIRECT_VALUE : null);

  const code = get('error_code');
  const description = get('error_description');
  const error = code || description || get('error')
    ? friendlyAuthError(code === 'otp_expired' ? code : description ?? code ?? get('error'))
    : null;

  return { type, error };
}

/** The `redirectTo` for reset emails: the app root plus the recovery marker. */
export function recoveryRedirectUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}/?${AUTH_REDIRECT_PARAM}=${RECOVERY_REDIRECT_VALUE}`;
}

/**
 * The URL with our marker and any auth error params removed, or null if there
 * is nothing to strip. Token hashes are left alone — supabase-js owns those.
 */
export function stripAuthRedirect(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  let changed = false;
  for (const k of [AUTH_REDIRECT_PARAM, ...ERROR_KEYS]) {
    if (url.searchParams.has(k)) {
      url.searchParams.delete(k);
      changed = true;
    }
  }
  const hash = hashParams(url);
  if (ERROR_KEYS.some(k => hash.has(k))) {
    ERROR_KEYS.forEach(k => hash.delete(k));
    hash.delete('sb');
    url.hash = hash.toString();
    changed = true;
  }
  return changed ? url.toString() : null;
}

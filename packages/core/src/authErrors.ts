// Supabase auth errors are developer-facing ("Invalid login credentials",
// "Anonymous sign-ins are disabled"). Map the ones users actually hit to short,
// terminal-voiced copy; anything unrecognised falls through lowercased.

export const MIN_PASSWORD_LENGTH = 8;

const RULES: [RegExp, string][] = [
  [/invalid login credentials|invalid_credentials/i, 'wrong email or password'],
  [/email not confirmed|email_not_confirmed/i, 'email not confirmed — open the link we emailed you, then sign in'],
  [/anonymous sign-?ins? (are|is) disabled|anonymous_provider_disabled/i, 'guest mode unavailable — sign up instead'],
  [/signups? not allowed|signup_disabled/i, 'sign-ups are closed right now'],
  [/already (been )?registered|user_already_exists|email_exists/i, 'that email already has an account'],
  [/new password should be different|same_password/i, 'new password must differ from the old one'],
  [/password should (be at least|contain)|weak.?password/i, `password too weak — use ${MIN_PASSWORD_LENGTH}+ characters`],
  [/otp_expired|link is invalid or has expired|token has expired/i, 'that link has expired — request a new one'],
  [/rate limit|too many requests|over_email_send_rate_limit|over_request_rate_limit/i, 'too many attempts — wait a minute and try again'],
  [/unable to validate email|invalid email|email_address_invalid/i, 'that email address looks invalid'],
  [/auth session missing|session_not_found/i, 'session expired — sign in again'],
  [/failed to fetch|network ?error|load failed|fetch failed/i, "can't reach the server — check your connection"],
];

export function friendlyAuthError(message: string | null | undefined): string {
  const raw = (message ?? '').trim();
  if (!raw) return 'something went wrong — try again';
  for (const [re, copy] of RULES) {
    if (re.test(raw)) return copy;
  }
  return raw.replace(/\.$/, '').toLowerCase();
}

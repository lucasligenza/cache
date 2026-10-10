import { parseAuthRedirect, stripAuthRedirect } from '@cache/core';

// Read at module load, before supabase-js parses the URL and clears the hash.
// Import this module ahead of `./supabase` (see hooks/useAuth.ts).
export const initialAuthRedirect = parseAuthRedirect(window.location.href);

/** Remove our recovery marker / link-error params from the address bar. */
export function cleanAuthRedirectUrl(): void {
  const clean = stripAuthRedirect(window.location.href);
  if (clean) window.history.replaceState(window.history.state, '', clean);
}

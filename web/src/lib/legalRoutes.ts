/** Static pages. The service worker must not rewrite these navigations to the app shell. */
export const LEGAL_PAGES = ['/privacy.html', '/terms.html'] as const;

export function legalNavigationDenylist(): RegExp[] {
  return LEGAL_PAGES.map(path => new RegExp(`^${path}$`));
}

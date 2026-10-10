// Ask the browser to treat this origin's storage as persistent, so it isn't
// evicted under storage pressure or by Safari's 7-day script-storage cap. A
// guest's session token and unsynced captures live there, and losing them means
// losing the notes. Chrome/Edge decide silently (installed PWAs, engagement);
// Firefox may show a permission prompt, which is why this runs only for guests.

export type PersistState = 'persistent' | 'best-effort' | 'unsupported';

export async function requestPersistentStorage(): Promise<PersistState> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storage || typeof storage.persist !== 'function') return 'unsupported';
  try {
    if (typeof storage.persisted === 'function' && (await storage.persisted())) return 'persistent';
    return (await storage.persist()) ? 'persistent' : 'best-effort';
  } catch {
    return 'unsupported';
  }
}

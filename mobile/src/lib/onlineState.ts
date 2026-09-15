/**
 * Sync snapshot of connectivity for useNotesCore.isOnline().
 * Unknown reachability is treated as online so capture still attempts to sync.
 */
export function readIsOnline(state: {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}): boolean {
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

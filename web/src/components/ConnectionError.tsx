import './ConnectionError.css';

interface Props {
  /** Device reports no network. */
  offline: boolean;
  /** Initial load still running past the grace period (no failure yet). */
  syncing?: boolean;
  onRetry: () => void;
}

// Inline banner above the content. Never replaces the shell: capture keeps
// working against the local outbox while the server is unreachable.
export function ConnectionError({ offline, syncing = false, onRetry }: Props) {
  if (syncing && !offline) {
    return (
      <div className="conn-banner conn-banner--syncing" role="status">
        syncing notes… <span className="conn-banner__dim">capture is ready</span>
      </div>
    );
  }
  return (
    <div className="conn-banner" role="status">
      <span>{offline ? 'offline' : "can't reach server"}</span>
      <span className="conn-banner__dim"> — captures will sync</span>
      <span className="conn-banner__dim"> · </span>
      <button type="button" className="conn-banner__retry" onClick={onRetry}>[retry]</button>
    </div>
  );
}

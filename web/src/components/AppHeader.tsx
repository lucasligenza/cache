import './AppHeader.css';

interface Props {
  totalNotes?: number;
  unsortedCount?: number;
  reviewCount?: number;
  pendingCount?: number;
  isGuest?: boolean;
  onOpenReview?: () => void;
  onOpenSettings?: () => void;
}

export function AppHeader({ totalNotes = 0, unsortedCount = 0, reviewCount = 0, pendingCount = 0, isGuest = false, onOpenReview, onOpenSettings }: Props) {
  return (
    <header className="app-header">
      <span className="app-header__brand">~/cache</span>
      {isGuest && (
        <button className="app-header__guest" onClick={onOpenSettings} title="guest mode — tap for account">
          guest
        </button>
      )}
      <span className="app-header__status">
        <span className="app-header__stat">{totalNotes} {totalNotes === 1 ? 'note' : 'notes'}</span>
        {unsortedCount > 0 && (
          <span className="app-header__stat app-header__stat--warn">· {unsortedCount} unsorted</span>
        )}
        {pendingCount > 0 && (
          <span className="app-header__stat app-header__stat--pending">· {pendingCount} queued</span>
        )}
        {reviewCount > 0 && (
          onOpenReview ? (
            <button className="app-header__review-btn" onClick={onOpenReview}>· {reviewCount} to review</button>
          ) : (
            <span className="app-header__stat app-header__stat--alert">· {reviewCount} to review</span>
          )
        )}
      </span>
      {onOpenSettings && (
        <button className="app-header__gear" onClick={onOpenSettings} aria-label="settings" title="settings">⚙</button>
      )}
    </header>
  );
}

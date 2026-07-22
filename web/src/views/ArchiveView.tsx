import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { Note, Category } from '../types';
import './ArchiveView.css';

interface Props {
  archived: Note[];
  categories: Category[];
  onRestore: (note: Note) => void;
  onPurge: (id: string) => void;
  onBack: () => void;
}

export function ArchiveView({ archived, categories, onRestore, onPurge, onBack }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const catFor = (note: Note) => categories.find(c => c.id === note.category_id);

  return (
    <div className="archive-view">
      <button className="archive-view__back" onClick={onBack}>← settings</button>
      <div className="archive-view__label">
        $ ls ~/.trash ── {archived.length} archived
      </div>

      {archived.length === 0 && (
        <div className="archive-view__empty">
          <div className="archive-view__empty-line">$ ls ~/.trash</div>
          <div className="archive-view__empty-hint">trash is empty — deleted notes land here</div>
        </div>
      )}

      {archived.map(note => {
        const cat = catFor(note);
        return (
          <div key={note.id} className="archive-view__row">
            <div className="archive-view__text">{note.text}</div>
            <div className="archive-view__meta">
              <span
                className="archive-view__cat"
                style={{ color: cat?.color || 'var(--text-muted)' }}
              >
                {cat ? `/${cat.name.toLowerCase()}` : 'buffer'}
              </span>
              {note.archived_at && (
                <span className="archive-view__time">
                  archived {formatDistanceToNow(new Date(note.archived_at), { addSuffix: true })}
                </span>
              )}
              {confirmId === note.id ? (
                <span className="archive-view__confirm">
                  <span className="archive-view__confirm-label">delete forever?</span>
                  <button
                    className="archive-view__action archive-view__action--danger"
                    onClick={() => { onPurge(note.id); setConfirmId(null); }}
                  >
                    rm -f
                  </button>
                  <button className="archive-view__action" onClick={() => setConfirmId(null)}>cancel</button>
                </span>
              ) : (
                <span className="archive-view__actions">
                  <button className="archive-view__action archive-view__action--restore" onClick={() => onRestore(note)}>
                    restore
                  </button>
                  <button className="archive-view__action archive-view__action--danger" onClick={() => setConfirmId(note.id)}>
                    rm
                  </button>
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

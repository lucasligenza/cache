import { useState } from 'react';
import type { Note } from '../types';
import './SyncIssues.css';

interface Props {
  notes: Note[];
  onRetry: (id?: string) => void;
  onEdit: (note: Note) => void;
  onExport: () => void;
  onDiscard: (id: string) => void;
}

const snippet = (text: string) => (text.length > 60 ? `${text.slice(0, 57)}…` : text);

// Notes the server permanently rejected. They stay on this device (never lost,
// never retried in a loop) until the user retries, edits, exports or discards them.
export function SyncIssues({ notes, onRetry, onEdit, onExport, onDiscard }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  if (notes.length === 0) return null;
  const n = notes.length;

  return (
    <section className="sync-issues" aria-label="notes that couldn't sync">
      <div className="sync-issues__bar">
        <span className="sync-issues__title">⚠ {n} {n === 1 ? 'note' : 'notes'} couldn't sync</span>
        <button type="button" className="sync-issues__btn" onClick={() => onRetry()}>[retry{n > 1 ? ' all' : ''}]</button>
        <button type="button" className="sync-issues__btn" onClick={onExport}>[export]</button>
        <button
          type="button"
          className="sync-issues__btn sync-issues__btn--dim"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
        >
          [{open ? 'hide' : 'details'}]
        </button>
      </div>
      {open && (
        <ul className="sync-issues__list">
          {notes.map(note => (
            <li key={note.id} className="sync-issues__item">
              <span className="sync-issues__text">{snippet(note.text)}</span>
              <span className="sync-issues__reason">{note.syncError}</span>
              <span className="sync-issues__actions">
                <button type="button" className="sync-issues__btn" onClick={() => onRetry(note.id)}>[retry]</button>
                <button type="button" className="sync-issues__btn" onClick={() => onEdit(note)}>[edit]</button>
                {confirmId === note.id ? (
                  <>
                    <button
                      type="button"
                      className="sync-issues__btn sync-issues__btn--danger"
                      onClick={() => { setConfirmId(null); onDiscard(note.id); }}
                    >
                      [discard forever]
                    </button>
                    <button type="button" className="sync-issues__btn sync-issues__btn--dim" onClick={() => setConfirmId(null)}>
                      [keep]
                    </button>
                  </>
                ) : (
                  <button type="button" className="sync-issues__btn sync-issues__btn--dim" onClick={() => setConfirmId(note.id)}>
                    [discard]
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

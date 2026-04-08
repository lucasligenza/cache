import { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow, differenceInDays, isFuture } from 'date-fns';
import type { Note, Category } from '../types';
import './NoteCard.css';

interface Props {
  note: Note;
  categories: Category[];
  onAssign: (noteId: string, categoryId: string) => void;
  onDelete: (noteId: string) => void;
  onUpdate?: (noteId: string, updates: Partial<Note>) => void;
  showCategories?: boolean;
}

const PING_PRESETS = [
  { label: '+1h', ms: 60 * 60 * 1000 },
  { label: '+3h', ms: 3 * 60 * 60 * 1000 },
  { label: '+1d', ms: 24 * 60 * 60 * 1000 },
  { label: '+3d', ms: 3 * 24 * 60 * 60 * 1000 },
  { label: '+1w', ms: 7 * 24 * 60 * 60 * 1000 },
];

export function NoteCard({ note, categories, onAssign, onDelete, onUpdate = () => {}, showCategories = false }: Props) {
  const [exiting, setExiting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(note.text);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cancelledRef = useRef<boolean>(false);

  const isStale = differenceInDays(new Date(), new Date(note.created_at)) >= 3;
  const relTime = formatDistanceToNow(new Date(note.created_at), { addSuffix: true });

  const pingDate = note.remind_at ? new Date(note.remind_at) : null;
  const pingFuture = pingDate ? isFuture(pingDate) : false;
  const pingLabel = pingDate
    ? pingFuture
      ? `ping ${formatDistanceToNow(pingDate, { addSuffix: true })}`
      : `ping overdue`
    : null;

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setEditText(note.text);
  }, [note.text, editing]);

  const handleAssign = (cat: Category) => {
    setExiting(true);
    setTimeout(() => onAssign(note.id, cat.id), 280);
  };

  const triggerDelete = () => {
    setExiting(true);
    setTimeout(() => onDelete(note.id), 280);
  };

  const saveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== note.text) {
      onUpdate(note.id, { text: trimmed });
    }
    setEditing(false);
  };

  const cancelEdit = () => {
    cancelledRef.current = true;
    setEditText(note.text);
    setEditing(false);
  };

  const handleBlurSave = () => {
    if (cancelledRef.current) { cancelledRef.current = false; return; }
    saveEdit();
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
    if (e.key === 'Escape') cancelEdit();
  };

  const setPing = (ms: number) => {
    onUpdate(note.id, { remind_at: new Date(Date.now() + ms).toISOString() });
  };

  const clearPing = () => {
    onUpdate(note.id, { remind_at: null });
  };

  const cardClasses = [
    'note-card',
    isStale ? 'note-card--stale' : '',
    exiting ? 'note-card--exiting' : '',
    editing ? 'note-card--editing' : '',
    confirmDelete ? 'note-card--confirm' : '',
  ].filter(Boolean).join(' ');

  if (editing) {
    return (
      <div className={cardClasses}>
        <textarea
          ref={textareaRef}
          className="note-card__edit-area"
          value={editText}
          onChange={e => setEditText(e.target.value)}
          onKeyDown={handleEditKeyDown}
          onBlur={handleBlurSave}
          rows={2}
        />
        <div className="note-card__meta">
          {categories.map(cat => (
            <button
              key={cat.id}
              className="note-card__chip"
              style={{ color: cat.color, borderColor: cat.color + '44' }}
              onMouseDown={e => e.preventDefault()}
              onClick={() => handleAssign(cat)}
            >
              /{cat.name.toLowerCase()}
            </button>
          ))}
          <button
            className="note-card__chip"
            style={{ color: '#FF4444', borderColor: '#FF444433', marginLeft: 'auto' }}
            onMouseDown={e => e.preventDefault()}
            onClick={() => setConfirmDelete(true)}
          >
            rm
          </button>
          <span className="note-card__edit-hint">enter ↵ save · esc cancel</span>
        </div>
        <div className="note-card__ping-row">
          <span className="note-card__ping-label">ping:</span>
          {PING_PRESETS.map(({ label, ms }) => (
            <button
              key={label}
              className="note-card__chip note-card__chip--ping"
              onMouseDown={e => e.preventDefault()}
              onClick={() => setPing(ms)}
            >
              {label}
            </button>
          ))}
          {note.remind_at && (
            <button
              className="note-card__chip note-card__chip--clear"
              onMouseDown={e => e.preventDefault()}
              onClick={clearPing}
            >
              ×clear
            </button>
          )}
          {pingLabel && (
            <span className={`note-card__ping-set${!pingFuture ? ' note-card__ping-set--overdue' : ''}`}>
              {pingLabel}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (confirmDelete) {
    return (
      <div className={cardClasses}>
        <div className="note-card__text note-card__text--dim">{note.text}</div>
        <div className="note-card__meta">
          <span className="note-card__confirm-label">rm note?</span>
          <button
            className="note-card__chip note-card__chip--danger"
            onClick={triggerDelete}
            style={{ marginLeft: 'auto' }}
          >
            rm
          </button>
          <button
            className="note-card__chip"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
            onClick={() => setConfirmDelete(false)}
          >
            cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cardClasses}>
      <div className="note-card__text" onClick={() => { setEditText(note.text); setEditing(true); }}>
        {note.text}
      </div>
      <div className="note-card__meta">
        <span className="note-card__time">{relTime}</span>
        {pingLabel && (
          <span className={`note-card__ping-badge${!pingFuture ? ' note-card__ping-badge--overdue' : ''}`}>
            {pingLabel}
          </span>
        )}
        {showCategories && categories.map(cat => (
          <button
            key={cat.id}
            className="note-card__chip"
            style={{ color: cat.color, borderColor: cat.color + '44' }}
            onClick={() => handleAssign(cat)}
          >
            /{cat.name.toLowerCase()}
          </button>
        ))}
        <button
          className="note-card__chip"
          style={{ color: '#FF4444', borderColor: '#FF444433', marginLeft: 'auto' }}
          onClick={() => setConfirmDelete(true)}
        >
          rm
        </button>
      </div>
    </div>
  );
}

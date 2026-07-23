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
  highlighted?: boolean;
  reviewMode?: boolean;
}

const PING_PRESETS = [
  { label: '+1h', ms: 60 * 60 * 1000 },
  { label: '+3h', ms: 3 * 60 * 60 * 1000 },
  { label: '+1d', ms: 24 * 60 * 60 * 1000 },
  { label: '+3d', ms: 3 * 24 * 60 * 60 * 1000 },
  { label: '+1w', ms: 7 * 24 * 60 * 60 * 1000 },
];

export function NoteCard({ note, categories, onAssign, onDelete, onUpdate = () => {}, showCategories = false, highlighted = false, reviewMode = false }: Props) {
  const [exiting, setExiting] = useState(false);
  const [filing, setFiling] = useState(false);
  const [filingColor, setFilingColor] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(note.text);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pingOpen, setPingOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
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
  const isOverdue = !!pingLabel && !pingFuture;

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

  // Filing to a folder gets its own motion (glow in the category color, then
  // shrink + fly toward the folder) so it reads differently from delete.
  const handleAssign = (cat: Category) => {
    setFilingColor(cat.color);
    setFiling(true);
    setTimeout(() => onAssign(note.id, cat.id), 340);
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

  const setPingAt = (iso: string | null) => {
    onUpdate(note.id, { remind_at: iso });
  };
  const setPing = (ms: number) => setPingAt(new Date(Date.now() + ms).toISOString());
  const clearPing = () => { setPingAt(null); setCustomOpen(false); };

  const togglePin = () => onUpdate(note.id, { pinned: !note.pinned });
  const toggleFlag = () => onUpdate(note.id, { pending_review: !note.pending_review });

  // "keep/done": acknowledge a note in the review flow so it stops nagging.
  const markReviewed = () => {
    const updates: Partial<Note> = { reviewed_at: new Date().toISOString(), pending_review: false };
    if (isOverdue) updates.remind_at = null; // resolving an overdue ping
    onUpdate(note.id, updates);
  };

  const cardClasses = [
    'note-card',
    note.pending ? 'note-card--pending' : '',
    isStale ? 'note-card--stale' : '',
    note.pinned ? 'note-card--pinned' : '',
    highlighted ? 'note-card--focused' : '',
    exiting ? 'note-card--exiting' : '',
    filing ? 'note-card--filing' : '',
    editing ? 'note-card--editing' : '',
    confirmDelete ? 'note-card--confirm' : '',
  ].filter(Boolean).join(' ');

  const cardStyle = filing && filingColor
    ? ({ ['--filing-color']: filingColor } as React.CSSProperties)
    : undefined;

  const pingRow = (
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
      <button
        className="note-card__chip note-card__chip--ping"
        onMouseDown={e => e.preventDefault()}
        onClick={() => setCustomOpen(o => !o)}
      >
        custom
      </button>
      {customOpen && (
        <input
          type="datetime-local"
          className="note-card__ping-input"
          onMouseDown={e => e.stopPropagation()}
          onChange={e => { if (e.target.value) setPingAt(new Date(e.target.value).toISOString()); }}
        />
      )}
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
  );

  const pinChip = (
    <button
      className={`note-card__chip note-card__chip--pin${note.pinned ? ' note-card__chip--pinned' : ''}`}
      onClick={togglePin}
      title={note.pinned ? 'unpin note' : 'pin to top'}
    >
      {note.pinned ? '★ unpin' : 'pin'}
    </button>
  );

  const flagChip = (
    <button
      className={`note-card__chip note-card__chip--flag${note.pending_review ? ' note-card__chip--flagged' : ''}`}
      onClick={toggleFlag}
      title={note.pending_review ? 'unflag' : 'flag for review'}
    >
      {note.pending_review ? '⚑ flagged' : '⚑'}
    </button>
  );

  if (editing) {
    return (
      <div className={cardClasses} style={cardStyle}>
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
        {pingRow}
      </div>
    );
  }

  if (confirmDelete) {
    return (
      <div className={cardClasses} style={cardStyle}>
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
    <div className={cardClasses} style={cardStyle}>
      <div
        className="note-card__text"
        role="button"
        tabIndex={0}
        onClick={() => { setEditText(note.text); setEditing(true); }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditText(note.text); setEditing(true); }
        }}
      >
        {note.text}
      </div>
      <div className="note-card__meta">
        <span className="note-card__time">{relTime}</span>
        {note.pending && <span className="note-card__chip note-card__chip--queued" title="captured — syncing when online">[queued]</span>}
        {pingLabel ? (
          <button
            className={`note-card__ping-badge${!pingFuture ? ' note-card__ping-badge--overdue' : ''}`}
            onClick={() => setPingOpen(o => !o)}
            title="reschedule ping"
          >
            {pingLabel}{!pingFuture ? ' · snooze' : ''}
          </button>
        ) : (
          <button
            className="note-card__chip note-card__chip--ping"
            onClick={() => setPingOpen(o => !o)}
          >
            ping
          </button>
        )}
        {reviewMode && (
          <button
            className="note-card__chip note-card__chip--review"
            onClick={markReviewed}
            title="mark reviewed"
          >
            {isOverdue ? 'done' : 'keep'}
          </button>
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
        {flagChip}
        {pinChip}
        <button
          className="note-card__chip"
          style={{ color: '#FF4444', borderColor: '#FF444433', marginLeft: 'auto' }}
          onClick={() => setConfirmDelete(true)}
        >
          rm
        </button>
      </div>
      {pingOpen && pingRow}
    </div>
  );
}

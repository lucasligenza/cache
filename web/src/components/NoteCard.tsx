import { useState, useRef, useEffect, useLayoutEffect, useId } from 'react';
import { format, differenceInDays, isFuture } from 'date-fns';
import type { Note, Category } from '../types';
import { CategoryPicker } from './CategoryPicker';
import { shortTime } from '../lib/shortTime';
import './NoteCard.css';

interface Props {
  note: Note;
  categories: Category[];
  onAssign: (noteId: string, categoryId: string) => void;
  onDelete: (noteId: string) => void;
  onUpdate?: (noteId: string, updates: Partial<Note>) => void;
  /** Promote `mv →` to a primary action (buffer triage). Otherwise it lives with the secondary actions. */
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const primaryMvRef = useRef<HTMLButtonElement>(null);
  const secondaryMvRef = useRef<HTMLButtonElement>(null);
  const mvAnchorRef = useRef<HTMLButtonElement | null>(null);
  const cancelledRef = useRef<boolean>(false);
  const secondaryId = useId();

  const isStale = differenceInDays(new Date(), new Date(note.created_at)) >= 3;
  const relTime = shortTime(note.created_at);
  const absTime = (iso: string) => format(new Date(iso), 'EEE d MMM yyyy, HH:mm');

  const pingDate = note.remind_at ? new Date(note.remind_at) : null;
  const pingFuture = pingDate ? isFuture(pingDate) : false;
  const pingLabel = pingDate
    ? pingFuture
      ? `ping ${shortTime(note.remind_at!)}`
      : `ping overdue`
    : null;
  const isOverdue = !!pingLabel && !pingFuture;

  const canMove = categories.length > 0;
  const mvIsPrimary = canMove && showCategories && !reviewMode;

  useEffect(() => {
    const ta = textareaRef.current;
    if (editing && ta) {
      ta.focus();
      const len = ta.value.length;
      ta.setSelectionRange(len, len);
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setEditText(note.text);
  }, [note.text, editing]);

  // Long notes are clamped so the list stays scannable; only offer "more" when
  // the clamp actually hides something at the current width.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;
    const measure = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [note.text, expanded, editing, confirmDelete]);

  // Filing to a folder gets its own motion (glow in the category color, then
  // shrink + fly toward the folder) so it reads differently from delete.
  const handleAssign = (cat: Category) => {
    setPickerOpen(false);
    setFilingColor(cat.color);
    setFiling(true);
    setTimeout(() => onAssign(note.id, cat.id), 340);
  };

  const openPicker = (anchor: HTMLButtonElement | null) => {
    mvAnchorRef.current = anchor;
    setPickerOpen(true);
  };

  const triggerDelete = () => {
    setExiting(true);
    setTimeout(() => onDelete(note.id), 280);
  };

  const startEdit = () => {
    setEditText(note.text);
    setPingOpen(false);
    setMoreOpen(false);
    setEditing(true);
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

  const handleBlurSave = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (cancelledRef.current) { cancelledRef.current = false; return; }
    // Focus moving to [save]/[cancel] (Android focuses tapped buttons) — let their click decide.
    if (e.relatedTarget instanceof HTMLElement && e.relatedTarget.dataset.editAction) return;
    saveEdit();
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
    if (e.key === 'Escape') cancelEdit();
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  // In review, scheduling a ping is a snooze: acknowledge the note now so it
  // leaves today's set, and let the ping bring it back as overdue later.
  const setPingAt = (iso: string | null) => {
    if (reviewMode && iso) {
      onUpdate(note.id, { remind_at: iso, reviewed_at: new Date().toISOString(), pending_review: false });
    } else {
      onUpdate(note.id, { remind_at: iso });
    }
  };
  const setPing = (ms: number) => {
    setPingAt(new Date(Date.now() + ms).toISOString());
    setPingOpen(false);
    setCustomOpen(false);
  };
  const clearPing = () => { setPingAt(null); setCustomOpen(false); setPingOpen(false); };
  const togglePingPanel = () => { setPingOpen(o => !o); setCustomOpen(false); };

  const togglePin = () => onUpdate(note.id, { pinned: !note.pinned });
  const toggleFlag = () => onUpdate(note.id, { pending_review: !note.pending_review });
  // "never nag": permanently exclude from passive review buckets until re-enabled.
  const toggleMute = () => onUpdate(note.id, { review_muted: !note.review_muted });

  // "seen/done": acknowledge a note in the review flow so it stops nagging.
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
    moreOpen ? 'note-card--more-open' : '',
  ].filter(Boolean).join(' ');

  const cardStyle = filing && filingColor
    ? ({ ['--filing-color']: filingColor } as React.CSSProperties)
    : undefined;

  const picker = pickerOpen && (
    <CategoryPicker
      categories={categories}
      anchorRef={mvAnchorRef}
      onSelect={handleAssign}
      onClose={() => setPickerOpen(false)}
    />
  );

  if (editing) {
    return (
      <div className={cardClasses} style={cardStyle}>
        <textarea
          ref={textareaRef}
          className="note-card__edit-area"
          aria-label="edit note"
          value={editText}
          onChange={handleEditChange}
          onKeyDown={handleEditKeyDown}
          onBlur={handleBlurSave}
          rows={1}
        />
        <div className="note-card__meta">
          <span className="note-card__edit-hint">↵ save · esc cancel</span>
          <span className="note-card__spacer" />
          <button
            type="button"
            className="note-card__chip note-card__chip--quiet"
            data-edit-action="cancel"
            onMouseDown={e => e.preventDefault()}
            onClick={cancelEdit}
          >
            cancel
          </button>
          <button
            type="button"
            className="note-card__chip note-card__chip--primary"
            data-edit-action="save"
            onMouseDown={e => e.preventDefault()}
            onClick={saveEdit}
          >
            save
          </button>
        </div>
      </div>
    );
  }

  if (confirmDelete) {
    return (
      <div className={cardClasses} style={cardStyle}>
        <div className="note-card__text note-card__text--dim note-card__text--clamp">{note.text}</div>
        <div className="note-card__meta">
          <span className="note-card__confirm-label">move to trash?</span>
          <span className="note-card__spacer" />
          <button
            type="button"
            className="note-card__chip note-card__chip--quiet"
            onClick={() => setConfirmDelete(false)}
          >
            cancel
          </button>
          <button
            type="button"
            className="note-card__chip note-card__chip--danger"
            onClick={triggerDelete}
          >
            rm
          </button>
        </div>
      </div>
    );
  }

  const pingPanel = (
    <div className="note-card__ping-row" role="group" aria-label={reviewMode ? 'snooze until' : 'ping me'}>
      <span className="note-card__ping-label">{reviewMode ? 'snooze:' : 'ping:'}</span>
      {PING_PRESETS.map(({ label, ms }) => (
        <button
          key={label}
          type="button"
          className="note-card__chip note-card__chip--ping"
          onClick={() => setPing(ms)}
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        className="note-card__chip note-card__chip--ping"
        aria-expanded={customOpen}
        onClick={() => setCustomOpen(o => !o)}
      >
        custom
      </button>
      {note.remind_at && (
        <button type="button" className="note-card__chip note-card__chip--quiet" onClick={clearPing}>
          ×clear
        </button>
      )}
      {customOpen && (
        <input
          type="datetime-local"
          className="note-card__ping-input"
          aria-label="custom ping time"
          onChange={e => { if (e.target.value) setPingAt(new Date(e.target.value).toISOString()); }}
        />
      )}
    </div>
  );

  return (
    <div className={cardClasses} style={cardStyle}>
      <div
        ref={textRef}
        className={`note-card__text${expanded ? '' : ' note-card__text--clamp'}`}
        role="button"
        tabIndex={0}
        aria-label={`edit note: ${note.text}`}
        onClick={startEdit}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(); }
        }}
      >
        {note.text}
      </div>

      <div className="note-card__meta">
        <time className="note-card__time" dateTime={note.created_at} title={absTime(note.created_at)}>{relTime}</time>
        {(clamped || expanded) && (
          <button
            type="button"
            className="note-card__badge note-card__badge--expand"
            aria-expanded={expanded}
            aria-label={expanded ? 'show less' : 'show full note'}
            title={expanded ? 'show less' : 'show full note'}
            onClick={() => setExpanded(x => !x)}
          >
            {expanded ? '▴' : '▾'}
          </button>
        )}

        {note.pending && (
          <span className="note-card__badge note-card__badge--queued" title="captured — syncing when online">[queued]</span>
        )}
        {pingLabel && (
          <button
            type="button"
            className={`note-card__badge note-card__badge--ping${isOverdue ? ' note-card__badge--overdue' : ''}`}
            aria-expanded={pingOpen}
            onClick={togglePingPanel}
            title={`${isOverdue ? 'overdue since' : 'pings'} ${absTime(note.remind_at!)} — ${isOverdue ? 'snooze or clear' : 'reschedule'}`}
          >
            {isOverdue ? '⚠ overdue' : pingLabel}
          </button>
        )}
        {note.pending_review && (
          <button
            type="button"
            className="note-card__badge note-card__badge--flagged"
            onClick={toggleFlag}
            aria-label="flagged — unflag"
            title="unflag"
          >
            ⚑ flagged
          </button>
        )}
        {note.pinned && (
          <button
            type="button"
            className="note-card__badge note-card__badge--pinned"
            onClick={togglePin}
            aria-label="pinned — unpin"
            title="unpin"
          >
            ★
          </button>
        )}
        {note.review_muted && (
          <button
            type="button"
            className="note-card__badge note-card__badge--muted"
            onClick={toggleMute}
            aria-label="not resurfacing — allow resurfacing in review"
            title="allow this to resurface in review again"
          >
            ⊘ no resurface
          </button>
        )}

        <span className="note-card__spacer" />

        <div className="note-card__secondary" id={secondaryId}>
          {!pingLabel && !reviewMode && (
            <button type="button" className="note-card__chip note-card__chip--ping" aria-expanded={pingOpen} onClick={togglePingPanel}>
              ping
            </button>
          )}
          {canMove && !mvIsPrimary && (
            <button
              ref={secondaryMvRef}
              type="button"
              className="note-card__chip note-card__chip--mv"
              aria-haspopup="listbox"
              aria-expanded={pickerOpen}
              onClick={() => openPicker(secondaryMvRef.current)}
            >
              mv →
            </button>
          )}
          {!note.pending_review && (
            <button type="button" className="note-card__chip note-card__chip--quiet" onClick={toggleFlag} title="flag for review">
              ⚑ flag
            </button>
          )}
          {!note.pinned && (
            <button type="button" className="note-card__chip note-card__chip--quiet" onClick={togglePin} title="pin to top">
              ★ pin
            </button>
          )}
          {reviewMode && !note.review_muted && (
            <button
              type="button"
              className="note-card__chip note-card__chip--quiet"
              onClick={toggleMute}
              title="never nag — stop surfacing this in review"
            >
              stop resurfacing
            </button>
          )}
          <button
            type="button"
            className="note-card__chip note-card__chip--rm"
            onClick={() => setConfirmDelete(true)}
            title="move to trash"
          >
            rm
          </button>
        </div>

        {reviewMode && (
          <button
            type="button"
            className="note-card__chip note-card__chip--quiet note-card__chip--snooze"
            aria-expanded={pingOpen}
            onClick={togglePingPanel}
          >
            snooze
          </button>
        )}
        {reviewMode && (
          <button
            type="button"
            className="note-card__chip note-card__chip--primary"
            onClick={markReviewed}
            title={isOverdue ? 'done — clear the ping' : 'seen — stop showing this today'}
          >
            {isOverdue ? '✓ done' : '✓ seen'}
          </button>
        )}
        {mvIsPrimary && (
          <button
            ref={primaryMvRef}
            type="button"
            className="note-card__chip note-card__chip--mv"
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            onClick={() => openPicker(primaryMvRef.current)}
          >
            mv →
          </button>
        )}
        <button
          type="button"
          className="note-card__more"
          aria-label="more actions"
          aria-expanded={moreOpen}
          aria-controls={secondaryId}
          onClick={() => setMoreOpen(o => !o)}
        >
          ⋯
        </button>
      </div>

      {pingOpen && pingPanel}
      {picker}
    </div>
  );
}

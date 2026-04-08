import { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import type { Note, Category } from '../types';
import { useToast } from './Toast';
import './NoteCard.css';

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string;

interface Props {
  note: Note;
  categories: Category[];
  onAssign: (noteId: string, categoryId: string) => void;
  onDelete: (noteId: string) => void;
  onUpdate?: (noteId: string, updates: Partial<Note>) => void;
}

export function NoteCard({ note, categories, onAssign, onDelete, onUpdate = () => {} }: Props) {
  const { showToast } = useToast();
  const [exiting, setExiting] = useState(false);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading'>('idle');
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(note.text);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isStale = differenceInDays(new Date(), new Date(note.created_at)) >= 3;
  const relTime = formatDistanceToNow(new Date(note.created_at), { addSuffix: true });

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

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
    setEditText(note.text);
    setEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
    if (e.key === 'Escape') cancelEdit();
  };

  const handleAutoSort = async () => {
    if (!ANTHROPIC_KEY) {
      showToast('warn', 'set VITE_ANTHROPIC_API_KEY in .env to use AI sort');
      return;
    }
    setAiStatus('loading');
    try {
      const categoryNames = categories.map(c => c.name).join(', ');
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 20,
          messages: [{
            role: 'user',
            content: `Categorize this note into exactly one of: ${categoryNames}. Note: "${note.text}". Reply with ONLY the category name.`,
          }],
        }),
      });
      const json = await res.json();
      const suggested = json.content?.[0]?.text?.trim();
      const match = categories.find(c => c.name.toLowerCase() === suggested?.toLowerCase());
      if (match) {
        handleAssign(match);
        showToast('ok', `sorted → /${match.name.toLowerCase()}`);
      } else {
        showToast('warn', 'AI sort: no matching category found');
      }
    } catch {
      showToast('error', 'AI sort failed — check network');
    } finally {
      setAiStatus('idle');
    }
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
          onBlur={saveEdit}
          rows={2}
        />
        <div className="note-card__meta">
          <span className="note-card__time">{relTime}</span>
          <span className="note-card__edit-hint">enter ↵ save · esc cancel</span>
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
        {categories.map(cat => (
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
          className={`note-card__ai-btn${aiStatus === 'loading' ? ' note-card__ai-btn--loading' : ''}`}
          onClick={handleAutoSort}
          disabled={aiStatus === 'loading'}
        >
          {aiStatus === 'loading' ? 'sorting...' : '⚡ sort'}
        </button>
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

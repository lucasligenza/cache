import { useState } from 'react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { Note, Category } from '../types';
import './NoteCard.css';

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string;

interface Props {
  note: Note;
  categories: Category[];
  onAssign: (noteId: string, categoryId: string) => void;
  onDelete: (noteId: string) => void;
}

export function NoteCard({ note, categories, onAssign, onDelete }: Props) {
  const [exiting, setExiting] = useState(false);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading'>('idle');

  const isStale = differenceInDays(new Date(), new Date(note.created_at)) >= 3;
  const relTime = formatDistanceToNow(new Date(note.created_at), { addSuffix: true });

  const handleAssign = (cat: Category) => {
    setExiting(true);
    setTimeout(() => onAssign(note.id, cat.id), 280);
  };

  const handleDelete = () => {
    if (!confirm('Delete this note?')) return;
    setExiting(true);
    setTimeout(() => onDelete(note.id), 280);
  };

  const handleAutoSort = async () => {
    if (!ANTHROPIC_KEY) { alert('Set VITE_ANTHROPIC_API_KEY in .env'); return; }
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
      if (match) handleAssign(match);
    } catch (e) {
      console.error(e);
    } finally {
      setAiStatus('idle');
    }
  };

  return (
    <div
      className={[
        'note-card',
        isStale ? 'note-card--stale' : '',
        exiting ? 'note-card--exiting' : '',
      ].join(' ').trim()}
    >
      <div className="note-card__text">{note.text}</div>
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
          onClick={handleDelete}
        >
          rm
        </button>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Note, Category } from '../types';
import { NoteCard } from '../components/NoteCard';
import './BufferView.css';

interface Props {
  notes: Note[];
  categories: Category[];
  onAssign: (noteId: string, categoryId: string) => void;
  onDelete: (noteId: string) => void;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  focusNoteId?: string | null;
  focusNonce?: number;
}

export function BufferView({ notes, categories, onAssign, onDelete, onUpdate, focusNoteId, focusNonce = 0 }: Props) {
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!focusNonce || !focusNoteId) return;
    refs.current[focusNoteId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(focusNoteId);
    const t = setTimeout(() => setHighlightId(null), 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  return (
    <div className="buffer-view">
      <div className="buffer-view__label">
        ── buffer ── {notes.length} unsorted
      </div>

      {notes.length === 0 && (
        <div className="buffer-view__empty">
          <div className="buffer-view__empty-line">$ buffer clear</div>
          <div className="buffer-view__empty-hint">nothing to sort — type below to cache a note</div>
        </div>
      )}

      {notes.map(note => (
        <div key={note.id} ref={el => { refs.current[note.id] = el; }}>
          <NoteCard
            note={note}
            categories={categories}
            onAssign={onAssign}
            onDelete={onDelete}
            onUpdate={onUpdate}
            showCategories
            highlighted={highlightId === note.id}
          />
        </div>
      ))}
    </div>
  );
}

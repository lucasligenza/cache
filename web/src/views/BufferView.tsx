import { Note, Category } from '../types';
import { NoteCard } from '../components/NoteCard';
import './BufferView.css';

interface Props {
  notes: Note[];
  categories: Category[];
  onAssign: (noteId: string, categoryId: string) => void;
  onDelete: (noteId: string) => void;
  onUpdate: (id: string, updates: Partial<Note>) => void;
}

export function BufferView({ notes, categories, onAssign, onDelete, onUpdate }: Props) {
  return (
    <div className="buffer-view">
      <div className="buffer-view__label">
        ── buffer ── {notes.length} unsorted
      </div>

      {notes.length === 0 && (
        <div className="buffer-view__empty">buffer empty</div>
      )}

      {notes.map(note => (
        <NoteCard
          key={note.id}
          note={note}
          categories={categories}
          onAssign={onAssign}
          onDelete={onDelete}
          onUpdate={onUpdate}
          showCategories
        />
      ))}
    </div>
  );
}

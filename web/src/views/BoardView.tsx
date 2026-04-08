import { useState } from 'react';
import { Note, Category } from '../types';
import { NoteCard } from '../components/NoteCard';
import './BoardView.css';

interface Props {
  categories: Category[];
  getNotesByCategory: (id: string) => Note[];
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
  onDeleteNote: (id: string) => void;
  onCreateCategory: (name: string) => void;
  onRenameCategory: (id: string, name: string) => void;
  onDeleteCategory: (id: string) => void;
}

export function BoardView({
  categories, getNotesByCategory, onUpdateNote,
  onDeleteNote, onCreateCategory, onRenameCategory, onDeleteCategory,
}: Props) {
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (activeCatId) {
    const cat = categories.find(c => c.id === activeCatId);
    const notes = getNotesByCategory(activeCatId);
    return (
      <div className="board-view">
        <button className="board-view__detail-back" onClick={() => setActiveCatId(null)}>
          ← board
        </button>
        <div className="board-view__detail-label" style={{ color: cat?.color }}>
          ── /{cat?.name.toLowerCase()} ── {notes.length} notes
        </div>

        {notes.length === 0 && <div className="board-view__empty">no notes</div>}

        {notes.map(note => (
          <NoteCard
            key={note.id}
            note={note}
            categories={categories.filter(c => c.id !== activeCatId)}
            onAssign={(noteId, catId) => onUpdateNote(noteId, { category_id: catId })}
            onDelete={onDeleteNote}
            onUpdate={onUpdateNote}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="board-view">
      <div className="board-view__label">── board ── {categories.length} directories</div>

      <div className="board-view__grid">
        {categories.map(cat => (
          <button
            key={cat.id}
            className="board-view__cat-card"
            onClick={() => setActiveCatId(cat.id)}
          >
            <div className="board-view__cat-name" style={{ color: cat.color }}>
              /{cat.name.toLowerCase()}
            </div>
            <div className="board-view__cat-count">
              {getNotesByCategory(cat.id).length} notes
            </div>
          </button>
        ))}
      </div>

      <button
        className="board-view__settings-btn"
        onClick={() => setSettingsOpen(o => !o)}
      >
        {settingsOpen ? '[close] config' : '+ config'}
      </button>

      {settingsOpen && (
        <div className="board-view__settings">
          <div className="board-view__settings-header">
            <span className="board-view__settings-title">directories</span>
          </div>

          {categories.map(cat => (
            <div key={cat.id} className="board-view__settings-row">
              <span className="board-view__swatch" style={{ background: cat.color }} />

              {editingId === cat.id ? (
                <>
                  <input
                    className="board-view__settings-input"
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') { onRenameCategory(cat.id, editingName.trim()); setEditingId(null); }
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <button className="board-view__settings-action" onClick={() => { onRenameCategory(cat.id, editingName.trim()); setEditingId(null); }}>
                    save
                  </button>
                </>
              ) : (
                <>
                  <span className="board-view__settings-name" style={{ color: cat.color }}>
                    /{cat.name.toLowerCase()}
                  </span>
                  <button className="board-view__settings-action" onClick={() => { setEditingId(cat.id); setEditingName(cat.name); }}>
                    rename
                  </button>
                  {deletingId === cat.id ? (
                    <div className="board-view__confirm-row">
                      <span className="board-view__confirm-label">rm /{cat.name.toLowerCase()}?</span>
                      <button
                        className="board-view__settings-action board-view__settings-action--danger"
                        onClick={() => { onDeleteCategory(cat.id); setDeletingId(null); }}
                      >
                        rm
                      </button>
                      <button
                        className="board-view__settings-action"
                        onClick={() => setDeletingId(null)}
                      >
                        cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="board-view__settings-action board-view__settings-action--danger"
                      onClick={() => setDeletingId(cat.id)}
                    >
                      rm
                    </button>
                  )}
                </>
              )}
            </div>
          ))}

          {categories.length < 10 && (
            <div className="board-view__add-cat">
              <input
                className="board-view__add-input"
                placeholder="new directory name..."
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newCatName.trim()) {
                    onCreateCategory(newCatName.trim());
                    setNewCatName('');
                  }
                }}
              />
              <button className="board-view__add-submit" onClick={() => {
                if (newCatName.trim()) { onCreateCategory(newCatName.trim()); setNewCatName(''); }
              }}>
                mkdir
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

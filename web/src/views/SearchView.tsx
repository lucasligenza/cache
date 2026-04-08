import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { Note, Category } from '../types';
import './SearchView.css';

interface Props {
  notes: Note[];
  categories: Category[];
  onNavigate: (view: 'buffer' | 'board') => void;
}

function filterNotes(notes: Note[], query: string): Note[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return notes.filter(n => n.text.toLowerCase().includes(q));
}

function highlightMatch(text: string, query: string): ReactNode {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-view__highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function SearchView({ notes, categories, onNavigate }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = filterNotes(notes, query);
  const recentNotes = notes.slice(0, 5);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') setQuery('');
  };

  const getCategoryForNote = (note: Note) =>
    categories.find(c => c.id === note.category_id);

  const handleResultClick = (note: Note) => {
    onNavigate(note.category_id ? 'board' : 'buffer');
  };

  return (
    <div className="search-view">
      <div className="search-view__bar">
        <span className="search-view__prompt">~/cache $ grep</span>
        <input
          ref={inputRef}
          className="search-view__input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoComplete="off"
        />
        {query && (
          <span className="search-view__count">
            {results.length} {results.length === 1 ? 'result' : 'results'}
          </span>
        )}
      </div>

      <div className="search-view__results">
        {!query ? (
          <div className="search-view__empty">
            <div className="search-view__cursor-line">
              <span className="search-view__cursor">_</span>
            </div>
            {recentNotes.map(note => (
              <div key={note.id} className="search-view__recent-item">
                {note.text}
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="search-view__no-results">no results for "{query}"</div>
        ) : (
          results.map(note => {
            const cat = getCategoryForNote(note);
            return (
              <div
                key={note.id}
                className="search-view__result"
                onClick={() => handleResultClick(note)}
              >
                <div className="search-view__result-text">
                  {highlightMatch(note.text, query)}
                </div>
                <div className="search-view__result-meta">
                  <span
                    className="search-view__result-cat"
                    style={{ color: cat?.color || 'var(--text-muted)' }}
                  >
                    {cat ? `/${cat.name.toLowerCase()}` : 'buffer'}
                  </span>
                  <span className="search-view__result-time">
                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {query && <div className="search-view__footer">esc to clear</div>}
    </div>
  );
}

import { useState, useEffect, useRef, useMemo } from 'react';
import './CommandPalette.css';

export interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

interface Props {
  open: boolean;
  commands: Command[];
  onClose: () => void;
}

export function CommandPalette({ open, commands, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      // focus after the overlay paints
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(c => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    if (index >= filtered.length) setIndex(filtered.length > 0 ? filtered.length - 1 : 0);
  }, [filtered, index]);

  if (!open) return null;

  const runAt = (i: number) => {
    const cmd = filtered[i];
    if (cmd) { cmd.run(); onClose(); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); runAt(index); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  return (
    <div className="cmd-overlay" onMouseDown={onClose}>
      <div className="cmd-palette" onMouseDown={e => e.stopPropagation()}>
        <div className="cmd-palette__bar">
          <span className="cmd-palette__prompt">~/cache $</span>
          <input
            ref={inputRef}
            className="cmd-palette__input"
            value={query}
            onChange={e => { setQuery(e.target.value); setIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="run a command..."
            spellCheck={false}
            autoComplete="off"
          />
          <span className="cmd-palette__esc">esc</span>
        </div>
        <div className="cmd-palette__list">
          {filtered.length === 0 ? (
            <div className="cmd-palette__empty">no command matches "{query}"</div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                className={`cmd-palette__item${i === index ? ' cmd-palette__item--active' : ''}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => runAt(i)}
              >
                <span className="cmd-palette__item-label">{cmd.label}</span>
                {cmd.hint && <span className="cmd-palette__item-hint">{cmd.hint}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

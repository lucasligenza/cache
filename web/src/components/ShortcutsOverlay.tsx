import { useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import './ShortcutsOverlay.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: '⌘/ctrl + k', desc: 'command palette' },
  { keys: '1 · 2 · 3 · 4', desc: 'buffer · board · search · review' },
  { keys: '⚙ · ⌘k', desc: 'settings (header gear or palette)' },
  { keys: '/', desc: 'jump to search' },
  { keys: 'n', desc: 'new note (focus capture)' },
  { keys: 'tab', desc: 'pick a category (in capture)' },
  { keys: '/dir …', desc: 'file a note into /dir as you type' },
  { keys: '?', desc: 'this cheatsheet' },
  { keys: 'esc', desc: 'close / cancel' },
];

export function ShortcutsOverlay({ open, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  if (!open) return null;
  return (
    <div
      className="shortcuts-overlay"
      onMouseDown={onClose}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        className="shortcuts-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="keyboard shortcuts"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="shortcuts-panel__header">
          <span className="shortcuts-panel__title">$ man cache — shortcuts</span>
          <button className="shortcuts-panel__close" onClick={onClose}>esc</button>
        </div>
        <div className="shortcuts-panel__list">
          {SHORTCUTS.map(s => (
            <div key={s.keys} className="shortcuts-panel__row">
              <kbd className="shortcuts-panel__keys">{s.keys}</kbd>
              <span className="shortcuts-panel__desc">{s.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

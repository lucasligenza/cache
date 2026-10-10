import { useEffect, useLayoutEffect, useRef, useState, useId } from 'react';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { Category } from '../types';
import './CategoryPicker.css';

interface Props {
  categories: Category[];
  /** The button that opened the picker — used for placement and focus restore. */
  anchorRef: RefObject<HTMLElement>;
  onSelect: (cat: Category) => void;
  onClose: () => void;
  label?: string;
}

const isCoarse = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

const POPOVER_GAP = 4;
const POPOVER_MAX_H = 280;

/**
 * Directory picker shared by "mv →" on note cards (and later the capture bar).
 * Fine pointers get a popover anchored to the trigger; touch gets a bottom
 * sheet in the thumb zone. It's portalled to <body> because note cards keep a
 * transform from their enter animation, which would trap `position: fixed`.
 */
export function CategoryPicker({ categories, anchorRef, onSelect, onClose, label = 'mv →' }: Props) {
  const [sheet] = useState(isCoarse);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<React.CSSProperties | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  useLayoutEffect(() => {
    if (sheet) return;
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) { setPos({}); return; }
    const below = window.innerHeight - rect.bottom;
    const placeAbove = below < POPOVER_MAX_H && rect.top > below;
    setPos({
      right: Math.max(8, window.innerWidth - rect.right),
      ...(placeAbove
        ? { bottom: window.innerHeight - rect.top + POPOVER_GAP }
        : { top: rect.bottom + POPOVER_GAP }),
    });
  }, [sheet, anchorRef]);

  const ready = sheet || pos !== null;
  useEffect(() => {
    if (ready) listRef.current?.focus({ preventScroll: true });
  }, [ready]);

  useEffect(() => {
    const anchor = anchorRef.current;
    return () => { anchor?.focus({ preventScroll: true }); };
  }, [anchorRef]);

  // A popover pinned to viewport coords goes stale as soon as the list scrolls.
  useEffect(() => {
    if (sheet) return;
    const close = (e: Event) => {
      if (e.target instanceof Node && listRef.current?.contains(e.target)) return;
      onClose();
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [sheet, onClose]);

  useEffect(() => {
    document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const choose = (i: number) => {
    const cat = categories[i];
    if (cat) onSelect(cat);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Keep the app's single-key shortcuts (1-4, /, n, ?) from firing underneath.
    e.stopPropagation();
    const last = categories.length - 1;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActive(i => Math.min(i + 1, last)); return;
      case 'ArrowUp': e.preventDefault(); setActive(i => Math.max(i - 1, 0)); return;
      case 'Home': e.preventDefault(); setActive(0); return;
      case 'End': e.preventDefault(); setActive(last); return;
      case 'Enter': case ' ': e.preventDefault(); choose(active); return;
      case 'Escape': case 'Tab': e.preventDefault(); onClose(); return;
    }
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const ch = e.key.toLowerCase();
      const order = categories.map((_, i) => (active + 1 + i) % categories.length);
      const hit = order.find(i => categories[i].name.toLowerCase().startsWith(ch));
      if (hit !== undefined) setActive(hit);
    }
  };

  if (!ready) return null;

  return createPortal(
    <>
      <div
        className={`category-picker__backdrop${sheet ? ' category-picker__backdrop--sheet' : ''}`}
        onMouseDown={e => { e.preventDefault(); onClose(); }}
        aria-hidden="true"
      />
      <div
        className={`category-picker${sheet ? ' category-picker--sheet' : ''}`}
        style={sheet ? undefined : pos ?? undefined}
      >
        <div className="category-picker__title" aria-hidden="true">{label}</div>
        <div
          ref={listRef}
          className="category-picker__list"
          role="listbox"
          tabIndex={-1}
          aria-label="move to directory"
          aria-activedescendant={categories.length ? optionId(active) : undefined}
          onKeyDown={handleKeyDown}
        >
          {categories.map((cat, i) => (
            <div
              key={cat.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              className={`category-picker__option${i === active ? ' category-picker__option--active' : ''}`}
              style={{ color: cat.color }}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(i)}
            >
              <span className="category-picker__swatch" style={{ background: cat.color }} />
              /{cat.name.toLowerCase()}
            </div>
          ))}
        </div>
        {sheet && (
          <button type="button" className="category-picker__cancel" onClick={onClose}>
            cancel
          </button>
        )}
      </div>
    </>,
    document.body,
  );
}

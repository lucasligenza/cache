import { createRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryPicker } from './CategoryPicker';
import noteCardCss from './NoteCard.css?raw';
import pickerCss from './CategoryPicker.css?raw';
import type { Category } from '../types';

const now = new Date().toISOString();
const cats: Category[] = [
  { id: 'w', name: 'Work', color: '#F5A623', created_at: now },
  { id: 's', name: 'School', color: '#39FF14', created_at: now },
  { id: 'p', name: 'Personal', color: '#00FFFF', created_at: now },
];

function renderPicker(overrides: Partial<Parameters<typeof CategoryPicker>[0]> = {}) {
  const anchorRef = createRef<HTMLButtonElement>();
  const onSelect = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <>
      <button ref={anchorRef}>mv →</button>
      <CategoryPicker categories={cats} anchorRef={anchorRef} onSelect={onSelect} onClose={onClose} {...overrides} />
    </>
  );
  return { ...utils, anchorRef, onSelect, onClose, list: screen.getByRole('listbox') };
}

describe('CategoryPicker', () => {
  it('focuses the listbox with the first option active', () => {
    const { list } = renderPicker();
    expect(list).toHaveFocus();
    expect(screen.getByRole('option', { name: '/work' })).toHaveAttribute('aria-selected', 'true');
    expect(list.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: '/work' }).id);
  });

  it('arrow keys move the active option and Enter selects it', () => {
    const { list, onSelect } = renderPicker();
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: '/personal' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(cats[1]);
  });

  it('typing a letter jumps to the next matching directory', () => {
    const { list } = renderPicker();
    fireEvent.keyDown(list, { key: 'p' });
    expect(screen.getByRole('option', { name: '/personal' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(list, { key: 's' });
    expect(screen.getByRole('option', { name: '/school' })).toHaveAttribute('aria-selected', 'true');
  });

  it('Escape and Tab close it', () => {
    const { list, onClose } = renderPicker();
    fireEvent.keyDown(list, { key: 'Escape' });
    fireEvent.keyDown(list, { key: 'Tab' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('restores focus to the trigger when it closes', () => {
    const anchorRef = createRef<HTMLButtonElement>();
    const { rerender } = render(
      <>
        <button ref={anchorRef}>mv →</button>
        <CategoryPicker categories={cats} anchorRef={anchorRef} onSelect={vi.fn()} onClose={vi.fn()} />
      </>
    );
    rerender(<button ref={anchorRef}>mv →</button>);
    expect(anchorRef.current).toHaveFocus();
  });

  it('keeps the app\'s single-key shortcuts from firing underneath', () => {
    const onWindowKey = vi.fn();
    window.addEventListener('keydown', onWindowKey);
    try {
      const { list } = renderPicker();
      fireEvent.keyDown(list, { key: '2' });
      fireEvent.keyDown(list, { key: '/' });
      expect(onWindowKey).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', onWindowKey);
    }
  });

  it('clicking an option selects it; clicking the backdrop closes', () => {
    const { onSelect, onClose } = renderPicker();
    fireEvent.click(screen.getByRole('option', { name: '/school' }));
    expect(onSelect).toHaveBeenCalledWith(cats[1]);
    fireEvent.mouseDown(document.querySelector('.category-picker__backdrop')!);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders as a bottom sheet with a cancel button on touch', () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q === '(pointer: coarse)', media: q })) as unknown as typeof window.matchMedia;
    try {
      const { onClose } = renderPicker();
      expect(document.querySelector('.category-picker--sheet')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
      expect(onClose).toHaveBeenCalled();
    } finally {
      window.matchMedia = original;
    }
  });
});

describe('note card styles', () => {
  it.each([['NoteCard.css', noteCardCss], ['CategoryPicker.css', pickerCss]])(
    '%s uses theme tokens only (no hardcoded hex/rgb)',
    (_name, css) => {
      expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(css).not.toMatch(/rgba?\(/);
    },
  );
});

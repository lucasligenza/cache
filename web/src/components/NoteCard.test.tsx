import { render, screen, fireEvent } from '@testing-library/react';
import { NoteCard } from './NoteCard';
import { ToastProvider } from './Toast';
import type { Note, Category } from '../types';

const now = new Date().toISOString();
const mockNote: Note = {
  id: '1', text: 'buy coffee pods', created_at: now, updated_at: now,
  category_id: null, color: null, remind_at: null,
  pending_review: false, pinned: false, archived_at: null, reviewed_at: null,
};
const mockCategories: Category[] = [
  { id: 'cat1', name: 'Work', color: '#F5A623', created_at: now },
];

function renderCard(overrides: Partial<Parameters<typeof NoteCard>[0]> = {}) {
  return render(
    <ToastProvider>
      <NoteCard
        note={mockNote}
        categories={mockCategories}
        onAssign={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        {...overrides}
      />
    </ToastProvider>
  );
}

describe('NoteCard', () => {
  it('renders note text', () => {
    renderCard();
    expect(screen.getByText('buy coffee pods')).toBeInTheDocument();
  });

  it('enters edit mode on text click', () => {
    renderCard();
    fireEvent.click(screen.getByText('buy coffee pods'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByText(/enter ↵ save/)).toBeInTheDocument();
  });

  it('calls onUpdate with trimmed text on Enter', () => {
    const onUpdate = vi.fn();
    renderCard({ onUpdate });
    fireEvent.click(screen.getByText('buy coffee pods'));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: ' buy oat milk ' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalledWith('1', { text: 'buy oat milk' });
  });

  it('does not call onUpdate when text is unchanged on Enter', () => {
    const onUpdate = vi.fn();
    renderCard({ onUpdate });
    fireEvent.click(screen.getByText('buy coffee pods'));
    const textarea = screen.getByRole('textbox');
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('cancels edit on Escape without calling onUpdate', () => {
    const onUpdate = vi.fn();
    renderCard({ onUpdate });
    fireEvent.click(screen.getByText('buy coffee pods'));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'something else' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('buy coffee pods')).toBeInTheDocument();
  });

  it('shows confirm state on rm click', () => {
    renderCard();
    fireEvent.click(screen.getByText('rm'));
    expect(screen.getByText('rm note?')).toBeInTheDocument();
    expect(screen.getByText('cancel')).toBeInTheDocument();
  });

  it('cancels delete on cancel click', () => {
    const onDelete = vi.fn();
    renderCard({ onDelete });
    fireEvent.click(screen.getByText('rm'));
    fireEvent.click(screen.getByText('cancel'));
    expect(screen.getByText('buy coffee pods')).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('calls onDelete after confirming rm', () => {
    vi.useFakeTimers();
    try {
      const onDelete = vi.fn();
      renderCard({ onDelete });
      fireEvent.click(screen.getByText('rm'));
      const confirmBtn = screen.getByRole('button', { name: 'rm' });
      fireEvent.click(confirmBtn);
      vi.advanceTimersByTime(280);
      expect(onDelete).toHaveBeenCalledWith('1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('plays a filing animation in the category color, then assigns', () => {
    vi.useFakeTimers();
    try {
      const onAssign = vi.fn();
      const { container } = renderCard({ onAssign, showCategories: true });
      fireEvent.click(screen.getByText('/work'));

      const filing = container.querySelector('.note-card--filing') as HTMLElement | null;
      expect(filing).not.toBeNull();
      expect(filing!.style.getPropertyValue('--filing-color')).toBe('#F5A623');
      // still on screen mid-animation — not assigned until it finishes
      expect(onAssign).not.toHaveBeenCalled();

      vi.advanceTimersByTime(340);
      expect(onAssign).toHaveBeenCalledWith('1', 'cat1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows a [queued] marker while the note is pending sync', () => {
    renderCard({ note: { ...mockNote, pending: true } });
    expect(screen.getByText('[queued]')).toBeInTheDocument();
  });

  it('does not show [queued] for a synced note', () => {
    renderCard();
    expect(screen.queryByText('[queued]')).not.toBeInTheDocument();
  });

  it('review mode: the mute chip silences the note (never-nag)', () => {
    const onUpdate = vi.fn();
    renderCard({ onUpdate, reviewMode: true });
    fireEvent.click(screen.getByText('mute'));
    expect(onUpdate).toHaveBeenCalledWith('1', { review_muted: true });
  });

  it('a muted note shows an unmute chip in the normal view', () => {
    const onUpdate = vi.fn();
    renderCard({ onUpdate, note: { ...mockNote, review_muted: true } });
    fireEvent.click(screen.getByText('muted'));
    expect(onUpdate).toHaveBeenCalledWith('1', { review_muted: false });
  });

  it('does not show a mute chip on a normal note in the normal view', () => {
    renderCard();
    expect(screen.queryByText('mute')).not.toBeInTheDocument();
    expect(screen.queryByText('muted')).not.toBeInTheDocument();
  });
});

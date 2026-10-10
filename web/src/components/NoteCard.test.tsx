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
    expect(screen.getByText(/↵ save · esc cancel/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'cancel' })).toBeInTheDocument();
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
    expect(screen.getByText('move to trash?')).toBeInTheDocument();
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
      fireEvent.click(screen.getByRole('button', { name: 'mv →' }));
      fireEvent.click(screen.getByRole('option', { name: '/work' }));

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

  it('review mode: "stop resurfacing" silences the note (never-nag)', () => {
    const onUpdate = vi.fn();
    renderCard({ onUpdate, reviewMode: true });
    fireEvent.click(screen.getByRole('button', { name: 'stop resurfacing' }));
    expect(onUpdate).toHaveBeenCalledWith('1', { review_muted: true });
  });

  it('a muted note shows a badge that re-enables resurfacing', () => {
    const onUpdate = vi.fn();
    renderCard({ onUpdate, note: { ...mockNote, review_muted: true } });
    fireEvent.click(screen.getByRole('button', { name: /allow resurfacing/ }));
    expect(onUpdate).toHaveBeenCalledWith('1', { review_muted: false });
  });

  it('buffer cards show one mv → instead of a chip per directory', () => {
    const cats: Category[] = [
      ...mockCategories,
      { id: 'cat2', name: 'School', color: '#39FF14', created_at: now },
      { id: 'cat3', name: 'Date Ideas', color: '#BF5FFF', created_at: now },
    ];
    renderCard({ categories: cats, showCategories: true });
    expect(screen.getAllByRole('button', { name: 'mv →' })).toHaveLength(1);
    expect(screen.queryByText('/work')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'mv →' }));
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['/work', '/school', '/date ideas']);
  });

  it('offers mv → as a secondary action when not promoted (board)', () => {
    renderCard();
    expect(screen.getByRole('button', { name: 'mv →' }).closest('.note-card__secondary')).not.toBeNull();
  });

  it('hides mv → when there is nowhere to move to', () => {
    renderCard({ categories: [], showCategories: true });
    expect(screen.queryByRole('button', { name: 'mv →' })).not.toBeInTheDocument();
  });

  it('ping presets schedule a reminder and close the panel', () => {
    const onUpdate = vi.fn();
    renderCard({ onUpdate });
    fireEvent.click(screen.getByRole('button', { name: 'ping' }));
    const before = Date.now();
    fireEvent.click(screen.getByRole('button', { name: '+1h' }));
    const [id, updates] = onUpdate.mock.calls[0];
    expect(id).toBe('1');
    expect(Object.keys(updates)).toEqual(['remind_at']);
    const at = new Date(updates.remind_at).getTime();
    expect(at).toBeGreaterThanOrEqual(before + 3_600_000 - 50);
    expect(at).toBeLessThanOrEqual(Date.now() + 3_600_000 + 50);
    expect(screen.queryByRole('button', { name: '+1h' })).not.toBeInTheDocument();
  });

  it('custom ping takes a datetime', () => {
    const onUpdate = vi.fn();
    renderCard({ onUpdate });
    fireEvent.click(screen.getByRole('button', { name: 'ping' }));
    fireEvent.click(screen.getByRole('button', { name: 'custom' }));
    fireEvent.change(screen.getByLabelText('custom ping time'), { target: { value: '2030-01-02T09:30' } });
    expect(onUpdate).toHaveBeenCalledWith('1', { remind_at: new Date('2030-01-02T09:30').toISOString() });
  });

  it('an overdue ping is always visible and opens snooze presets + clear', () => {
    const onUpdate = vi.fn();
    const past = new Date(Date.now() - 60_000).toISOString();
    renderCard({ onUpdate, note: { ...mockNote, remind_at: past } });
    fireEvent.click(screen.getByRole('button', { name: '⚠ overdue' }));
    fireEvent.click(screen.getByRole('button', { name: '×clear' }));
    expect(onUpdate).toHaveBeenCalledWith('1', { remind_at: null });
  });

  it('flag and pin are set from the actions and cleared from their status badges', () => {
    const onUpdate = vi.fn();
    const { rerender } = renderCard({ onUpdate });
    fireEvent.click(screen.getByRole('button', { name: '⚑ flag' }));
    expect(onUpdate).toHaveBeenLastCalledWith('1', { pending_review: true });
    fireEvent.click(screen.getByRole('button', { name: '★ pin' }));
    expect(onUpdate).toHaveBeenLastCalledWith('1', { pinned: true });

    rerender(
      <ToastProvider>
        <NoteCard note={{ ...mockNote, pending_review: true, pinned: true }} categories={mockCategories}
          onAssign={vi.fn()} onDelete={vi.fn()} onUpdate={onUpdate} />
      </ToastProvider>
    );
    expect(screen.queryByRole('button', { name: '⚑ flag' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /flagged — unflag/ }));
    expect(onUpdate).toHaveBeenLastCalledWith('1', { pending_review: false });
    fireEvent.click(screen.getByRole('button', { name: /pinned — unpin/ }));
    expect(onUpdate).toHaveBeenLastCalledWith('1', { pinned: false });
  });

  it('⋯ toggles the secondary action tray (touch)', () => {
    const { container } = renderCard();
    const more = screen.getByRole('button', { name: 'more actions' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelector('.note-card--more-open')).not.toBeNull();
    expect(document.getElementById(more.getAttribute('aria-controls')!)).toHaveClass('note-card__secondary');
  });

  it('edit: [cancel] discards and [save] saves', () => {
    const onUpdate = vi.fn();
    renderCard({ onUpdate });
    fireEvent.click(screen.getByText('buy coffee pods'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('buy coffee pods')).toBeInTheDocument();

    fireEvent.click(screen.getByText('buy coffee pods'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'buy tea' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith('1', { text: 'buy tea' });
  });

  it('edit: blurring onto [cancel] (Android focuses tapped buttons) does not save', () => {
    const onUpdate = vi.fn();
    renderCard({ onUpdate });
    fireEvent.click(screen.getByText('buy coffee pods'));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'nope' } });
    const cancel = screen.getByRole('button', { name: 'cancel' });
    fireEvent.blur(textarea, { relatedTarget: cancel });
    fireEvent.click(cancel);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('edit: blur elsewhere still saves', () => {
    const onUpdate = vi.fn();
    renderCard({ onUpdate });
    fireEvent.click(screen.getByText('buy coffee pods'));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'buy beans' } });
    fireEvent.blur(textarea);
    expect(onUpdate).toHaveBeenCalledWith('1', { text: 'buy beans' });
  });

  it('review mode: [✓ seen] acknowledges the note', () => {
    const onUpdate = vi.fn();
    renderCard({ onUpdate, reviewMode: true, note: { ...mockNote, pending_review: true } });
    fireEvent.click(screen.getByRole('button', { name: '✓ seen' }));
    expect(onUpdate).toHaveBeenCalledWith('1', { reviewed_at: expect.any(String), pending_review: false });
  });

  it('review mode: an overdue note gets [✓ done], which clears the ping', () => {
    const onUpdate = vi.fn();
    const past = new Date(Date.now() - 60_000).toISOString();
    renderCard({ onUpdate, reviewMode: true, note: { ...mockNote, remind_at: past } });
    fireEvent.click(screen.getByRole('button', { name: '✓ done' }));
    expect(onUpdate).toHaveBeenCalledWith('1', { reviewed_at: expect.any(String), pending_review: false, remind_at: null });
  });

  it('review mode: [snooze] reschedules and takes the note out of today\'s review', () => {
    const onUpdate = vi.fn();
    renderCard({ onUpdate, reviewMode: true, note: { ...mockNote, pending_review: true } });
    fireEvent.click(screen.getByRole('button', { name: 'snooze' }));
    expect(screen.getByText('snooze:')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+1d' }));
    expect(onUpdate).toHaveBeenCalledWith('1', {
      remind_at: expect.any(String), reviewed_at: expect.any(String), pending_review: false,
    });
  });

  it('review mode keeps mv →, flag, pin and rm reachable as secondary actions', () => {
    renderCard({ reviewMode: true, showCategories: true });
    for (const name of ['mv →', '⚑ flag', '★ pin', 'stop resurfacing', 'rm']) {
      expect(screen.getByRole('button', { name }).closest('.note-card__secondary')).not.toBeNull();
    }
    expect(screen.queryByRole('button', { name: 'ping' })).not.toBeInTheDocument();
  });

  it('does not offer resurfacing controls on a normal note in the normal view', () => {
    renderCard();
    expect(screen.queryByText('stop resurfacing')).not.toBeInTheDocument();
    expect(screen.queryByText(/no resurface/)).not.toBeInTheDocument();
  });
});

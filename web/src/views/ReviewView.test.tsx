import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewView } from './ReviewView';
import { ToastProvider } from '../components/Toast';
import type { Note } from '../types';

const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

function note(o: Partial<Note> = {}): Note {
  const iso = ago(0);
  return {
    id: 'x', text: 'a note', created_at: iso, updated_at: iso, category_id: 'c1',
    color: null, remind_at: null, pending_review: false, pinned: false,
    archived_at: null, reviewed_at: null, review_muted: false, ...o,
  };
}

function renderReview(notes: Note[]) {
  return render(
    <ToastProvider>
      <ReviewView notes={notes} categories={[]} onAssign={vi.fn()} onDelete={vi.fn()} onUpdate={vi.fn()} />
    </ToastProvider>
  );
}

describe('ReviewView', () => {
  it('shows the inbox-zero empty state when nothing is due', () => {
    renderReview([]);
    expect(screen.getByText(/inbox zero/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing to review right now/i)).toBeInTheDocument();
  });

  it('rewards a cleared day in the empty state', () => {
    // Reviewed today, has a category, freshly touched → in no bucket, but counted.
    renderReview([note({ id: 'done', reviewed_at: ago(0) })]);
    expect(screen.getByText(/inbox zero/i)).toBeInTheDocument();
    expect(screen.getByText(/cleared 1 today/i)).toBeInTheDocument();
  });

  it('groups overdue + flagged notes and headers them as "need attention"', () => {
    renderReview([
      note({ id: 'od', text: 'overdue note', remind_at: ago(2 * 60 * 60 * 1000) }),
      note({ id: 'fl', text: 'flagged note', pending_review: true }),
    ]);
    expect(screen.getByText(/2 need attention/i)).toBeInTheDocument();
    expect(screen.getByText(/overdue ping/i)).toBeInTheDocument();
    expect(screen.getByText(/flagged for review/i)).toBeInTheDocument();
    expect(screen.getByText('overdue note')).toBeInTheDocument();
    expect(screen.getByText('flagged note')).toBeInTheDocument();
  });

  it('headers a resurfaced-only set as "to revisit" (gentle, not urgent)', () => {
    renderReview([note({ id: 'rs', text: 'old note', updated_at: ago(30 * DAY) })]);
    expect(screen.getByText(/1 to revisit/i)).toBeInTheDocument();
    expect(screen.getByText(/resurfaced/i)).toBeInTheDocument();
    expect(screen.getByText('old note')).toBeInTheDocument();
  });
});

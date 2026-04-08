import { render, screen, fireEvent } from '@testing-library/react';
import { SearchView } from './SearchView';
import type { Note, Category } from '../types';

const now = new Date().toISOString();

const mockNotes: Note[] = [
  {
    id: '1', text: 'call dan about the meeting agenda', created_at: now, updated_at: now,
    category_id: 'cat1', color: null, remind_at: null, pending_review: false, pinned: false, archived_at: null,
  },
  {
    id: '2', text: 'buy coffee pods', created_at: now, updated_at: now,
    category_id: null, color: null, remind_at: null, pending_review: false, pinned: false, archived_at: null,
  },
];

const mockCategories: Category[] = [
  { id: 'cat1', name: 'Work', color: '#F5A623', created_at: now },
];

describe('SearchView', () => {
  it('shows recent notes in empty state before typing', () => {
    render(<SearchView notes={mockNotes} categories={mockCategories} onNavigate={vi.fn()} />);
    expect(screen.getByText('call dan about the meeting agenda')).toBeInTheDocument();
    expect(screen.getByText('buy coffee pods')).toBeInTheDocument();
  });

  it('filters notes by query', () => {
    render(<SearchView notes={mockNotes} categories={mockCategories} onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'meeting' } });
    expect(screen.getByText(/meeting/)).toBeInTheDocument();
    expect(screen.queryByText('buy coffee pods')).not.toBeInTheDocument();
  });

  it('shows result count when query is active', () => {
    render(<SearchView notes={mockNotes} categories={mockCategories} onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'meeting' } });
    expect(screen.getByText('1 result')).toBeInTheDocument();
  });

  it('shows no results message for unmatched query', () => {
    render(<SearchView notes={mockNotes} categories={mockCategories} onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'xyznotfound' } });
    expect(screen.getByText(/no results for/)).toBeInTheDocument();
  });

  it('clears query on Escape', () => {
    render(<SearchView notes={mockNotes} categories={mockCategories} onNavigate={vi.fn()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'meeting' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('calls onNavigate with board when categorized result is clicked', () => {
    const onNavigate = vi.fn();
    render(<SearchView notes={mockNotes} categories={mockCategories} onNavigate={onNavigate} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'meeting' } });
    fireEvent.click(screen.getByText(/meeting/));
    expect(onNavigate).toHaveBeenCalledWith('board');
  });

  it('calls onNavigate with buffer when uncategorized result is clicked', () => {
    const onNavigate = vi.fn();
    render(<SearchView notes={mockNotes} categories={mockCategories} onNavigate={onNavigate} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'coffee' } });
    fireEvent.click(screen.getByText(/coffee/));
    expect(onNavigate).toHaveBeenCalledWith('buffer');
  });
});

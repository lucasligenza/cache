import { render, screen, fireEvent } from '@testing-library/react';
import { BoardView } from './BoardView';
import { ToastProvider } from '../components/Toast';
import type { Category } from '../types';

const now = new Date().toISOString();
const mockCategories: Category[] = [
  { id: 'cat1', name: 'Work', color: '#F5A623', created_at: now },
];

function renderBoard(overrides: Partial<Parameters<typeof BoardView>[0]> = {}) {
  return render(
    <ToastProvider>
      <BoardView
        categories={mockCategories}
        getNotesByCategory={() => []}
        onUpdateNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onCreateCategory={vi.fn()}
        onRenameCategory={vi.fn()}
        onDeleteCategory={vi.fn()}
        {...overrides}
      />
    </ToastProvider>
  );
}

describe('BoardView category delete', () => {
  it('shows confirm row when rm is clicked in settings', () => {
    renderBoard();
    fireEvent.click(screen.getByText('+ config'));
    fireEvent.click(screen.getByText('rm'));
    expect(screen.getByText(/rm \/work\?/)).toBeInTheDocument();
    expect(screen.getByText('cancel')).toBeInTheDocument();
  });

  it('cancels delete on cancel click', () => {
    renderBoard();
    fireEvent.click(screen.getByText('+ config'));
    fireEvent.click(screen.getByText('rm'));
    fireEvent.click(screen.getByText('cancel'));
    expect(screen.queryByText(/rm \/work\?/)).not.toBeInTheDocument();
  });

  it('calls onDeleteCategory when confirm rm is clicked', () => {
    const onDeleteCategory = vi.fn();
    renderBoard({ onDeleteCategory });
    fireEvent.click(screen.getByText('+ config'));
    fireEvent.click(screen.getByText('rm'));
    fireEvent.click(screen.getByRole('button', { name: 'rm' }));
    expect(onDeleteCategory).toHaveBeenCalledWith('cat1');
  });
});

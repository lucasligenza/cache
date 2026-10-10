import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncIssues } from './SyncIssues';
import { ConnectionError } from './ConnectionError';
import type { Note } from '../types';

const failed: Note = {
  id: 'f1', text: 'a note the server rejected', created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z', category_id: null, color: null, remind_at: null,
  pending_review: false, pinned: false, archived_at: null, reviewed_at: null,
  pending: true, syncError: 'note too long',
};

function setup(notes: Note[] = [failed]) {
  const props = { onRetry: vi.fn(), onEdit: vi.fn(), onExport: vi.fn(), onDiscard: vi.fn() };
  render(<SyncIssues notes={notes} {...props} />);
  return props;
}

describe('SyncIssues', () => {
  it('renders nothing when every note synced', () => {
    const { container } = render(
      <SyncIssues notes={[]} onRetry={vi.fn()} onEdit={vi.fn()} onExport={vi.fn()} onDiscard={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('summarises the failures with retry and export', async () => {
    const props = setup();
    expect(screen.getByText(/1 note couldn't sync/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '[retry]' }));
    expect(props.onRetry).toHaveBeenCalledWith();
    await userEvent.click(screen.getByRole('button', { name: '[export]' }));
    expect(props.onExport).toHaveBeenCalled();
  });

  it('lists each note with its reason and per-note actions', async () => {
    const props = setup();
    await userEvent.click(screen.getByRole('button', { name: '[details]' }));
    expect(screen.getByText('a note the server rejected')).toBeInTheDocument();
    expect(screen.getByText('note too long')).toBeInTheDocument();

    const retryButtons = screen.getAllByRole('button', { name: '[retry]' });
    await userEvent.click(retryButtons[retryButtons.length - 1]);
    expect(props.onRetry).toHaveBeenCalledWith('f1');

    await userEvent.click(screen.getByRole('button', { name: '[edit]' }));
    expect(props.onEdit).toHaveBeenCalledWith(failed);
  });

  it('asks for confirmation before discarding', async () => {
    const props = setup();
    await userEvent.click(screen.getByRole('button', { name: '[details]' }));
    await userEvent.click(screen.getByRole('button', { name: '[discard]' }));
    expect(props.onDiscard).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '[discard forever]' }));
    expect(props.onDiscard).toHaveBeenCalledWith('f1');
  });
});

describe('ConnectionError banner', () => {
  it('says offline captures will sync and offers retry', async () => {
    const onRetry = vi.fn();
    render(<ConnectionError offline onRetry={onRetry} />);
    expect(screen.getByRole('status')).toHaveTextContent('offline — captures will sync');
    await userEvent.click(screen.getByRole('button', { name: '[retry]' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('distinguishes an unreachable server from being offline', () => {
    render(<ConnectionError offline={false} onRetry={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent("can't reach server — captures will sync");
  });

  it('shows a quiet syncing line while a slow load continues', () => {
    render(<ConnectionError offline={false} syncing onRetry={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('syncing notes… capture is ready');
    expect(screen.queryByRole('button')).toBeNull();
  });
});

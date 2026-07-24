import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette, type Command } from './CommandPalette';

function cmds(): { commands: Command[]; runA: () => void; runB: () => void } {
  const runA = vi.fn();
  const runB = vi.fn();
  return {
    runA,
    runB,
    commands: [
      { id: 'a', label: 'archive all', run: runA },
      { id: 'b', label: 'export json', run: runB },
    ],
  };
}

describe('CommandPalette', () => {
  it('renders nothing when closed', () => {
    const { commands } = cmds();
    const { container } = render(<CommandPalette open={false} commands={commands} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is a dialog and lists all commands when open', () => {
    const { commands } = cmds();
    render(<CommandPalette open commands={commands} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: /command palette/i })).toBeInTheDocument();
    expect(screen.getByText('archive all')).toBeInTheDocument();
    expect(screen.getByText('export json')).toBeInTheDocument();
  });

  it('filters by label (case-insensitive substring)', async () => {
    const user = userEvent.setup();
    const { commands } = cmds();
    render(<CommandPalette open commands={commands} onClose={vi.fn()} />);
    await user.type(screen.getByPlaceholderText(/run a command/i), 'EXP');
    expect(screen.getByText('export json')).toBeInTheDocument();
    expect(screen.queryByText('archive all')).not.toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', async () => {
    const user = userEvent.setup();
    const { commands } = cmds();
    render(<CommandPalette open commands={commands} onClose={vi.fn()} />);
    await user.type(screen.getByPlaceholderText(/run a command/i), 'zzz');
    expect(screen.getByText(/no command matches/i)).toBeInTheDocument();
  });

  it('runs the highlighted command on ArrowDown + Enter and closes', async () => {
    const user = userEvent.setup();
    const { commands, runA, runB } = cmds();
    const onClose = vi.fn();
    render(<CommandPalette open commands={commands} onClose={onClose} />);
    await user.keyboard('{ArrowDown}{Enter}'); // index 0 → 1 → run second
    expect(runB).toHaveBeenCalledTimes(1);
    expect(runA).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('runs a command on click', async () => {
    const user = userEvent.setup();
    const { commands, runA } = cmds();
    const onClose = vi.fn();
    render(<CommandPalette open commands={commands} onClose={onClose} />);
    await user.click(screen.getByText('archive all'));
    expect(runA).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { commands } = cmds();
    const onClose = vi.fn();
    render(<CommandPalette open commands={commands} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a mousedown outside the palette (overlay)', () => {
    const { commands } = cmds();
    const onClose = vi.fn();
    const { container } = render(<CommandPalette open commands={commands} onClose={onClose} />);
    fireEvent.mouseDown(container.querySelector('.cmd-overlay')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

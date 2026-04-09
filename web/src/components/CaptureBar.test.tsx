import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CaptureBar } from './CaptureBar';

describe('CaptureBar', () => {
  it('renders the send button', () => {
    render(<CaptureBar categories={[]} onCommit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'send' })).toBeInTheDocument();
  });

  it('send button calls onCommit with the typed text', () => {
    const onCommit = vi.fn();
    render(<CaptureBar categories={[]} onCommit={onCommit} />);

    const textarea = screen.getByPlaceholderText('type a note...');
    fireEvent.change(textarea, { target: { value: 'my note' } });

    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    expect(onCommit).toHaveBeenCalledWith('my note', undefined);
  });

  it('send button does not call onCommit when input is empty', () => {
    const onCommit = vi.fn();
    render(<CaptureBar categories={[]} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('clears the textarea after send', () => {
    render(<CaptureBar categories={[]} onCommit={vi.fn()} />);
    const textarea = screen.getByPlaceholderText('type a note...') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    expect(textarea.value).toBe('');
  });
});

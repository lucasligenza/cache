import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CaptureBar } from './CaptureBar';
import { ToastProvider } from './Toast';
import type { Category } from '../types';

const CATS: Category[] = [{ id: 'c1', name: 'work', color: '#39FF14', created_at: '2026-01-01T00:00:00Z' }];

function renderBar(onCommit: (t: string, c?: string) => Promise<void>, categories: Category[] = []) {
  return render(
    <ToastProvider>
      <CaptureBar categories={categories} onCommit={onCommit} />
    </ToastProvider>
  );
}
const type = (v: string) =>
  fireEvent.change(screen.getByPlaceholderText('type a note...'), { target: { value: v } });
const send = () => fireEvent.click(screen.getByRole('button', { name: 'send' }));

describe('CaptureBar', () => {
  it('renders the send button', () => {
    renderBar(vi.fn().mockResolvedValue(undefined));
    expect(screen.getByRole('button', { name: 'send' })).toBeInTheDocument();
  });

  it('send button calls onCommit with the typed text', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    renderBar(onCommit);
    type('my note');
    send();
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith('my note', undefined));
  });

  it('does not call onCommit when input is empty', () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    renderBar(onCommit);
    send();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('clears the textarea and flashes cached ✓ after a successful send', async () => {
    renderBar(vi.fn().mockResolvedValue(undefined));
    const textarea = screen.getByPlaceholderText('type a note...') as HTMLTextAreaElement;
    type('hello');
    send();
    await waitFor(() => expect(textarea.value).toBe(''));
    expect(screen.getByText('cached ✓')).toBeInTheDocument();
  });

  it('keeps the text and shows no cached flash when the save fails (no loss)', async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error('offline'));
    renderBar(onCommit);
    const textarea = screen.getByPlaceholderText('type a note...') as HTMLTextAreaElement;
    type('precious thought');
    send();
    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    expect(textarea.value).toBe('precious thought');
    expect(screen.queryByText('cached ✓')).not.toBeInTheDocument();
  });

  it('routes /dir with a body to the matching category', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    renderBar(onCommit, CATS);
    type('/work buy milk');
    send();
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith('buy milk', 'c1'));
  });

  it('files an unknown /dir verbatim to buffer and warns', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    renderBar(onCommit, CATS);
    type('/todo buy milk');
    send();
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith('/todo buy milk', undefined));
    expect(await screen.findByText(/no category 'todo'/)).toBeInTheDocument();
  });

  it('does not commit a body-less /dir and hints instead', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    renderBar(onCommit, CATS);
    const textarea = screen.getByPlaceholderText('type a note...') as HTMLTextAreaElement;
    type('/work');
    send();
    expect(await screen.findByText(/add a note after \/work/)).toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();
    expect(textarea.value).toBe('/work');
  });
});

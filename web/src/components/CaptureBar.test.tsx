import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('labels the iOS return key as send', () => {
    renderBar(vi.fn().mockResolvedValue(undefined));
    const textarea = screen.getByPlaceholderText('type a note...') as HTMLTextAreaElement;
    expect(textarea).toHaveAttribute('enterkeyhint', 'send');
  });

  describe('multi-word /dir', () => {
    const MULTI: Category[] = [
      ...CATS,
      { id: 'c2', name: 'Date', color: '#BF5FFF', created_at: '2026-01-01T00:00:00Z' },
      { id: 'c3', name: 'Date Ideas', color: '#BF5FFF', created_at: '2026-01-01T00:00:00Z' },
    ];

    it('routes /date ideas … to the "Date Ideas" category', async () => {
      const onCommit = vi.fn().mockResolvedValue(undefined);
      renderBar(onCommit, MULTI);
      type('/date ideas picnic in the park');
      send();
      await waitFor(() => expect(onCommit).toHaveBeenCalledWith('picnic in the park', 'c3'));
    });

    it('routes the slug form /date-ideas …', async () => {
      const onCommit = vi.fn().mockResolvedValue(undefined);
      renderBar(onCommit, MULTI);
      type('/date-ideas picnic');
      send();
      await waitFor(() => expect(onCommit).toHaveBeenCalledWith('picnic', 'c3'));
    });

    it('falls back to the shorter name when the longer one does not match', async () => {
      const onCommit = vi.fn().mockResolvedValue(undefined);
      renderBar(onCommit, MULTI);
      type('/date night out');
      send();
      await waitFor(() => expect(onCommit).toHaveBeenCalledWith('night out', 'c2'));
    });

    it('shows the multi-word target live in the category button', () => {
      renderBar(vi.fn().mockResolvedValue(undefined), MULTI);
      type('/date ideas picnic');
      expect(screen.getByRole('combobox', { name: 'file to' })).toHaveTextContent('→ /date ideas');
    });

    it('hints on a body-less multi-word /dir instead of committing', async () => {
      const onCommit = vi.fn().mockResolvedValue(undefined);
      renderBar(onCommit, MULTI);
      type('/date ideas');
      send();
      expect(await screen.findByText(/add a note after \/date ideas/)).toBeInTheDocument();
      expect(onCommit).not.toHaveBeenCalled();
    });
  });

  describe('keyboard (no trap — WCAG 2.1.2)', () => {
    const textarea = () => screen.getByPlaceholderText('type a note...') as HTMLTextAreaElement;
    const catBtn = () => screen.getByRole('combobox', { name: 'file to' });

    it('Tab leaves an empty capture field', async () => {
      const user = userEvent.setup();
      renderBar(vi.fn().mockResolvedValue(undefined), CATS);
      expect(textarea()).toHaveFocus();
      await user.tab();
      expect(textarea()).not.toHaveFocus();
      expect(catBtn()).toHaveFocus();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('Shift+Tab is never intercepted, even with text', async () => {
      const user = userEvent.setup();
      renderBar(vi.fn().mockResolvedValue(undefined), CATS);
      await user.type(textarea(), 'a thought');
      expect(fireEvent.keyDown(textarea(), { key: 'Tab', shiftKey: true })).toBe(true);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('Tab with text opens the picker; the next Tab closes it and moves focus on', async () => {
      const user = userEvent.setup();
      renderBar(vi.fn().mockResolvedValue(undefined), CATS);
      await user.type(textarea(), 'a thought');

      await user.tab();
      expect(textarea()).toHaveFocus();
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(catBtn()).toHaveAttribute('aria-expanded', 'true');

      await user.tab();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(catBtn()).toHaveAttribute('aria-expanded', 'false');
      expect(textarea()).not.toHaveFocus();
      expect(textarea().value).toBe('a thought');
    });

    it('exposes the picker as a listbox driven by aria-activedescendant', async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn().mockResolvedValue(undefined);
      renderBar(onCommit, CATS);
      await user.type(textarea(), 'buy milk');
      await user.tab();

      const options = screen.getAllByRole('option');
      expect(options.map(o => o.textContent)).toEqual(['→ buffer', '/work']);
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
      expect(textarea()).toHaveAttribute('aria-activedescendant', options[0].id);
      expect(textarea()).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);

      await user.keyboard('{ArrowDown}');
      expect(options[1]).toHaveAttribute('aria-selected', 'true');
      expect(textarea()).toHaveAttribute('aria-activedescendant', options[1].id);

      await user.keyboard('{Enter}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(textarea().value).toBe('buy milk');
      expect(catBtn()).toHaveTextContent('→ /work');

      await user.keyboard('{Enter}');
      await waitFor(() => expect(onCommit).toHaveBeenCalledWith('buy milk', 'c1'));
    });

    it('picker options are not separate tab stops', async () => {
      const user = userEvent.setup();
      renderBar(vi.fn().mockResolvedValue(undefined), CATS);
      await user.type(textarea(), 'x');
      await user.tab();
      screen.getAllByRole('option').forEach(o => expect(o).toHaveAttribute('tabindex', '-1'));
    });

    it('the category button opens and drives the picker from the keyboard', async () => {
      const user = userEvent.setup();
      renderBar(vi.fn().mockResolvedValue(undefined), CATS);
      catBtn().focus();
      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(catBtn()).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[0].id);
      await user.keyboard('{ArrowDown}{Enter}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(catBtn()).toHaveTextContent('→ /work');
    });

    it('Escape closes the picker without leaving the field', async () => {
      const user = userEvent.setup();
      renderBar(vi.fn().mockResolvedValue(undefined), CATS);
      await user.type(textarea(), 'x');
      await user.tab();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(textarea()).toHaveFocus();
    });
  });

  it('disables send while a commit is in flight', async () => {
    let resolveCommit: () => void = () => {};
    const onCommit = vi.fn().mockImplementation(
      () => new Promise<void>(resolve => { resolveCommit = resolve; })
    );
    renderBar(onCommit);
    type('in flight');
    send();
    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'send' })).toBeDisabled();
    resolveCommit();
    await waitFor(() => expect(screen.getByRole('button', { name: 'send' })).not.toBeDisabled());
  });
});

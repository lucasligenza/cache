import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingOverlay } from './OnboardingOverlay';

describe('OnboardingOverlay', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<OnboardingOverlay open={false} onDismiss={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the welcome dialog with tips when open', () => {
    render(<OnboardingOverlay open onDismiss={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: /welcome to cache/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/cache a note into the buffer/i)).toBeInTheDocument();
  });

  it('dismisses via the [ got it ] button', async () => {
    const onDismiss = vi.fn();
    render(<OnboardingOverlay open onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses on Escape', async () => {
    const onDismiss = vi.fn();
    render(<OnboardingOverlay open onDismiss={onDismiss} />);
    await userEvent.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

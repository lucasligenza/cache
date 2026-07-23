import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AppHeader } from './AppHeader';

describe('AppHeader', () => {
  it('renders the brand text', () => {
    render(<AppHeader />);
    expect(screen.getByText('~/cache')).toBeInTheDocument();
  });

  it('shows a queued count while notes are pending sync', () => {
    render(<AppHeader pendingCount={2} />);
    expect(screen.getByText(/2 queued/)).toBeInTheDocument();
  });

  it('hides the queued count when nothing is pending', () => {
    render(<AppHeader pendingCount={0} />);
    expect(screen.queryByText(/queued/)).not.toBeInTheDocument();
  });
});

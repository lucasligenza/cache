import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

// Suppress console.error noise from intentional throws
beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

function BoomComponent(): JSX.Element {
  throw new Error('test crash');
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>safe content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('safe content')).toBeInTheDocument();
  });

  it('shows fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <BoomComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText(/FATAL ERROR/)).toBeInTheDocument();
    expect(screen.getByText(/segmentation fault/)).toBeInTheDocument();
    expect(screen.getByText('[reload]')).toBeInTheDocument();
  });
});

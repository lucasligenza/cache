import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AppHeader } from './AppHeader';

describe('AppHeader', () => {
  it('renders the brand text', () => {
    render(<AppHeader />);
    expect(screen.getByText('~/cache')).toBeInTheDocument();
  });
});

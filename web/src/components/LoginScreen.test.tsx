import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LoginScreen } from './LoginScreen';

describe('LoginScreen', () => {
  it('shows success message and switches to login mode after registration with email confirmation pending', async () => {
    const onSignIn = vi.fn().mockResolvedValue({ error: null });
    const onSignUp = vi.fn().mockResolvedValue({
      error: null,
      successMessage: 'registration successful — check your email to confirm, then sign in',
    });

    render(<LoginScreen onSignIn={onSignIn} onSignUp={onSignUp} />);

    // Switch to signup mode
    fireEvent.click(screen.getByText('[register]'));
    expect(screen.getByText('create a new cache')).toBeInTheDocument();

    // Fill in form
    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('password'), { target: { value: 'password123' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      // Success message is visible
      expect(screen.getByText(/registration successful/i)).toBeInTheDocument();
      // Switched back to login mode
      expect(screen.getByText('sign in to your cache')).toBeInTheDocument();
    });
  });

  it('shows error when signup fails', async () => {
    const onSignIn = vi.fn();
    const onSignUp = vi.fn().mockResolvedValue({ error: 'Email already registered' });

    render(<LoginScreen onSignIn={onSignIn} onSignUp={onSignUp} />);
    fireEvent.click(screen.getByText('[register]'));
    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByText(/Email already registered/i)).toBeInTheDocument();
    });
  });
});

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

  it('announces errors to screen readers', async () => {
    const onSignIn = vi.fn().mockResolvedValue({ error: 'wrong email or password' });
    render(<LoginScreen onSignIn={onSignIn} onSignUp={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('password'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('wrong email or password');
  });

  it('shows the 8+ chars hint only in register mode and ticks it when met', () => {
    render(<LoginScreen onSignIn={vi.fn()} onSignUp={vi.fn()} />);
    expect(screen.queryByText(/8\+ chars/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('[register]'));
    const hint = screen.getByText('8+ chars');
    expect(screen.getByLabelText('password')).toHaveAttribute('aria-describedby', hint.id);
    fireEvent.change(screen.getByLabelText('password'), { target: { value: 'longenough' } });
    expect(screen.getByText('8+ chars ✓')).toBeInTheDocument();
  });

  it('warns that guest notes stay in the browser they were made in', () => {
    render(<LoginScreen onSignIn={vi.fn()} onSignUp={vi.fn()} onGuest={vi.fn()} />);
    expect(screen.getByText(/guest notes stay in the browser they were made in/)).toBeInTheDocument();
    expect(screen.getByText(/create an account before adding the app to the home screen/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('[register]'));
    expect(screen.getByText(/adding the app to the home screen/)).toBeInTheDocument();
  });

  it('hides the home-screen note when guest mode is unavailable or resetting', () => {
    const { rerender } = render(<LoginScreen onSignIn={vi.fn()} onSignUp={vi.fn()} />);
    expect(screen.queryByText(/home screen/)).not.toBeInTheDocument();

    rerender(<LoginScreen onSignIn={vi.fn()} onSignUp={vi.fn()} onGuest={vi.fn()} onResetPassword={vi.fn()} />);
    fireEvent.click(screen.getByText('[forgot password]'));
    expect(screen.queryByText(/home screen/)).not.toBeInTheDocument();
  });

  it('passes the guest-mode error through verbatim', async () => {
    const onGuest = vi.fn().mockResolvedValue({ error: 'guest mode unavailable — sign up instead' });
    render(<LoginScreen onSignIn={vi.fn()} onSignUp={vi.fn()} onGuest={onGuest} />);
    fireEvent.click(screen.getByRole('button', { name: /continue as guest/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('guest mode unavailable — sign up instead');
  });

  it('hides [forgot password] when reset is not wired', () => {
    render(<LoginScreen onSignIn={vi.fn()} onSignUp={vi.fn()} />);
    expect(screen.queryByText('[forgot password]')).not.toBeInTheDocument();
  });

  it('sends a reset link from the forgot-password form', async () => {
    const onResetPassword = vi.fn().mockResolvedValue({
      error: null,
      successMessage: 'if a@b.com has an account, a reset link is on its way — check your inbox',
    });
    render(<LoginScreen onSignIn={vi.fn()} onSignUp={vi.fn()} onGuest={vi.fn()} onResetPassword={onResetPassword} />);

    fireEvent.click(screen.getByText('[forgot password]'));
    expect(screen.getByText('~/cache $ auth --reset')).toBeInTheDocument();
    expect(screen.queryByLabelText('password')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue as guest/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'a@b.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(onResetPassword).toHaveBeenCalledWith('a@b.com');
    expect(await screen.findByRole('status')).toHaveTextContent(/reset link is on its way/);

    fireEvent.click(screen.getByText('[back to login]'));
    expect(screen.getByText('sign in to your cache')).toBeInTheDocument();
  });

  it('links the draft privacy policy and terms', () => {
    const { rerender } = render(<LoginScreen onSignIn={vi.fn()} onSignUp={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'privacy' })).toHaveAttribute('href', '/privacy.html');
    expect(screen.getByRole('link', { name: 'terms' })).toHaveAttribute('href', '/terms.html');
    expect(screen.getByText('draft')).toBeInTheDocument();

    rerender(<LoginScreen onSignIn={vi.fn()} onSignUp={vi.fn()} onResetPassword={vi.fn()} initialMode="reset" />);
    expect(screen.getByRole('link', { name: 'privacy' })).toBeInTheDocument();
  });

  it('opens in reset mode with an expired-link error from the redirect', () => {
    render(
      <LoginScreen
        onSignIn={vi.fn()}
        onSignUp={vi.fn()}
        onResetPassword={vi.fn()}
        initialMode="reset"
        initialError="that link has expired — request a new one"
      />
    );
    expect(screen.getByText('~/cache $ auth --reset')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('that link has expired');
  });
});

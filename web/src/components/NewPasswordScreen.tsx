import { useState } from 'react';
import { MIN_PASSWORD_LENGTH } from '@cache/core';
import './LoginScreen.css';

interface Props {
  email?: string | null;
  onSubmit: (password: string) => Promise<{ error: string | null }>;
  onCancel: () => void;
}

// Shown after the user lands from a password-reset email. Supabase has already
// signed them in with a short-lived recovery session; this sets the new password.
export function NewPasswordScreen({ email, onSubmit, onCancel }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const longEnough = password.length >= MIN_PASSWORD_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!longEnough) {
      setError(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirm) {
      setError("passwords don't match");
      return;
    }
    setSubmitting(true);
    const result = await onSubmit(password);
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    }
    // on success the app leaves recovery mode and this screen unmounts
  };

  return (
    <div className="login-screen">
      <div className="login-screen__container">
        <div className="login-screen__header">
          <p className="login-screen__prompt">~/cache $ passwd</p>
          <p className="login-screen__subtitle">
            set a new password{email ? ` for ${email}` : ''}
          </p>
        </div>

        <form className="login-screen__form" onSubmit={handleSubmit}>
          {/* Lets password managers pair the new password with the account. */}
          {email && (
            <input type="email" value={email} autoComplete="username" readOnly hidden />
          )}
          <div className="login-screen__field">
            <label className="login-screen__label" htmlFor="new-password">new password</label>
            <input
              id="new-password"
              className="login-screen__input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              aria-describedby="new-password-hint"
              required
              autoFocus
            />
            <p
              id="new-password-hint"
              className={`login-screen__hint${longEnough ? ' login-screen__hint--ok' : ''}`}
            >
              {MIN_PASSWORD_LENGTH}+ chars{longEnough ? ' ✓' : ''}
            </p>
          </div>

          <div className="login-screen__field">
            <label className="login-screen__label" htmlFor="confirm-password">confirm password</label>
            <input
              id="confirm-password"
              className="login-screen__input"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>

          <button type="submit" className="login-screen__submit" disabled={submitting}>
            <span className="login-screen__submit-prefix">$</span>
            {submitting ? 'saving...' : 'update password'}
          </button>

          {error && <p className="login-screen__error" role="alert">error: {error}</p>}
        </form>

        <div className="login-screen__toggle">
          changed your mind?{' '}
          <button className="login-screen__toggle-btn" onClick={onCancel} type="button">
            [cancel &amp; sign out]
          </button>
        </div>
      </div>
    </div>
  );
}

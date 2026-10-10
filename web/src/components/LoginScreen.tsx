import { useState } from 'react';
import { MIN_PASSWORD_LENGTH } from '@cache/core';
import { LEGAL_PAGES } from '../lib/legalRoutes';
import './LoginScreen.css';

type AuthResult = { error: string | null; successMessage?: string };
type Mode = 'login' | 'signup' | 'reset';

interface LoginScreenProps {
  onSignIn: (email: string, password: string) => Promise<{ error: string | null }>;
  onSignUp: (email: string, password: string) => Promise<AuthResult>;
  onGuest?: () => Promise<{ error: string | null }>;
  onResetPassword?: (email: string) => Promise<AuthResult>;
  initialMode?: Mode;
  /** Shown on mount, e.g. an expired reset link. */
  initialError?: string | null;
}

const COPY: Record<Mode, { command: string; subtitle: string; button: string }> = {
  login: { command: 'auth --login', subtitle: 'sign in to your cache', button: 'login' },
  signup: { command: 'auth --register', subtitle: 'create a new cache', button: 'register' },
  reset: { command: 'auth --reset', subtitle: "we'll email you a link to set a new password", button: 'send reset link' },
};

export function LoginScreen({ onSignIn, onSignUp, onGuest, onResetPassword, initialMode = 'login', initialError = null }: LoginScreenProps) {
  const [mode, setMode] = useState<Mode>(initialMode === 'reset' && !onResetPassword ? 'login' : initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (mode === 'signup' && password.length < MIN_PASSWORD_LENGTH) {
      setError(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setSubmitting(true);

    if (mode === 'login') {
      const result = await onSignIn(email, password);
      if (result.error) setError(result.error);
    } else if (mode === 'reset') {
      const result = await onResetPassword!(email);
      if (result.error) setError(result.error);
      else setSuccessMessage(result.successMessage ?? 'check your inbox for a reset link');
    } else {
      const result = await onSignUp(email, password);
      if (result.error) {
        setError(result.error);
      } else if (result.successMessage) {
        // Email confirmation required — switch to login mode with the message
        setSuccessMessage(result.successMessage);
        setMode('login');
        setPassword('');
      }
      // If no error and no successMessage, onAuthStateChange fires and App transitions automatically
    }

    setSubmitting(false);
  };

  const handleGuest = async () => {
    if (!onGuest) return;
    setError(null);
    setSuccessMessage(null);
    setSubmitting(true);
    const result = await onGuest();
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    }
    // on success, onAuthStateChange fires and App transitions automatically
  };

  const { command, subtitle, button } = COPY[mode];
  const longEnough = password.length >= MIN_PASSWORD_LENGTH;

  return (
    <div className="login-screen">
      <div className="login-screen__container">
        <div className="login-screen__header">
          <p className="login-screen__prompt">~/cache $ {command}</p>
          <p className="login-screen__subtitle">{subtitle}</p>
        </div>

        <form className="login-screen__form" onSubmit={handleSubmit}>
          <div className="login-screen__field">
            <label className="login-screen__label" htmlFor="email">email</label>
            <input
              id="email"
              className="login-screen__input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@example.com"
              autoComplete="email"
              required
              autoFocus
            />
          </div>

          {mode !== 'reset' && (
            <div className="login-screen__field">
              <label className="login-screen__label" htmlFor="password">password</label>
              <input
                id="password"
                className="login-screen__input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                aria-describedby={mode === 'signup' ? 'password-hint' : undefined}
                required
              />
              {mode === 'signup' && (
                <p
                  id="password-hint"
                  className={`login-screen__hint${longEnough ? ' login-screen__hint--ok' : ''}`}
                >
                  {MIN_PASSWORD_LENGTH}+ chars{longEnough ? ' ✓' : ''}
                </p>
              )}
              {mode === 'login' && onResetPassword && (
                <button
                  type="button"
                  className="login-screen__toggle-btn login-screen__forgot"
                  onClick={() => switchMode('reset')}
                >
                  [forgot password]
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            className="login-screen__submit"
            disabled={submitting}
          >
            <span className="login-screen__submit-prefix">$</span>
            {submitting ? 'connecting...' : button}
          </button>

          {error && <p className="login-screen__error" role="alert">error: {error}</p>}
          {successMessage && <p className="login-screen__success" role="status">{successMessage}</p>}
        </form>

        {onGuest && mode !== 'reset' && (
          <>
            <div className="login-screen__divider">— or —</div>
            <button
              type="button"
              className="login-screen__guest"
              onClick={handleGuest}
              disabled={submitting}
            >
              <span className="login-screen__submit-prefix">$</span>
              continue as guest
            </button>
            <p className="login-screen__guest-note">
              guest notes stay in the browser they were made in — create an account before adding the app to the home screen
            </p>
          </>
        )}

        <div className="login-screen__toggle">
          {mode === 'login' && (
            <>
              no account?{' '}
              <button className="login-screen__toggle-btn" onClick={() => switchMode('signup')} type="button">
                [register]
              </button>
            </>
          )}
          {mode === 'signup' && (
            <>
              have an account?{' '}
              <button className="login-screen__toggle-btn" onClick={() => switchMode('login')} type="button">
                [login]
              </button>
            </>
          )}
          {mode === 'reset' && (
            <>
              remembered it?{' '}
              <button className="login-screen__toggle-btn" onClick={() => switchMode('login')} type="button">
                [back to login]
              </button>
            </>
          )}
        </div>

        <p className="login-screen__legal">
          <a href={LEGAL_PAGES[0]}>privacy</a>
          <span aria-hidden="true"> · </span>
          <a href={LEGAL_PAGES[1]}>terms</a>
          <span className="login-screen__legal-draft">draft</span>
        </p>
      </div>
    </div>
  );
}

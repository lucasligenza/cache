import { useState } from 'react';
import './LoginScreen.css';

interface LoginScreenProps {
  onSignIn: (email: string, password: string) => Promise<{ error: string | null }>;
  onSignUp: (email: string, password: string) => Promise<{ error: string | null; successMessage?: string }>;
  onGuest?: () => Promise<{ error: string | null }>;
}

export function LoginScreen({ onSignIn, onSignUp, onGuest }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (mode === 'signup' && password.length < 8) {
      setError('password must be at least 8 characters');
      return;
    }

    setSubmitting(true);

    if (mode === 'login') {
      const result = await onSignIn(email, password);
      if (result.error) setError(result.error);
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
      setError(
        /disabled/i.test(result.error)
          ? 'guest mode is off — enable anonymous sign-ins in supabase'
          : result.error
      );
      setSubmitting(false);
    }
    // on success, onAuthStateChange fires and App transitions automatically
  };

  const toggleMode = () => {
    setMode(m => m === 'login' ? 'signup' : 'login');
    setError(null);
    setSuccessMessage(null);
  };

  const command = mode === 'login' ? 'auth --login' : 'auth --register';
  const buttonLabel = mode === 'login' ? 'login' : 'register';

  return (
    <div className="login-screen">
      <div className="login-screen__container">
        <div className="login-screen__header">
          <p className="login-screen__prompt">~/cache $ {command}</p>
          <p className="login-screen__subtitle">
            {mode === 'login' ? 'sign in to your cache' : 'create a new cache'}
          </p>
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
              required
            />
          </div>

          <button
            type="submit"
            className="login-screen__submit"
            disabled={submitting}
          >
            <span className="login-screen__submit-prefix">$</span>
            {submitting ? 'connecting...' : buttonLabel}
          </button>

          {error && <p className="login-screen__error">error: {error}</p>}
          {successMessage && <p className="login-screen__success">{successMessage}</p>}
        </form>

        {onGuest && (
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
          </>
        )}

        <div className="login-screen__toggle">
          {mode === 'login' ? (
            <>
              no account?{' '}
              <button className="login-screen__toggle-btn" onClick={toggleMode} type="button">
                [register]
              </button>
            </>
          ) : (
            <>
              have an account?{' '}
              <button className="login-screen__toggle-btn" onClick={toggleMode} type="button">
                [login]
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

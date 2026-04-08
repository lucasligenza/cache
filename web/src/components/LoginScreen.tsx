import { useState } from 'react';
import './LoginScreen.css';

interface LoginScreenProps {
  onSignIn: (email: string, password: string) => Promise<{ error: string | null }>;
  onSignUp: (email: string, password: string) => Promise<{ error: string | null }>;
}

export function LoginScreen({ onSignIn, onSignUp }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'signup' && password.length < 8) {
      setError('password must be at least 8 characters');
      return;
    }

    setSubmitting(true);

    const handler = mode === 'login' ? onSignIn : onSignUp;
    const result = await handler(email, password);

    if (result.error) {
      setError(result.error);
    }

    setSubmitting(false);
  };

  const toggleMode = () => {
    setMode(m => m === 'login' ? 'signup' : 'login');
    setError(null);
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
        </form>

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

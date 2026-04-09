# CacheNotes Mobile UX & Registration Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the silent registration screen and make the web PWA feel native on mobile — bottom navigation, touch-friendly capture bar, and safe-area insets.

**Architecture:** Six independent tasks (auth hook → login UI → two new nav components → capture bar → wiring). Each task has its own tests and commit. The `StatusBar` component is replaced entirely by `AppHeader` + `BottomNav`. All changes are confined to `web/`.

**Tech Stack:** React 18, TypeScript, Vite, Vitest + @testing-library/react, Supabase JS client, CSS custom properties, PWA (vite-plugin-pwa).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `web/src/hooks/useAuth.ts` | Modify | `signUp` attempts auto-login after signup |
| `web/src/hooks/useAuth.test.ts` | Create | Tests for new signUp behaviour |
| `web/src/components/LoginScreen.tsx` | Modify | Show `successMessage`, switch to login mode |
| `web/src/components/LoginScreen.css` | Modify | Success text style, 16px input font, safe-area padding |
| `web/src/components/LoginScreen.test.tsx` | Create | Test success message display |
| `web/src/components/StatusBar.tsx` | Delete | Replaced by AppHeader + BottomNav |
| `web/src/components/StatusBar.css` | Delete | Replaced by AppHeader + BottomNav |
| `web/src/components/AppHeader.tsx` | Create | Slim brand-only top bar |
| `web/src/components/AppHeader.css` | Create | Header styles + safe-area top padding |
| `web/src/components/AppHeader.test.tsx` | Create | Render test |
| `web/src/components/BottomNav.tsx` | Create | Four-tab bottom navigation with icons |
| `web/src/components/BottomNav.css` | Create | Bottom nav styles + safe-area bottom padding |
| `web/src/components/BottomNav.test.tsx` | Create | Tab switching, active state, badge |
| `web/src/components/CaptureBar.tsx` | Modify | Add send button + mobile cat button |
| `web/src/components/CaptureBar.css` | Modify | 16px textarea, show send button on touch |
| `web/src/components/CaptureBar.test.tsx` | Create | Send button renders and calls onCommit |
| `web/src/App.tsx` | Modify | Swap StatusBar → AppHeader + BottomNav |
| `web/index.html` | Modify | Add viewport-fit=cover, remove user-scalable=no |

---

## Task 1: Fix useAuth.signUp — auto-login after registration

**Files:**
- Modify: `web/src/hooks/useAuth.ts`
- Create: `web/src/hooks/useAuth.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `web/src/hooks/useAuth.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth } from './useAuth';

const mockSignUp = vi.fn();
const mockSignIn = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signUp: mockSignUp,
      signInWithPassword: mockSignIn,
      signOut: vi.fn(),
    },
  },
}));

describe('useAuth.signUp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('attempts signIn immediately after successful signUp', async () => {
    mockSignUp.mockResolvedValue({ error: null });
    mockSignIn.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth());
    let response: Awaited<ReturnType<typeof result.current.signUp>>;
    await act(async () => {
      response = await result.current.signUp('a@b.com', 'password123');
    });

    expect(mockSignIn).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123' });
    expect(response!.error).toBeNull();
    expect(response!.successMessage).toBeUndefined();
  });

  it('returns successMessage when auto-login fails (email confirmation required)', async () => {
    mockSignUp.mockResolvedValue({ error: null });
    mockSignIn.mockResolvedValue({ error: { message: 'Email not confirmed' } });

    const { result } = renderHook(() => useAuth());
    let response: Awaited<ReturnType<typeof result.current.signUp>>;
    await act(async () => {
      response = await result.current.signUp('a@b.com', 'password123');
    });

    expect(response!.error).toBeNull();
    expect(response!.successMessage).toBe(
      'registration successful — check your email to confirm, then sign in'
    );
  });

  it('returns error and does not attempt signIn when signUp fails', async () => {
    mockSignUp.mockResolvedValue({ error: { message: 'Email already registered' } });

    const { result } = renderHook(() => useAuth());
    let response: Awaited<ReturnType<typeof result.current.signUp>>;
    await act(async () => {
      response = await result.current.signUp('a@b.com', 'password123');
    });

    expect(response!.error).toBe('Email already registered');
    expect(mockSignIn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd web && npm test -- --reporter=verbose useAuth
```

Expected: 3 tests FAIL — `signUp` currently doesn't call `signInWithPassword`.

- [ ] **Step 3: Update `useAuth.ts`**

Replace the `UseAuthReturn` interface and `signUp` implementation in `web/src/hooks/useAuth.ts`:

```ts
import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; successMessage?: string }>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => { subscription.unsubscribe(); };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signUp = async (email: string, password: string): Promise<{ error: string | null; successMessage?: string }> => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };

    // Attempt immediate login. If Supabase requires email confirmation,
    // signInWithPassword will fail — we surface a message instead.
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) {
      return {
        error: null,
        successMessage: 'registration successful — check your email to confirm, then sign in',
      };
    }
    return { error: null };
  };

  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut();
  };

  return { user, loading, signIn, signUp, signOut };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd web && npm test -- --reporter=verbose useAuth
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd web && git add src/hooks/useAuth.ts src/hooks/useAuth.test.ts
git commit -m "fix: auto-login after signup, return successMessage when email confirmation required"
```

---

## Task 2: LoginScreen — handle successMessage after registration

**Files:**
- Modify: `web/src/components/LoginScreen.tsx`
- Modify: `web/src/components/LoginScreen.css`
- Create: `web/src/components/LoginScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `web/src/components/LoginScreen.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd web && npm test -- --reporter=verbose LoginScreen
```

Expected: FAIL — `LoginScreen` doesn't accept `successMessage` yet.

- [ ] **Step 3: Update `LoginScreen.tsx`**

Replace the full file at `web/src/components/LoginScreen.tsx`:

```tsx
import { useState } from 'react';
import './LoginScreen.css';

interface LoginScreenProps {
  onSignIn: (email: string, password: string) => Promise<{ error: string | null }>;
  onSignUp: (email: string, password: string) => Promise<{ error: string | null; successMessage?: string }>;
}

export function LoginScreen({ onSignIn, onSignUp }: LoginScreenProps) {
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

        <div className="login-screen__toggle">
          {mode === 'login' ? (
            <>no account?{' '}<button className="login-screen__toggle-btn" onClick={toggleMode} type="button">[register]</button></>
          ) : (
            <>have an account?{' '}<button className="login-screen__toggle-btn" onClick={toggleMode} type="button">[login]</button></>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update `LoginScreen.css`** — add success style, bump font sizes, add safe-area padding

Append to `web/src/components/LoginScreen.css` and update existing rules:

**Change** `.login-screen__input` font-size from `14px` to `16px`:
```css
.login-screen__input {
  background: #252525;
  border: 1px solid #333333;
  color: #E0E0E0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 16px;
  padding: 10px 12px;
  outline: none;
  transition: border-color 0.15s ease;
  width: 100%;
  box-sizing: border-box;
}
```

**Change** `.login-screen__container` to add safe-area padding:
```css
.login-screen__container {
  width: 100%;
  max-width: 400px;
  padding: 0 24px;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
```

**Add** at the bottom of the file:
```css
.login-screen__success {
  font-size: 12px;
  color: var(--accent, #39FF14);
  margin: 0;
  padding: 8px 0 0 0;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd web && npm test -- --reporter=verbose LoginScreen
```

Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd web && git add src/components/LoginScreen.tsx src/components/LoginScreen.css src/components/LoginScreen.test.tsx
git commit -m "fix: show success message after registration, switch to login mode"
```

---

## Task 3: Create AppHeader component

**Files:**
- Create: `web/src/components/AppHeader.tsx`
- Create: `web/src/components/AppHeader.css`
- Create: `web/src/components/AppHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `web/src/components/AppHeader.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AppHeader } from './AppHeader';

describe('AppHeader', () => {
  it('renders the brand text', () => {
    render(<AppHeader />);
    expect(screen.getByText('~/cache')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npm test -- --reporter=verbose AppHeader
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `AppHeader.tsx`**

```tsx
import './AppHeader.css';

export function AppHeader() {
  return (
    <header className="app-header">
      <span className="app-header__brand">~/cache</span>
    </header>
  );
}
```

- [ ] **Step 4: Create `AppHeader.css`**

```css
.app-header {
  display: flex;
  align-items: center;
  padding: 0 16px;
  padding-top: env(safe-area-inset-top);
  height: calc(36px + env(safe-area-inset-top));
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.app-header__brand {
  font-family: var(--font);
  font-size: 13px;
  color: var(--accent);
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd web && npm test -- --reporter=verbose AppHeader
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd web && git add src/components/AppHeader.tsx src/components/AppHeader.css src/components/AppHeader.test.tsx
git commit -m "feat: add AppHeader component (slim brand-only top bar)"
```

---

## Task 4: Create BottomNav component

**Files:**
- Create: `web/src/components/BottomNav.tsx`
- Create: `web/src/components/BottomNav.css`
- Create: `web/src/components/BottomNav.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `web/src/components/BottomNav.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BottomNav } from './BottomNav';

describe('BottomNav', () => {
  it('renders all four tab labels', () => {
    render(<BottomNav activeView="buffer" unsortedCount={0} onTabClick={vi.fn()} />);
    expect(screen.getByText('buffer')).toBeInTheDocument();
    expect(screen.getByText('board')).toBeInTheDocument();
    expect(screen.getByText('search')).toBeInTheDocument();
    expect(screen.getByText('settings')).toBeInTheDocument();
  });

  it('applies active class to the current tab only', () => {
    render(<BottomNav activeView="board" unsortedCount={0} onTabClick={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    const boardBtn = buttons.find(b => b.textContent?.includes('board'));
    const bufferBtn = buttons.find(b => b.textContent?.includes('buffer'));
    expect(boardBtn).toHaveClass('bottom-nav__tab--active');
    expect(bufferBtn).not.toHaveClass('bottom-nav__tab--active');
  });

  it('calls onTabClick with view name when a tab is clicked', () => {
    const onTabClick = vi.fn();
    render(<BottomNav activeView="buffer" unsortedCount={0} onTabClick={onTabClick} />);
    const buttons = screen.getAllByRole('button');
    const searchBtn = buttons.find(b => b.textContent?.includes('search'))!;
    fireEvent.click(searchBtn);
    expect(onTabClick).toHaveBeenCalledWith('search');
  });

  it('shows unsorted count badge on buffer tab when count > 0', () => {
    render(<BottomNav activeView="buffer" unsortedCount={5} onTabClick={vi.fn()} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('does not render badge when unsortedCount is 0', () => {
    render(<BottomNav activeView="buffer" unsortedCount={0} onTabClick={vi.fn()} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd web && npm test -- --reporter=verbose BottomNav
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `BottomNav.tsx`**

```tsx
import type { ViewName } from '../types';
import './BottomNav.css';

interface Props {
  activeView: ViewName;
  unsortedCount: number;
  onTabClick: (view: ViewName) => void;
}

const TABS: { view: ViewName; icon: string; label: string }[] = [
  { view: 'buffer',   icon: '⟩_', label: 'buffer'   },
  { view: 'board',    icon: '⊞',  label: 'board'    },
  { view: 'search',   icon: '⌕',  label: 'search'   },
  { view: 'settings', icon: '⚙',  label: 'settings' },
];

export function BottomNav({ activeView, unsortedCount, onTabClick }: Props) {
  return (
    <nav className="bottom-nav">
      {TABS.map(({ view, icon, label }) => (
        <button
          key={view}
          className={`bottom-nav__tab${activeView === view ? ' bottom-nav__tab--active' : ''}`}
          onClick={() => onTabClick(view)}
        >
          <span className="bottom-nav__icon">
            {icon}
            {view === 'buffer' && unsortedCount > 0 && (
              <span className="bottom-nav__badge">{unsortedCount}</span>
            )}
          </span>
          <span className="bottom-nav__label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Create `BottomNav.css`**

```css
.bottom-nav {
  display: flex;
  justify-content: space-around;
  align-items: stretch;
  background: var(--bg);
  border-top: 1px solid var(--border);
  padding-bottom: env(safe-area-inset-bottom);
  flex-shrink: 0;
}

.bottom-nav__tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-height: 56px;
  padding: 8px 4px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  font-family: var(--font);
  transition: color 0.1s ease;
  position: relative;
}

.bottom-nav__tab:active {
  background: var(--surface-hover);
}

.bottom-nav__tab--active {
  color: var(--accent);
}

.bottom-nav__tab--active .bottom-nav__label::after {
  content: '';
  display: block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent);
  margin: 2px auto 0;
}

.bottom-nav__icon {
  font-size: 16px;
  line-height: 1;
  position: relative;
  display: inline-block;
}

.bottom-nav__label {
  font-size: 10px;
  text-align: center;
}

.bottom-nav__badge {
  position: absolute;
  top: -4px;
  right: -8px;
  background: var(--accent);
  color: var(--bg);
  font-size: 9px;
  font-weight: bold;
  min-width: 14px;
  height: 14px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  line-height: 1;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd web && npm test -- --reporter=verbose BottomNav
```

Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd web && git add src/components/BottomNav.tsx src/components/BottomNav.css src/components/BottomNav.test.tsx
git commit -m "feat: add BottomNav component with icons and badge"
```

---

## Task 5: CaptureBar — mobile send button and font fix

**Files:**
- Modify: `web/src/components/CaptureBar.tsx`
- Modify: `web/src/components/CaptureBar.css`
- Create: `web/src/components/CaptureBar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `web/src/components/CaptureBar.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CaptureBar } from './CaptureBar';

describe('CaptureBar', () => {
  it('renders the send button', () => {
    render(<CaptureBar categories={[]} onCommit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'send' })).toBeInTheDocument();
  });

  it('send button calls onCommit with the typed text', () => {
    const onCommit = vi.fn();
    render(<CaptureBar categories={[]} onCommit={onCommit} />);

    const textarea = screen.getByPlaceholderText('type a note...');
    fireEvent.change(textarea, { target: { value: 'my note' } });

    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    expect(onCommit).toHaveBeenCalledWith('my note', undefined);
  });

  it('send button does not call onCommit when input is empty', () => {
    const onCommit = vi.fn();
    render(<CaptureBar categories={[]} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('clears the textarea after send', () => {
    render(<CaptureBar categories={[]} onCommit={vi.fn()} />);
    const textarea = screen.getByPlaceholderText('type a note...') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    expect(textarea.value).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd web && npm test -- --reporter=verbose CaptureBar
```

Expected: FAIL — send button does not exist yet.

- [ ] **Step 3: Update `CaptureBar.tsx`** — add send button with `aria-label="send"`

Replace the full file at `web/src/components/CaptureBar.tsx`:

```tsx
import { useRef, useState, useEffect, useCallback } from 'react';
import { Category } from '../types';
import './CaptureBar.css';

interface Props {
  categories: Category[];
  onCommit: (text: string, categoryId?: string) => void;
}

export function CaptureBar({ categories, onCommit }: Props) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedCat = selectedCatId ? categories.find(c => c.id === selectedCatId) : null;
  const catLabel = selectedCat ? `→ /${selectedCat.name.toLowerCase()}` : '→ buffer';

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleCommit = useCallback(() => {
    if (!text.trim()) return;
    onCommit(text.trim(), selectedCatId ?? undefined);
    setText('');
    setSelectedCatId(null);
    setPickerOpen(false);
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.focus(); }
  }, [text, selectedCatId, onCommit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommit();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      setPickerOpen(o => !o);
    }
    if (e.key === 'Escape') {
      setPickerOpen(false);
    }
  };

  const selectCategory = (catId: string | null) => {
    setSelectedCatId(catId);
    setPickerOpen(false);
    textareaRef.current?.focus();
  };

  return (
    <div className={`capture-bar${focused ? ' capture-bar--focused' : ''}`}>
      <div className="capture-bar__prompt-row">
        <span className="capture-bar__prompt">~/cache $</span>
        <textarea
          ref={textareaRef}
          className="capture-bar__input"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="type a note..."
          rows={1}
        />
        <button
          className="capture-bar__send-btn"
          onClick={handleCommit}
          aria-label="send"
          type="button"
        >
          ↵
        </button>
      </div>

      <div className="capture-bar__footer">
        <div style={{ position: 'relative' }}>
          <button
            className="capture-bar__cat-btn"
            onClick={() => setPickerOpen(o => !o)}
            style={selectedCat ? { color: selectedCat.color, borderColor: selectedCat.color + '55' } : undefined}
          >
            {catLabel}
          </button>

          {pickerOpen && (
            <div className="capture-bar__picker">
              <button
                className="capture-bar__picker-item"
                style={{ color: '#666' }}
                onClick={() => selectCategory(null)}
              >
                → buffer
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className="capture-bar__picker-item"
                  style={{ color: cat.color }}
                  onClick={() => selectCategory(cat.id)}
                >
                  <span className="capture-bar__picker-swatch" style={{ background: cat.color }} />
                  /{cat.name.toLowerCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="capture-bar__hint">↵ commit · tab for category</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update `CaptureBar.css`** — send button visibility + textarea font size

Open `web/src/components/CaptureBar.css`. Make these two changes:

**1. Add send button styles** (append at end of file):
```css
.capture-bar__send-btn {
  display: none;
  background: var(--surface);
  border: 1px solid var(--accent);
  color: var(--accent);
  font-family: var(--font);
  font-size: 14px;
  padding: 4px 10px;
  min-height: 44px;
  min-width: 44px;
  cursor: pointer;
  flex-shrink: 0;
  align-self: flex-end;
  margin-left: 6px;
}

@media (pointer: coarse) {
  .capture-bar__send-btn {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .capture-bar__hint {
    display: none;
  }
}
```

**2. Update textarea font-size** — in the `.capture-bar__input` rule (line 36 of `CaptureBar.css`), change `font-size: 14px` to `font-size: 16px`:
```css
.capture-bar__input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-family: var(--font);
  font-size: 16px;
  line-height: 1.5;
  caret-color: var(--accent);
  resize: none;
  min-height: 21px;
  max-height: 140px;
  overflow-y: auto;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd web && npm test -- --reporter=verbose CaptureBar
```

Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd web && git add src/components/CaptureBar.tsx src/components/CaptureBar.css src/components/CaptureBar.test.tsx
git commit -m "feat: add mobile send button to CaptureBar, fix input font size for iOS"
```

---

## Task 6: Wire App.tsx, delete StatusBar, fix viewport meta

**Files:**
- Modify: `web/src/App.tsx`
- Delete: `web/src/components/StatusBar.tsx`
- Delete: `web/src/components/StatusBar.css`
- Modify: `web/index.html`

No new tests needed — all new components are already tested. This task is pure wiring.

- [ ] **Step 1: Update `App.tsx`** — swap StatusBar for AppHeader + BottomNav

Replace the full file at `web/src/App.tsx`:

```tsx
import { useState, useCallback, useEffect } from 'react';
import type { ViewName } from './types';
import { useAuth } from './hooks/useAuth';
import { useNotes } from './hooks/useNotes';
import { useCategories } from './hooks/useCategories';
import { useToast } from './components/Toast';
import { subscribeToPush, unsubscribeFromPush, getPushStatus } from './lib/push';
import { BootSequence } from './components/BootSequence';
import { DataLoadingScreen } from './components/DataLoadingScreen';
import { LoginScreen } from './components/LoginScreen';
import { AppHeader } from './components/AppHeader';
import { BottomNav } from './components/BottomNav';
import { CaptureBar } from './components/CaptureBar';
import { BufferView } from './views/BufferView';
import { BoardView } from './views/BoardView';
import { SearchView } from './views/SearchView';
import { SettingsView } from './views/SettingsView';
import './App.css';

export default function App() {
  const { showToast } = useToast();
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth();
  const [booted, setBooted] = useState(false);
  const [activeView, setActiveView] = useState<ViewName>('buffer');
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('cn_theme') as 'dark' | 'light') || 'dark'
  );
  const [accent, setAccent] = useState<string>(() =>
    localStorage.getItem('cn_accent') || 'green'
  );
  const [pushStatus, setPushStatus] = useState<'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'>('unsubscribed');

  const onNotesError = useCallback((msg: string) => showToast('error', msg), [showToast]);
  const onCatsError = useCallback((msg: string) => showToast('error', msg), [showToast]);

  const {
    notes,
    unsortedNotes,
    loading: notesLoading,
    createNote,
    updateNote,
    deleteNote,
    getNotesByCategory,
  } = useNotes(booted, onNotesError);

  const {
    categories,
    loading: catsLoading,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useCategories(booted, onCatsError);

  const handleCommit = useCallback(
    (text: string, categoryId?: string) => {
      createNote(text, categoryId).catch(() => showToast('error', 'failed to create note'));
    },
    [createNote, showToast]
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cn_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (accent === 'green') {
      document.documentElement.removeAttribute('data-accent');
    } else {
      document.documentElement.setAttribute('data-accent', accent);
    }
    localStorage.setItem('cn_accent', accent);
  }, [accent]);

  useEffect(() => {
    if (activeView === 'settings') {
      getPushStatus().then(setPushStatus);
    }
  }, [activeView]);

  const handleEnableNotifications = async () => {
    const { error } = await subscribeToPush();
    if (error) showToast('error', error);
    else { showToast('ok', 'notifications enabled'); setPushStatus('subscribed'); }
  };

  const handleDisableNotifications = async () => {
    const { error } = await unsubscribeFromPush();
    if (error) showToast('error', error);
    else { showToast('ok', 'notifications disabled'); setPushStatus('unsubscribed'); }
  };

  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#1a1a1a',
        color: '#39FF14',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '14px',
      }}>
        loading...
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onSignIn={signIn} onSignUp={signUp} />;
  }

  if (!booted) {
    return <BootSequence onDone={() => setBooted(true)} />;
  }

  if (notesLoading || catsLoading) {
    return <DataLoadingScreen />;
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="app-shell__content">
        {activeView === 'buffer' && (
          <BufferView
            notes={unsortedNotes}
            categories={categories}
            onAssign={(noteId, categoryId) =>
              updateNote(noteId, { category_id: categoryId }).catch(() =>
                showToast('error', 'failed to assign note')
              )
            }
            onDelete={(id) =>
              deleteNote(id).catch(() => showToast('error', 'failed to delete note'))
            }
            onUpdate={(id, updates) =>
              updateNote(id, updates).catch(() => showToast('error', 'failed to update note'))
            }
          />
        )}
        {activeView === 'board' && (
          <BoardView
            categories={categories}
            getNotesByCategory={getNotesByCategory}
            onUpdateNote={(id, updates) =>
              updateNote(id, updates).catch(() => showToast('error', 'failed to update note'))
            }
            onDeleteNote={(id) =>
              deleteNote(id).catch(() => showToast('error', 'failed to delete note'))
            }
            onCreateCategory={(name) =>
              createCategory(name).catch(() => showToast('error', 'failed to create directory'))
            }
            onRenameCategory={(id, name) =>
              updateCategory(id, { name }).catch(() => showToast('error', 'failed to rename directory'))
            }
            onDeleteCategory={(id) =>
              deleteCategory(id).catch(() => showToast('error', 'failed to delete directory'))
            }
          />
        )}
        {activeView === 'search' && (
          <SearchView
            notes={notes}
            categories={categories}
            onNavigate={setActiveView}
          />
        )}
        {activeView === 'settings' && (
          <SettingsView
            userEmail={user.email ?? ''}
            theme={theme}
            accent={accent}
            onThemeChange={setTheme}
            onAccentChange={setAccent}
            onSignOut={signOut}
            pushStatus={pushStatus}
            onEnableNotifications={handleEnableNotifications}
            onDisableNotifications={handleDisableNotifications}
          />
        )}
      </div>
      {activeView !== 'settings' && (
        <CaptureBar categories={categories} onCommit={handleCommit} />
      )}
      <BottomNav
        activeView={activeView}
        unsortedCount={unsortedNotes.length}
        onTabClick={setActiveView}
      />
    </div>
  );
}
```

- [ ] **Step 2: Delete StatusBar files**

```bash
cd web && rm src/components/StatusBar.tsx src/components/StatusBar.css
```

- [ ] **Step 3: Update `index.html`** — add `viewport-fit=cover`, remove `user-scalable=no`

Replace the viewport meta line in `web/index.html`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

(Remove `maximum-scale=1.0, user-scalable=no` — no longer needed since inputs are now 16px.)

- [ ] **Step 4: Run the full test suite**

```bash
cd web && npm test
```

Expected: All tests PASS. No references to `StatusBar` remain.

- [ ] **Step 5: Run TypeScript check**

```bash
cd web && npm run build
```

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
cd web && git add src/App.tsx index.html && git rm src/components/StatusBar.tsx src/components/StatusBar.css
git commit -m "feat: replace StatusBar with AppHeader + BottomNav, add viewport-fit=cover"
```

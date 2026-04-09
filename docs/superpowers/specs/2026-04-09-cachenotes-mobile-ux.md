# CacheNotes — Mobile UX & Registration Fix

**Date:** 2026-04-09
**Scope:** `web/` app only

---

## Problems Being Solved

1. **Registration screen is silent after submit.** After `signUp` succeeds, if Supabase requires email confirmation the session stays null and the screen doesn't change — no feedback, no transition.
2. **The PWA feels like a website on mobile.** Top-bar navigation is hard to reach with a thumb, the capture bar has no visible send button, inputs are too small (triggering iOS auto-zoom), and there are no safe-area insets for the iPhone home indicator.

---

## 1. Registration Fix

### Behaviour

After a successful `signUp` call:

1. Immediately attempt `signIn` with the same email + password.
2. **If `signIn` succeeds** — `onAuthStateChange` fires, `user` becomes non-null, `App.tsx` transitions to the boot sequence automatically. No extra UI needed.
3. **If `signIn` fails** (Supabase email confirmation is enabled) — switch the form to `'login'` mode and display the message: `"registration successful — check your email to confirm, then sign in"`. The user then signs in normally once they've clicked the link.

### Changes

| File | Change |
|---|---|
| `web/src/hooks/useAuth.ts` | `signUp` calls `signInWithPassword` immediately after a successful `signUp`. Returns `{ error: null }` if auto-login worked; returns a `successMessage` field alongside `error: null` if login failed (indicating email confirmation is pending). |
| `web/src/components/LoginScreen.tsx` | After `onSignUp` returns with no error, check for a `successMessage`. If present, switch to `'login'` mode and display the message in green. |
| `web/src/components/LoginScreen.css` | Add `.login-screen__success` style: `font-size: 12px; color: var(--accent); padding: 8px 0 0 0;` |

### Interface change to `onSignUp`

```ts
onSignUp: (email: string, password: string) => Promise<{ error: string | null; successMessage?: string }>
```

`useAuth.signUp` returns `{ error: null, successMessage: 'registration successful — check your email to confirm, then sign in' }` when signup worked but auto-login didn't.

---

## 2. Mobile / PWA UX

### 2a. Layout restructure — bottom navigation

The current single `StatusBar` handles both branding and tab navigation. After this change, the shell has three zones:

```
┌──────────────────────────────┐
│  AppHeader  (~36px)          │  brand "~/cache" only
├──────────────────────────────┤
│                              │
│  ContentArea  (flex: 1)      │  scrollable, unchanged
│                              │
├──────────────────────────────┤
│  CaptureBar  (auto-height)   │  only on non-settings views
├──────────────────────────────┤
│  BottomNav  (~56px + inset)  │  NEW — tab buttons
└──────────────────────────────┘
```

**`StatusBar` is replaced by two components:**

- **`AppHeader`** (`components/AppHeader.tsx` + `.css`) — slim bar showing `~/cache`. No tabs. No settings button (settings moves into `BottomNav`).
- **`BottomNav`** (`components/BottomNav.tsx` + `.css`) — fixed bottom bar with four tabs.

`App.tsx` renders `<AppHeader />` at the top, `<BottomNav>` at the bottom (inside the shell), and keeps `<CaptureBar>` between content and nav.

### 2b. BottomNav design

Four tabs, evenly spaced, centred vertically. Active tab uses `var(--accent)` color + a 2px accent underline dot. Inactive tabs use `var(--text-muted)`.

| Tab | Icon | Label |
|---|---|---|
| buffer | `⟩_` | buffer |
| board | `⊞` | board |
| search | `⌕` | search |
| settings | `⚙` | settings |

The buffer badge (unsorted count) appears as a small superscript next to the `⟩_` icon when count > 0.

```css
.bottom-nav {
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: var(--bg);
  border-top: 1px solid var(--border);
  padding-bottom: env(safe-area-inset-bottom);
  min-height: 56px;
}
```

Each tab button: `min-height: 44px; min-width: 44px` to meet touch target guidelines.

### 2c. CaptureBar mobile improvements

**Problem:** "↵ commit · tab for category" hint is meaningless on a touch keyboard. No visible send button.

**Changes to `CaptureBar.tsx`:**

- Add a visible `[↵]` send button to the right of the textarea. Calls `handleCommit()` on tap. Hidden on desktop via media query (`@media (pointer: fine)`).
- Replace the footer hint text with a `[cat]` button that opens the category picker on tap. The Tab-key shortcut continues to work on desktop.
- Footer hint becomes: `↵ commit` on desktop, hidden on mobile (the buttons are self-explanatory).

**Changes to `CaptureBar.css`:**

```css
.capture-bar__send-btn {
  display: none; /* shown only on touch devices */
}

@media (pointer: coarse) {
  .capture-bar__send-btn { display: flex; }
  .capture-bar__hint { display: none; }
}
```

### 2d. Input font sizes — prevent iOS auto-zoom

iOS zooms the viewport when an `<input>` or `<textarea>` receives focus if `font-size < 16px`. Fix: set `font-size: 16px` on all interactive text inputs.

| File | Element | Current | New |
|---|---|---|---|
| `LoginScreen.css` | `.login-screen__input` | `14px` | `16px` |
| `CaptureBar.css` | `.capture-bar__input` | inherited 13px | `16px` |

### 2e. Safe-area insets

Already applied to `BottomNav` via `padding-bottom: env(safe-area-inset-bottom)` (see 2b). The `AppHeader` gets `padding-top: env(safe-area-inset-top)` to clear the iPhone status bar notch.

The `LoginScreen` also needs `padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom)` on its container.

### 2f. `StatusBar` removal

`StatusBar.tsx`, `StatusBar.css`, and all references in `App.tsx` are deleted. Replaced by `AppHeader` + `BottomNav`.

---

## Files Changed Summary

| File | Action |
|---|---|
| `web/src/hooks/useAuth.ts` | Modify `signUp` to attempt auto-login |
| `web/src/components/LoginScreen.tsx` | Handle `successMessage`, show in green, switch to login mode |
| `web/src/components/LoginScreen.css` | Add `.login-screen__success`; bump input font to 16px; add safe-area padding |
| `web/src/components/StatusBar.tsx` | Delete |
| `web/src/components/StatusBar.css` | Delete |
| `web/src/components/AppHeader.tsx` | Create — brand-only slim header |
| `web/src/components/AppHeader.css` | Create |
| `web/src/components/BottomNav.tsx` | Create — four-tab bottom nav with icons |
| `web/src/components/BottomNav.css` | Create |
| `web/src/components/CaptureBar.tsx` | Add send button + mobile cat button |
| `web/src/components/CaptureBar.css` | Show send button on `pointer: coarse`; bump textarea font to 16px |
| `web/src/App.tsx` | Swap StatusBar → AppHeader + BottomNav; update `onSignUp` type |

---

## Out of Scope

- Dark/light mode changes
- Any backend changes
- Android-specific splash screen or icon generation
- Swipe gestures between tabs

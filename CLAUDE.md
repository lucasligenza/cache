# CacheNotes — Technical Reference

Terminal-aesthetic note organizer. Two sibling apps sharing one Supabase backend.

```
CacheNotes/
├── mobile/          ← React Native + Expo (iOS-first)
├── web/             ← React + Vite (terminal GUI)
└── CLAUDE.md        ← this file
```

---

## Shared Backend (Supabase)

One Supabase project used by both apps. Same schema, same credentials.

### Tables

| Table | Key columns |
|---|---|
| `notes` | `id`, `text`, `category_id`, `color`, `remind_at`, `pending_review` (manual "review later" flag), `pinned`, `archived_at`, `reviewed_at`, `created_at`, `updated_at` |
| `categories` | `id`, `name`, `color`, `created_at` |

Notes with `archived_at IS NULL` are active. Notes with `category_id IS NULL` are unsorted (buffer).

---

## Web App (`web/`)

### Stack

| Concern | Choice |
|---|---|
| Framework | React 18 + Vite 5 + TypeScript 5 |
| Styling | Plain CSS, CSS custom properties |
| Font | JetBrains Mono (Google Fonts) |
| Backend | Supabase JS client |
| AI sort | Claude Haiku (`claude-haiku-4-5-20251001`) via Anthropic API (direct from browser) |
| State | React hooks — no global state library |
| Routing | None — `activeView` state in `App.tsx` (`'buffer' | 'board' | 'search' | 'review' | 'settings' | 'archive'`) |
| Testing | Vitest + @testing-library/react |
| Deployment | Vercel — `web/vercel.json` rewrites all routes to `index.html` |

### Commands

```bash
cd web
cp .env.example .env       # then fill in credentials
npm install
npm run dev                # dev server at http://localhost:5173
npm run build              # TypeScript check + production build
npm test                   # Vitest unit tests
```

### Environment Variables (`web/.env`)

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_VAPID_PUBLIC_KEY=...            # web-push (reminders)
VITE_ANTHROPIC_API_KEY=sk-ant-...   # reserved for AI sort — see note below (feature deferred, not wired)
```

> **AI sort is not implemented in web.** The env var above and the `pending_review` column are provisioned for a future Claude Haiku auto-categorize feature, but no Anthropic call exists in `web/src`. Sorting is manual (category chips / CaptureBar picker / `/dir` slash-routing).

### Layout

Three fixed zones filling the full viewport. No page-level scroll.

```
┌────────────────────────────────────────┐
│  AppHeader  (brand + live status line) │
├────────────────────────────────────────┤
│                                        │
│  ContentArea  (flex: 1, scrollable)    │
│                                        │
├────────────────────────────────────────┤
│  CaptureBar  (auto-height)             │
├────────────────────────────────────────┤
│  BottomNav  (4 thumb tabs + badge)     │
└────────────────────────────────────────┘
```

### Component Tree

```
App
├── ErrorBoundary          ← class component, wraps entire app in main.tsx
├── ToastProvider          ← context provider, wraps App in main.tsx
├── BootSequence           ← typewriter boot; persisted per session (sessionStorage cn_booted)
├── DataLoadingScreen      ← fallback while Supabase data loads (rare — fetch runs during boot)
└── Shell (app-shell div)
    ├── AppHeader          ← brand + live status (n notes · unsorted · N to review) + ⚙ settings gear
    ├── ContentArea
    │   ├── BufferView     ← unsorted notes inbox
    │   ├── BoardView      ← category grid + drill-down + config panel (color picker)
    │   ├── SearchView     ← live full-text search; results open + highlight the note
    │   ├── ReviewView     ← daily triage: overdue/flagged/stale/resurfaced + keep-done
    │   ├── SettingsView   ← account, theme, notifications, accent, ~/.trash link
    │   └── ArchiveView    ← $ ls ~/.trash — browse / restore / permanently delete
    ├── CaptureBar         ← hidden on settings + archive
    ├── BottomNav          ← buffer / board / search / review tabs (settings → header gear)
    ├── CommandPalette     ← Ctrl/⌘-K fuzzy command runner
    └── ShortcutsOverlay   ← ? keyboard cheatsheet
```

### File Structure

```
web/src/
├── types.ts                    # ViewName, Note, Category
├── constants.ts                # COLORS, ACCENT_COLORS, DEFAULT_CATEGORIES
├── index.css                   # CSS custom properties, reset, scrollbar
├── App.css                     # .app-shell / .app-shell__content
├── App.tsx                     # Root — boot/data gates, shell wiring, focus-note, palette, global keys
├── main.tsx                    # ReactDOM.createRoot, ErrorBoundary + ToastProvider wrapper
├── lib/
│   ├── supabase.ts             # createClient (throws if env vars missing)
│   ├── push.ts                 # web-push subscribe/unsubscribe/status
│   └── review.ts               # buildReviewSet() — pure triage selector (+ countReviewedToday)
├── hooks/
│   ├── useNotes.ts             # CRUD + pinned-first sort + archive/unarchive + archived fetch
│   ├── useCategories.ts        # CRUD + seed DEFAULT_CATEGORIES if empty + onError callback
│   └── useAuth.ts              # Supabase auth session
├── components/
│   ├── BootSequence.tsx/.css   # Typewriter lines, auto-dismisses at 2.2s
│   ├── DataLoadingScreen.tsx/.css
│   ├── LoginScreen.tsx/.css    # Auth gate (sign in / sign up)
│   ├── AppHeader.tsx/.css      # Brand + live status line (counts, overdue pings, cursor)
│   ├── BottomNav.tsx/.css      # 4 thumb tabs, amber buffer badge (pulses on increment)
│   ├── NoteCard.tsx/.css       # Inline edit, pin, ping presets/snooze/custom, delete→archive
│   ├── CaptureBar.tsx/.css     # Auto-focused prompt, /dir slash-routing, keyboard picker, cached ✓
│   ├── CommandPalette.tsx/.css # Ctrl/⌘-K fuzzy command runner
│   ├── ShortcutsOverlay.tsx/.css # ? keyboard cheatsheet
│   ├── ErrorBoundary.tsx       # Terminal-aesthetic crash fallback screen
│   └── Toast.tsx/.css          # Toast stack + ToastProvider (supports [undo] action button)
└── views/
    ├── BufferView.tsx/.css     # Unsorted notes list (+ search focus/scroll)
    ├── BoardView.tsx/.css      # Category grid → drill-down, config panel with color picker
    ├── SearchView.tsx/.css     # Live search; results open + highlight target note
    ├── ReviewView.tsx/.css     # Daily review triage — buckets + keep/done (reviewMode NoteCards)
    ├── SettingsView.tsx/.css   # Account, theme, notifications, accent, ~/.trash link
    └── ArchiveView.tsx/.css    # $ ls ~/.trash — restore / permanently delete
```

### Design Tokens

```ts
background:   '#1a1a1a'
surface:      '#252525'
surfaceHover: '#2d2d2d'
border:       '#333333'
text:         '#E0E0E0'
textMuted:    '#666666'
textDim:      '#444444'
accent:       '#39FF14'   // matrix green
amber:        '#F5A623'
red:          '#FF4444'
```

CSS custom properties live in `index.css`: `--bg`, `--surface`, `--surface-deep`, `--surface-hover`, `--border`, `--text`, `--text-muted`, `--text-dim`, `--accent`, `--accent-glow`, `--accent-glow-soft`, `--amber`, `--red`, `--font`. Light theme overrides these under `[data-theme="light"]`; accent overrides under `[data-accent="..."]`. **All component CSS must use these variables — no hardcoded hex** (both themes depend on it).

### Animation System

**Phosphor Glow** — active/interactive elements:
- Active tab: `text-shadow: 0 0 6px #39FF1466`
- Capture bar focused: top border + upward box-shadow in green
- Note card hover: `box-shadow: 0 0 12px #39FF1410`
- Note card in edit mode: `border-color: rgba(57,255,20,0.4)`

**Typewriter** — sequential text reveals:
- Boot sequence lines animate `width: 0 → 100%` with `steps()`
- Blinking cursors on boot, data-loading, search empty state, and the AppHeader status line

### Interaction Features

- **Review ritual** — the `review` view (`lib/review.ts` `buildReviewSet`) assembles a bounded daily triage from four buckets: **overdue** pings, **flagged** (`pending_review`), **stale** unsorted (>3d), and **resurfaced** (untouched >21d). Cards render as `reviewMode` `NoteCard`s; each has a **keep/done** chip that stamps `reviewed_at` (and clears an overdue ping) so it stops nagging — plus sort / snooze / archive. `reviewCount` (overdue+flagged+stale) badges the nav tab and a tappable header segment. Empty state: `$ inbox zero` + "cleared N today". The `⚑` flag toggle on any `NoteCard` feeds the flagged bucket.
- **Delete is non-destructive** — `NoteCard` `rm` calls `archiveNote` (soft delete, sets `archived_at`) and fires a toast with an `[undo]` (`unarchiveNote`). Permanent delete (`deleteNote`) lives only in `ArchiveView`.
- **Pin** — `NoteCard` `pin` chip toggles `note.pinned`; `useNotes` sorts pinned-first (accent left-bar marks them).
- **Reminders (ping)** — presets `+1h/+3h/+1d/+3d/+1w`, `custom` (`datetime-local`), and `snooze` on overdue — all reachable from a default card, not just edit mode. Overdue count shows red in the `AppHeader`.
- **Search → open note** — clicking a `grep` result (or recent item) navigates to its home view via `App.handleOpenNote`, opens the category, scrolls to and pulse-highlights the card (`focusNoteId` + `focusNonce`).
- **Command palette** — `Ctrl/⌘-K` (`CommandPalette`); **slash-routing** — `/dir …` in `CaptureBar` files a note straight into a category; **global keys** — `1-4` views, `/` search, `n` new note, `?` cheatsheet (guarded against firing inside inputs).
- **Category color** editable in the `BoardView` config panel (`onSetCategoryColor` → `updateCategory({ color })`).

### Production Infrastructure

- **`ErrorBoundary`** — React class component wrapping the entire app in `main.tsx`. Shows a terminal-aesthetic crash screen (`~/cache $ FATAL ERROR` + `[reload]` button) instead of a blank page.
- **`Toast` / `useToast`** — React context notification system. `useToast()` returns `{ showToast(type, message, options?) }` where `options` = `{ actionLabel?, onAction?, duration? }` (powers the `[undo]` on archive). Types: `error` (red), `ok` (green), `warn` (amber). Auto-dismisses after 4s, stacks up to 3. Replaces all `alert()` and `console.error()` calls.
- **`NoteCard` editing** — Click note text → green-bordered textarea; Enter or blur saves, Escape cancels. `onUpdate(noteId, { text })` called only when text changes.
- **Inline confirmations** — NoteCard `rm` and BoardView category delete both use inline confirm state instead of `window.confirm()`.

### Testing Patterns

Tests use a thennable chain mock for Supabase — the mock object is both chainable (`.from().select().eq()`) and awaitable (`.then()`). Cast the chain with `as unknown as ReturnType<typeof supabase.from>`.

```ts
function makeChain(result: { data: unknown; error: null }) {
  const chain: Record<string, unknown> = {};
  ['select','insert','update','delete','eq','is','order','single'].forEach(m => {
    chain[m] = vi.fn(() => chain);
  });
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(result));
  return chain;
}
```

Components that use `useToast()` must be wrapped in `<ToastProvider>` in tests.

---

## Mobile App (`mobile/`)

React Native + Expo SDK 52 (iOS-first). On hold while web is being built.

### Stack

| Concern | Choice |
|---|---|
| Framework | React Native + Expo SDK 52 |
| Navigation | React Navigation v6 + react-native-pager-view (swipe tabs) |
| Font | JetBrains Mono (expo-font) |
| Backend | Supabase JS client |
| AI sort | Claude Haiku via Anthropic API |

### Commands

```bash
cd mobile
npx expo start           # start dev server
npx expo start --ios     # iOS simulator
npx expo start --android # Android emulator
```

### Key Screens

| Screen | Purpose |
|---|---|
| BufferScreen | Unsorted notes inbox |
| BoardScreen | Category grid + note lists |
| GraphScreen | Note connection explorer |

### Design

Same color palette and JetBrains Mono font as web. Terminal aesthetic with dark background (`#1a1a1a`), matrix-green accent (`#39FF14`).

---

## Docs

Design spec: `docs/superpowers/specs/2026-04-08-cachenotes-web-production.md`
Implementation plan: `docs/superpowers/plans/2026-04-08-cachenotes-web-production.md`

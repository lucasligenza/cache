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
| `notes` | `id`, `text`, `category_id`, `color`, `remind_at`, `pending_review`, `pinned`, `archived_at`, `created_at`, `updated_at` |
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
| Routing | None — `activeView` state in `App.tsx` (`'buffer' | 'board' | 'search'`) |
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
VITE_ANTHROPIC_API_KEY=sk-ant-...   # for AI sort in NoteCard
```

### Layout

Three fixed zones filling the full viewport. No page-level scroll.

```
┌────────────────────────────────────────┐
│  StatusBar  (34px)                     │
├────────────────────────────────────────┤
│                                        │
│  ContentArea  (flex: 1, scrollable)    │
│                                        │
├────────────────────────────────────────┤
│  CaptureBar  (auto-height)             │
└────────────────────────────────────────┘
```

### Component Tree

```
App
├── ErrorBoundary          ← class component, wraps entire app in main.tsx
├── ToastProvider          ← context provider, wraps App in main.tsx
├── BootSequence           ← typewriter boot, dismissed on complete or click
├── DataLoadingScreen      ← shown while Supabase data loads after boot
└── Shell (app-shell div)
    ├── StatusBar
    ├── ContentArea
    │   ├── BufferView     ← unsorted notes inbox
    │   ├── BoardView      ← category grid + drill-down + config panel
    │   └── SearchView     ← live full-text note search (/grep tab)
    └── CaptureBar
```

### File Structure

```
web/src/
├── types.ts                    # ViewName ('buffer'|'board'|'search'), Note, Category
├── constants.ts                # COLORS, ACCENT_COLORS, DEFAULT_CATEGORIES
├── index.css                   # CSS custom properties, reset, scrollbar
├── App.css                     # .app-shell / .app-shell__content
├── App.tsx                     # Root — boot gate, data gate, shell wiring, toast wiring
├── main.tsx                    # ReactDOM.createRoot, ErrorBoundary + ToastProvider wrapper
├── lib/
│   └── supabase.ts             # createClient (throws if env vars missing)
├── hooks/
│   ├── useNotes.ts             # CRUD + unsortedNotes + getNotesByCategory + onError callback
│   └── useCategories.ts        # CRUD + seed DEFAULT_CATEGORIES if empty + onError callback
├── components/
│   ├── BootSequence.tsx/.css   # Typewriter lines, auto-dismisses at 2.2s
│   ├── DataLoadingScreen.tsx/.css
│   ├── StatusBar.tsx/.css      # Tab buttons, amber buffer badge
│   ├── NoteCard.tsx/.css       # Inline editing, inline delete confirm, AI sort, useToast
│   ├── CaptureBar.tsx/.css     # Auto-focused prompt bar, ~/cache $ inline
│   ├── ErrorBoundary.tsx       # Terminal-aesthetic crash fallback screen
│   └── Toast.tsx/.css          # Toast stack + ToastProvider context
└── views/
    ├── BufferView.tsx/.css     # Unsorted notes list
    ├── BoardView.tsx/.css      # Category grid → detail drill-down, inline category delete confirm
    └── SearchView.tsx/.css     # Live full-text search, ~/cache $ grep aesthetic
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

CSS custom properties live in `index.css`: `--bg`, `--surface`, `--border`, `--text`, `--text-muted`, `--text-dim`, `--accent`, `--amber`, `--red`, `--font`.

### Animation System

**Phosphor Glow** — active/interactive elements:
- Active tab: `text-shadow: 0 0 6px #39FF1466`
- Capture bar focused: top border + upward box-shadow in green
- Note card hover: `box-shadow: 0 0 12px #39FF1410`
- Note card in edit mode: `border-color: rgba(57,255,20,0.4)`

**Typewriter** — sequential text reveals:
- Boot sequence lines animate `width: 0 → 100%` with `steps()`
- AI sort status types in character by character

### Production Infrastructure

- **`ErrorBoundary`** — React class component wrapping the entire app in `main.tsx`. Shows a terminal-aesthetic crash screen (`~/cache $ FATAL ERROR` + `[reload]` button) instead of a blank page.
- **`Toast` / `useToast`** — React context notification system. `useToast()` returns `{ showToast(type, message) }`. Types: `error` (red), `ok` (green), `warn` (amber). Auto-dismisses after 4s, stacks up to 3. Replaces all `alert()` and `console.error()` calls.
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

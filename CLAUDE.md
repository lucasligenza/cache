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
| `note_connections` | `id`, `source_note_id`, `target_note_id`, `created_at` |

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
| Routing | None — `activeView` state in `App.tsx` |
| Testing | Vitest + @testing-library/react |

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
├── BootSequence           ← typewriter boot, dismissed on complete or click
├── DataLoadingScreen      ← shown while Supabase data loads after boot
└── Shell (app-shell div)
    ├── StatusBar
    ├── ContentArea
    │   ├── BufferView     ← unsorted notes inbox
    │   ├── BoardView      ← category grid + drill-down + config panel
    │   └── GraphView      ← note connections explorer
    └── CaptureBar
```

### File Structure

```
web/src/
├── types.ts                    # ViewName, Note, Category, NoteConnection
├── constants.ts                # COLORS, ACCENT_COLORS, DEFAULT_CATEGORIES
├── index.css                   # CSS custom properties, reset, scrollbar
├── App.css                     # .app-shell / .app-shell__content
├── App.tsx                     # Root — boot gate, data gate, shell wiring
├── main.tsx                    # ReactDOM.createRoot
├── lib/
│   └── supabase.ts             # createClient (throws if env vars missing)
├── hooks/
│   ├── useNotes.ts             # CRUD + unsortedNotes + getNotesByCategory
│   ├── useCategories.ts        # CRUD + seed DEFAULT_CATEGORIES if empty
│   └── useNoteConnections.ts   # manual fetchConnections, addConnection, removeConnection
├── components/
│   ├── BootSequence.tsx/.css   # Typewriter lines, auto-dismisses at 2.2s
│   ├── DataLoadingScreen.tsx/.css
│   ├── StatusBar.tsx/.css      # Tab buttons, amber buffer badge
│   ├── NoteCard.tsx/.css       # Stale border, AI sort, category chips, delete
│   └── CaptureBar.tsx/.css     # Auto-focused prompt bar, ~/cache $ inline
└── views/
    ├── BufferView.tsx/.css     # Unsorted notes list
    ├── BoardView.tsx/.css      # Category grid → detail drill-down
    └── GraphView.tsx/.css      # CSS orbit layout, edge lines
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

**Typewriter** — sequential text reveals:
- Boot sequence lines animate `width: 0 → 100%` with `steps()`
- AI sort status types in character by character

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

Design spec: `docs/superpowers/specs/2026-04-07-cache-web-design.md`
Implementation plan: `docs/superpowers/plans/2026-04-07-cache-web.md`

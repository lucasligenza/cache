# CacheNotes — Technical Reference

Terminal-aesthetic note organizer. An **npm-workspaces monorepo**: two sibling apps and a shared core, over one Supabase backend.

```
CacheNotes/                 ← npm-workspaces monorepo (root package.json)
├── packages/
│   └── core/        ← @cache/core — shared types + business logic (web + native)
├── web/             ← React + Vite (terminal GUI) — the live product
├── mobile/          ← React Native + Expo (dormant; to be rebuilt on @cache/core in H2)
├── supabase/        ← migrations, edge function (send-reminders), cron docs
└── CLAUDE.md        ← this file
```

> **Workspace note:** `npm install` runs at the **repo root** (workspaces: `web`, `packages/*`; `mobile` is excluded until it's rebuilt on the core). One root lockfile. See **Shared Core** and the web **Deployment** row.

Longer-term direction lives in the roadmap plan (see **Docs**). Current focus: Horizon 1 — extracting `@cache/core`, observability, test coverage, auth/guest lifecycle, PWA quality.

---

## Shared Core (`@cache/core`)

`packages/core` holds the platform-agnostic layer consumed by web (and, later, native). Exports a single barrel (`packages/core/src/index.ts`):

| Module | Contents |
|---|---|
| `types.ts` | `Note`, `Category` data types |
| `review.ts` | `buildReviewSet()` triage + `countReviewedToday()` + constants |
| `outbox.ts` | offline capture queue; **storage is injected** via `setOutboxStorage()` (web falls back to `localStorage`; native passes a synchronous MMKV adapter) |
| `exporter.ts` | pure `buildJson` / `buildMarkdown` (the browser download wrapper stays in web) |
| `useNotes.ts` | `useNotesCore(deps)` — Supabase data layer + offline-sync orchestration; inject `supabase` + `isOnline()` |
| `useCategories.ts` | `useCategoriesCore(deps)` — categories CRUD; inject `supabase` + seed defaults + accent palette |
| `useAuth.ts` | `useAuthCore(deps)` — Supabase auth; inject `supabase` |

Core declares `react` + `@supabase/supabase-js` as **peer deps** (the consuming app provides a single instance) and dev deps (its own type-check).

**Web consumes core with a thin layer** so importers are unchanged:
- **Lib shims** re-export: `web/src/types.ts`, `web/src/lib/{review,outbox,exporter}.ts` just re-export from `@cache/core` (web keeps only `ViewName` + the export download wrapper).
- **Hook wrappers** inject web platform deps: `web/src/hooks/{useNotes,useCategories,useAuth}.ts` are ~10-line wrappers passing the web Supabase client, `navigator.onLine`, and web defaults into the `*Core` hooks.

When adding shared logic, put it in `packages/core` and re-export / inject from the web layer.

---

## Shared Backend (Supabase)

One Supabase project used by both apps. Same schema, same credentials.

### Tables

| Table | Key columns |
|---|---|
| `notes` | `id`, `text`, `category_id`, `color`, `remind_at`, `pending_review` (manual "review later" flag), `pinned`, `archived_at`, `reviewed_at`, `review_muted` (never-nag), `reminded_at` (push dedup), `user_id` (defaults `auth.uid()`), `created_at`, `updated_at` |
| `categories` | `id`, `name`, `color`, `user_id`, `created_at` |
| `push_subscriptions` | web-push endpoints per user |

Notes with `archived_at IS NULL` are active. Notes with `category_id IS NULL` are unsorted (buffer). **RLS** is enabled on every table with per-user policies (`auth.uid() = user_id`); guests are anonymous auth users.

**Migrations & backend infra are committed** under `supabase/`: `migrations/` (baseline schema + `reviewed_at` / `review_muted` / `reminded_at` / `push_subscriptions`), the `send-reminders` edge function, and `cron/send-reminders.sql` (the pg_cron scheduler — kept out of the auto-run chain because it targets the prod function URL).

**Reminders** — a pg_cron job hits the `send-reminders` edge function every 5 min. It queries **all** past-due reminders (`remind_at <= now`, not a window, so a missed run never drops one) and stamps `reminded_at` to dedupe (a newer `remind_at` re-arms it).

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
| Shared core | Consumes `@cache/core` (workspace dependency) via re-export shims |
| Deployment | Vercel — **Root Directory = `web`**; `web/vercel.json` sets `installCommand: cd .. && rm -f package-lock.json && npm install` (installs the workspace root; the `rm` dodges the npm/cli#4828 rollup optional-dep bug on Linux), `buildCommand: npm run build`, and rewrites all routes to `index.html`. Prod domain `cache-gilt.vercel.app`. |

### Commands

```bash
# install ONCE at the repo root (workspaces) — not inside web/
npm install
cd web
cp .env.example .env       # then fill in credentials
npm run dev                # dev server at http://localhost:5173
npm run build              # TypeScript check (tsc -b) + production build
npm test                   # Vitest unit tests (also exercise @cache/core via the shims)
```

### Environment Variables (`web/.env`)

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_VAPID_PUBLIC_KEY=...            # web-push (reminders)
VITE_ANTHROPIC_API_KEY=sk-ant-...   # reserved for AI sort — see note below (feature deferred, not wired)
VITE_ERROR_REPORT_URL=...           # optional error telemetry collector — blank = inert
VITE_RELEASE=...                    # optional build/commit id tagged on error reports
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
├── types.ts                    # ViewName (web-only) + re-exports Note/Category from @cache/core
├── constants.ts                # COLORS, ACCENT_COLORS, DEFAULT_CATEGORIES
├── index.css                   # CSS custom properties, reset, scrollbar
├── App.css                     # .app-shell / .app-shell__content
├── App.tsx                     # Root — boot/data gates, shell wiring, focus-note, palette, global keys
├── main.tsx                    # ReactDOM.createRoot, ErrorBoundary + ToastProvider wrapper
├── lib/
│   ├── supabase.ts             # createClient (throws if env vars missing)
│   ├── push.ts                 # web-push subscribe/unsubscribe/status
│   ├── telemetry.ts            # provider-agnostic error reporting (VITE_ERROR_REPORT_URL; inert if unset)
│   ├── review.ts               # → re-exports @cache/core (buildReviewSet, countReviewedToday)
│   ├── outbox.ts               # → re-exports @cache/core (offline capture queue)
│   └── exporter.ts             # buildJson/buildMarkdown re-exported from core + web download wrapper
├── hooks/
│   ├── useNotes.ts             # → wrapper: injects supabase + navigator.onLine into @cache/core useNotesCore
│   ├── useCategories.ts        # → wrapper: injects supabase + DEFAULT_CATEGORIES + ACCENT_COLORS into useCategoriesCore
│   ├── useAuth.ts              # → wrapper: injects supabase into useAuthCore
│   └── useFocusTrap.ts         # trap Tab + restore focus for modals (palette/overlays) — web-only
├── components/
│   ├── BootSequence.tsx/.css   # Typewriter lines, auto-dismisses at 2.2s
│   ├── DataLoadingScreen.tsx/.css
│   ├── LoginScreen.tsx/.css    # Auth gate (sign in / sign up)
│   ├── AppHeader.tsx/.css      # Brand + live status line (counts, overdue pings, cursor)
│   ├── BottomNav.tsx/.css      # 4 thumb tabs, amber buffer badge (pulses on increment)
│   ├── NoteCard.tsx/.css       # Inline edit, pin, ping presets/snooze/custom, delete→archive
│   ├── CaptureBar.tsx/.css     # Auto-focused prompt, /dir slash-routing, keyboard picker, cached ✓
│   ├── CommandPalette.tsx/.css # Ctrl/⌘-K fuzzy command runner (role=dialog + focus trap)
│   ├── ShortcutsOverlay.tsx/.css # ? keyboard cheatsheet (role=dialog + focus trap)
│   ├── OnboardingOverlay.tsx/.css # one-time first-run tips (localStorage cn_onboarded)
│   ├── ConnectionError.tsx/.css # themed retry screen when initial data load fails
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

```
packages/core/src/
├── index.ts                    # barrel — re-exports everything below
├── types.ts                    # Note, Category
├── review.ts                   # buildReviewSet, countReviewedToday, constants
├── outbox.ts                   # OutboxItem, read/write/add/remove/update, newId, setOutboxStorage (SyncStorage)
├── exporter.ts                 # buildJson, buildMarkdown (pure)
├── useNotes.ts                 # useNotesCore(deps) — data layer + offline-sync orchestration
├── useCategories.ts            # useCategoriesCore(deps) — categories CRUD + seed
└── useAuth.ts                  # useAuthCore(deps) — Supabase auth
```

> Tests for the moved modules currently live in `web/src/lib/*.test.ts` and exercise core through the shims. Relocating them into `packages/core` with its own Vitest is a follow-up.

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

- **Review ritual** — the `review` view (`@cache/core` `buildReviewSet`, via `lib/review.ts`) assembles a bounded daily triage from four buckets: **overdue** pings, **flagged** (`pending_review`), **stale** unsorted (>3d), and **resurfaced** (untouched >21d, cap 3). Cards render as `reviewMode` `NoteCard`s; each has a **keep/done** chip that stamps `reviewed_at` (and clears an overdue ping) so it stops nagging — plus sort / snooze / mute / archive. `buildReviewSet` returns `count` (**all** buckets incl. resurfaced — the honest nav/header badge, never a silent 0) and `actionable` (overdue+flagged+stale, for header wording). Empty state: `$ inbox zero` + "cleared N today". The `⚑` flag toggle on any `NoteCard` feeds the flagged bucket.
- **Never-nag** — a `mute` chip in review sets `notes.review_muted`, permanently excluding a note from the passive buckets (stale, resurfaced); explicit reminders/flags are unaffected. A muted note shows a `muted` chip elsewhere to un-mute.
- **Offline-safe capture** — capture is durable-first: `CaptureBar` commits are `async` and the input clears only after the note is written to the `@cache/core` outbox (`localStorage cn_outbox_v1`). `useNotes.createNote` is queue-first (client UUID as the row id → idempotent sync; `23505` = already-synced), resolving on local durability and rejecting only if the local write fails (then the editor keeps the text). Queued notes show a `[queued]` chip + a `· N queued` header segment; `flushOutbox` runs on reconnect + app load. `/dir` feedback: an unknown category files the note verbatim to buffer with a warning; a body-less `/dir` hints instead of a silent no-op.
- **Delete is non-destructive** — `NoteCard` `rm` calls `archiveNote` (soft delete, sets `archived_at`) and fires a toast with an `[undo]` (`unarchiveNote`). Permanent delete (`deleteNote`) lives only in `ArchiveView`.
- **Pin** — `NoteCard` `pin` chip toggles `note.pinned`; `useNotes` sorts pinned-first (accent left-bar marks them).
- **Reminders (ping)** — presets `+1h/+3h/+1d/+3d/+1w`, `custom` (`datetime-local`), and `snooze` on overdue — all reachable from a default card, not just edit mode. Overdue count shows red in the `AppHeader`.
- **Search → open note** — clicking a `grep` result (or recent item) navigates to its home view via `App.handleOpenNote`, opens the category, scrolls to and pulse-highlights the card (`focusNoteId` + `focusNonce`).
- **Command palette** — `Ctrl/⌘-K` (`CommandPalette`); **slash-routing** — `/dir …` in `CaptureBar` files a note straight into a category; **global keys** — `1-4` views, `/` search, `n` new note, `?` cheatsheet (guarded against firing inside inputs).
- **Category color** editable in the `BoardView` config panel (`onSetCategoryColor` → `updateCategory({ color })`).

### Reliability & Accessibility

- **A11y** — note tap-to-edit is a real focusable `role="button"` (Enter/Space); `CommandPalette`/`ShortcutsOverlay`/`OnboardingOverlay` are `role="dialog"` with `useFocusTrap` (trap Tab + restore focus, Esc closes); toasts live in an `aria-live="polite"` region; active nav tab has `aria-current="page"`; `index.css` honors `prefers-reduced-motion`.
- **Errors/loading** — `useNotes`/`useCategories` expose an `error` flag; App shows `ConnectionError` (with `[retry]`) only when the *initial* load fails with no data (a failed rollback-resync never blanks the app). Auth loader is theme-aware. `online`/`offline` window events toast.
- **Onboarding** — first run shows `OnboardingOverlay` once (`cn_onboarded`). Guests get an amber `guest` chip in the header + a **create-account** upgrade form in Settings (`upgradeGuest` → `supabase.auth.updateUser`, preserving notes).
- **Export** — Settings → `data`: JSON + Markdown export of notes+categories via `lib/exporter.ts` (client-side Blob download).

### Production Infrastructure

- **`ErrorBoundary`** — React class component wrapping the entire app in `main.tsx`. Shows a terminal-aesthetic crash screen (`~/cache $ FATAL ERROR` + `[reload]` button) instead of a blank page. `componentDidCatch` reports the crash via `lib/telemetry`.
- **`lib/telemetry.ts`** — provider-agnostic error telemetry. `initTelemetry()` (called in `main.tsx`) captures uncaught errors + unhandled rejections; `reportError()` dedupes + rate-limits and POSTs JSON to `VITE_ERROR_REPORT_URL` (inert if unset; logs in dev). `createTelemetry({ endpoint, send })` factory keeps it testable. Never throws.
- **`Toast` / `useToast`** — React context notification system. `useToast()` returns `{ showToast(type, message, options?) }` where `options` = `{ actionLabel?, onAction?, duration? }` (powers the `[undo]` on archive). Types: `error` (red), `ok` (green), `warn` (amber). Auto-dismisses after 4s, stacks up to 3. Replaces all `alert()` and `console.error()` calls.
- **`NoteCard` editing** — Click note text → green-bordered textarea; Enter or blur saves, Escape cancels. `onUpdate(noteId, { text })` called only when text changes.
- **Inline confirmations** — NoteCard `rm` and BoardView category delete both use inline confirm state instead of `window.confirm()`.

### Testing Patterns

Tests use a thennable chain mock for Supabase — the mock object is both chainable (`.from().select().eq()`) and awaitable (`.then()`). Cast the chain with `as unknown as ReturnType<typeof supabase.from>`.

```ts
function makeChain(result: { data: unknown; error: null }) {
  const chain: Record<string, unknown> = {};
  ['select','insert','update','delete','eq','is','not','in','order','single'].forEach(m => {
    chain[m] = vi.fn(() => chain);
  });
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(result));
  return chain;
}
```

Components that use `useToast()` must be wrapped in `<ToastProvider>` in tests. Outbox-touching tests toggle `navigator.onLine` and clear `localStorage` in `beforeEach`.

---

## Mobile App (`mobile/`)

React Native + Expo (iOS-first). **Dormant** and diverged from web (its own copies of hooks/types). Roadmap **Horizon 2** rebuilds it on `@cache/core` for shared logic — it is **excluded from the npm workspace** until then, so it installs independently (`cd mobile && npm install`).

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

- Original web design spec: `docs/superpowers/specs/2026-04-07-cache-web-design.md`
- Production-hardening spec: `docs/superpowers/specs/2026-04-08-cachenotes-web-production.md` (untracked)
- Build plan: `docs/superpowers/plans/2026-04-07-cache-web.md`
- **Longer-term roadmap** — grow-to-product across web + a revived native iOS on `@cache/core`, with four horizons. Confirm scope before large horizon work.

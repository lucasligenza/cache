# Cache Web — Design Spec
**Date:** 2026-04-07  
**Status:** Approved

---

## Overview

Cache is a terminal-aesthetic note organizer, currently an iOS app built with React Native + Expo. This spec covers the design of a web version that shares the same Supabase backend and feature set, but leans further into the terminal metaphor — replacing swipe navigation with a persistent terminal shell layout.

---

## Project Structure

The repository is reorganized into two sibling folders under the existing root:

```
CacheNotes/
├── mobile/          ← existing React Native + Expo app (moved here)
├── web/             ← new React + Vite web app
└── CLAUDE.md        ← updated to document both apps
```

---

## Web App Stack

| Concern | Choice |
|---|---|
| Framework | React + Vite + TypeScript |
| Styling | Plain CSS (no framework) |
| Font | JetBrains Mono (Google Fonts) |
| Backend | Supabase — same project and schema as mobile |
| AI sort | Claude Haiku (`claude-haiku-4-5-20251001`) via Anthropic API |
| State | React hooks only — no global state library |
| Routing | None — `activeView` state in `App.tsx` |

---

## Layout

Three fixed zones that together fill the full viewport height. No scrolling at the shell level — only the content area scrolls internally.

```
┌────────────────────────────────────────┐
│  status bar  (34px, fixed)             │
├────────────────────────────────────────┤
│                                        │
│  content area  (flex: 1, scrollable)   │
│                                        │
├────────────────────────────────────────┤
│  capture bar  (auto-height, fixed)     │
└────────────────────────────────────────┘
```

### Status Bar
- Left: `cache` brand in green glow, then tab buttons: `buffer [n]` · `board` · `graph`
- Right: `~/cache` path label in dim color
- Active tab: green text + green bottom border + phosphor glow
- Buffer badge: amber count of unsorted notes, hidden when zero

### Content Area
- Fills remaining height, scrollable
- Switches between three views based on `activeView` state
- Content crossfades on tab switch (100ms opacity transition)

### Capture Bar
- Always visible, never hidden
- Auto-focused on app load — cursor blinking, bar in active glow state from the first frame
- Layout: `~/cache $` prompt inline with a growing textarea on the same line
- Below the input row: `→ buffer` category selector on the left, `↵ commit · tab for category` hint on the right
- Focused state: top border glows green (`#39FF1455`), upward box-shadow (`0 -8px 32px #39FF1418`), prompt label turns green with text-shadow
- `Enter` commits the note and clears the input
- Clicking `→ buffer` / pressing `Tab` opens an inline category picker; selecting a category updates the label to e.g. `→ /work`
- On commit, if buffer is the active view, the new note slides up into the list with a fade-in

---

## Views

### BufferView
Unsorted notes inbox. Each note is a `NoteCard` with:
- Note text
- Relative timestamp (`2h ago`, `3d ago`)
- Category chips — one per category, clicking assigns and exits the card
- `⚡ sort` button — calls Claude Haiku, shows `sorting...` typewriter text, auto-assigns on response
- Stale notes (≥3 days old) get a red left border accent
- Cards slide out to the left on assignment (same animation as mobile)

### BoardView
Category grid (3-column). Each cell shows `/category-name` in its color and note count. Clicking a category replaces the grid with a note list for that category — showing all notes with inline editing and reminders (matching mobile Board behavior). A `← back` breadcrumb returns to the grid.

### GraphView
Note connection explorer. Adapted from the mobile `GraphView` component — select a root note, see connected notes arranged in orbit. Add/remove connections. Uses CSS transforms for positioning (no SVG/canvas library).

---

## Component Tree

```
App
├── BootSequence           ← typewriter boot, dismissed on complete or click
├── DataLoadingScreen      ← shown while Supabase data loads after boot
└── Shell
    ├── StatusBar
    ├── ContentArea
    │   ├── BufferView
    │   │   └── NoteCard (× n)
    │   ├── BoardView
    │   │   └── NoteCard (× n, inside category)
    │   └── GraphView
    └── CaptureBar
```

---

## Hooks

All three hooks mirror the mobile versions but use plain `fetch`/Supabase JS client (no Expo dependencies):

| Hook | Responsibility |
|---|---|
| `useNotes` | CRUD for notes, unsorted filter, category filter |
| `useCategories` | CRUD for categories |
| `useNoteConnections` | Fetch, add, remove connections for a given note |

---

## Animation System

Two animation personalities combined throughout:

**Phosphor Glow** — applied to interactive/active elements:
- Active tab: `text-shadow: 0 0 6px #39FF1466`
- Capture bar prompt when focused: `text-shadow: 0 0 8px #39FF1488`
- Capture bar border + shadow when focused
- Note card on hover: `box-shadow: 0 0 12px #39FF1410`, border tints green

**Typewriter** — applied to sequential text reveals:
- Boot sequence lines appear one at a time with CSS `width: 0 → 100%` animation
- AI sort status text (`sorting...`, category name) types in character by character
- Note text on new commits types in before the card fully renders (optional, kept short)

Transition durations follow the mobile convention: press/assign animations ~250ms, fades ~200ms.

---

## Colors & Tokens

Same values as mobile `constants.ts`:

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

Category accent colors shared from `ACCENT_COLORS` constant.

---

## CLAUDE.md Update

The root `CLAUDE.md` is rewritten to accurately document the CacheNotes project (replacing the stale RookieMVP content). It covers both `mobile/` and `web/` — their stacks, structure, commands, and shared backend.

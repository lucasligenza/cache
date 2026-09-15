# Cache (native)

Terminal-aesthetic note inbox for iOS, built with React Native + Expo SDK 54.
This app consumes shared `@cache/core` (auth, notes, categories, outbox) — the same
Supabase-backed buffer web uses.

**This slice:** open the app → type with your thumb → save → the note lands in
buffer. Saving does **not** start a review, todo list, or reminder.

## Why `mobile/` is not in the root npm workspaces

The root workspace (`web` + `packages/core`) is React 18. Expo SDK 54 needs
React 19 + React Native. Hoisting those together breaks both apps, so mobile
still installs on its own and pulls core via `"@cache/core": "file:../packages/core"`.

```bash
# web / core (repo root)
npm install

# native (this folder)
cd mobile
npm install
```

## Setup

1. From `mobile/`:
   ```bash
   npm install
   ```

2. Credentials — either works:
   - Copy `.env.example` to `.env` and set `EXPO_PUBLIC_SUPABASE_URL` +
     `EXPO_PUBLIC_SUPABASE_ANON_KEY` (same project as web), **or**
   - Leave `expo.extra` in `app.json` filled (anon key is public by design).

3. Anonymous sign-in must be enabled on that Supabase project (guest capture).

## How to run (iPhone)

From `mobile/`:

```bash
npx expo start
```

Then pick one:

| Path | When to use |
|---|---|
| **Expo Go** (iPhone) | Default for this slice. Install Expo Go, scan the QR code. No custom native modules. |
| **iOS Simulator** | Mac + Xcode: `npx expo start --ios` |
| **Dev client / `expo prebuild`** | **Not required** for capture. Needed later if we add modules Expo Go does not ship (e.g. MMKV). Do not App Store / TestFlight submit from this work. |

Same commands as scripts: `npm start`, `npm run ios`.

Expo Go vs a dev client: this capture path uses `expo-sqlite` (sync API) +
AsyncStorage + NetInfo, all available in Expo Go on SDK 54. A custom dev client
is only necessary if you add native code Expo Go does not include.

## One-handed capture

Capture is the middle pager page (opens by default). The composer is **docked
to the bottom**: field, category chips, then a full-width **save** (52pt).
While the software keyboard is open:

- pager dots hide so they cannot cover Save
- the shell pads by keyboard height (React Native `Keyboard` events + safe-area),
  not web `visualViewport` hacks
- Save stays directly above the keyboard in the thumb zone

After save you stay on capture (`cached ✓`); swipe left to see buffer.

Hardware keyboard in Simulator: **I/O → Keyboard → Connect Hardware Keyboard**
off, otherwise the software keyboard (the thing we care about) will not show.

## Tests

```bash
cd mobile
npm test        # vitest — capture routing + outbox adapter + keyboard inset
npm run typecheck
```

# Cache

Terminal-aesthetic sticky note organizer for iOS, built with React Native + Expo.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a Supabase project at supabase.com, run the schema from `supabase/schema.sql`.

3. Update `app.json` extras with your credentials:
   ```json
   "extra": {
     "supabaseUrl": "https://your-project.supabase.co",
     "supabaseAnonKey": "your-anon-key",
     "anthropicApiKey": "your-key"
   }
   ```

4. Start the app:
   ```bash
   npx expo start --ios
   ```

## Features

- **Capture** — Quick note entry, auto-focused input, commit to buffer
- **Buffer** — Unsorted inbox, category chips for one-tap sorting, AI sort via Claude Haiku
- **Board** — Category directories, note walls, inline editing, reminders

## Stack

- React Native + Expo SDK 52
- Supabase (Postgres)
- react-native-pager-view
- react-native-reanimated
- JetBrains Mono font

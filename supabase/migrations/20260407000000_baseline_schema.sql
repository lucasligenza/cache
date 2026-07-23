-- Baseline capture of the core schema that predates the tracked migrations.
-- The live database was built out-of-band (dashboard/SQL editor), so this file
-- reconstructs it for reproducibility. It is written idempotently (IF NOT EXISTS /
-- DROP POLICY IF EXISTS) so it is a safe no-op against the existing project and
-- can recreate the schema from scratch (`supabase db reset`).
--
-- NOTE: `notes.reviewed_at`, `notes.review_muted`, and `notes.reminded_at` are
-- added by the later migrations in this folder, not here.

create extension if not exists pgcrypto;

-- Categories ----------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text,
  created_at timestamptz default now(),
  user_id    uuid default auth.uid() references auth.users(id) on delete cascade
);

-- Notes ---------------------------------------------------------------------
create table if not exists public.notes (
  id             uuid primary key default gen_random_uuid(),
  text           text not null,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  category_id    uuid references public.categories(id) on delete set null,
  color          text,
  remind_at      timestamptz,
  pending_review boolean default false,
  pinned         boolean default false,
  archived_at    timestamptz,
  user_id        uuid default auth.uid() references auth.users(id) on delete cascade
);

-- Note connections (present in schema; unused by the web app) ----------------
create table if not exists public.note_connections (
  id             uuid primary key default gen_random_uuid(),
  source_note_id uuid not null references public.notes(id) on delete cascade,
  target_note_id uuid not null references public.notes(id) on delete cascade,
  created_at     timestamptz default now(),
  unique (source_note_id, target_note_id)
);

-- Row-level security --------------------------------------------------------
alter table public.categories       enable row level security;
alter table public.notes            enable row level security;
alter table public.note_connections enable row level security;

drop policy if exists "Users see own categories" on public.categories;
create policy "Users see own categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users see own notes" on public.notes;
create policy "Users see own notes" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- note_connections has RLS enabled but intentionally no policy (locked down;
-- the web app does not use it).

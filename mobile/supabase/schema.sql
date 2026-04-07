-- categories table
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null,
  created_at timestamptz default now()
);

-- notes table
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  category_id uuid references categories(id) on delete set null,
  color text,
  remind_at timestamptz,
  pending_review boolean default false
);

-- Migrations
alter table notes add column if not exists pinned boolean default false;
alter table notes add column if not exists archived_at timestamptz;

-- note_connections table (undirected graph edges)
create table if not exists note_connections (
  id uuid primary key default gen_random_uuid(),
  source_note_id uuid not null references notes(id) on delete cascade,
  target_note_id uuid not null references notes(id) on delete cascade,
  created_at timestamptz default now(),
  unique(source_note_id, target_note_id)
);

-- Enable RLS (optional for MVP)
-- alter table categories enable row level security;
-- alter table notes enable row level security;

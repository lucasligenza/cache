-- Review ritual: "keep/done" stamps reviewed_at so a note stops nagging in the
-- review buckets (stale within 7d, resurfaced within 21d). Applied to prod as
-- migration 20260722210040; captured here for reproducibility.
alter table public.notes
  add column if not exists reviewed_at timestamptz;

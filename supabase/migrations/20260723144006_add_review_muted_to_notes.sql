-- "Never nag": lets a user permanently exclude a note from the passive review
-- buckets (stale, resurfaced) without archiving it. Explicit reminders
-- (remind_at) and flags (pending_review) are unaffected. Covered by the existing
-- notes RLS policy ("Users see own notes", FOR ALL USING auth.uid() = user_id).
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS review_muted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.notes.review_muted IS 'When true, the note is excluded from passive review buckets (stale, resurfaced) — the user''s "never nag" opt-out.';

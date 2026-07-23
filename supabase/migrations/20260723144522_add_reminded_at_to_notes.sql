-- Reminder delivery dedup: send-reminders stamps reminded_at after processing a
-- due reminder, and only pushes where reminded_at IS NULL OR reminded_at <
-- remind_at. This fixes the old function's missed-window data loss (it queried a
-- 5-minute window) and prevents duplicate sends. Applied to prod as migration
-- 20260723144522.
alter table public.notes
  add column if not exists reminded_at timestamptz;

comment on column public.notes.reminded_at is 'Timestamp of the last push reminder sent for the current remind_at; a newer remind_at re-arms the reminder.';

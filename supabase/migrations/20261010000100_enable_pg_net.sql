-- The send-reminders cron job calls net.http_post. pg_net was never enabled on
-- prod, so every run from 2026-04-08 until this migration failed with
-- `schema "net" does not exist` and no reminder was ever sent.
-- pg_net always creates its functions in the `net` schema; `extensions` only
-- holds the extension's catalog entry (the Supabase dashboard default).
create extension if not exists pg_net with schema extensions;

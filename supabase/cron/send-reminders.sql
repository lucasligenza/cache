-- Reminder delivery scheduler (PRODUCTION-ONLY — do NOT put in migrations/).
--
-- This is deliberately kept out of the auto-run migration chain: it embeds the
-- project URL + anon key and, if it ran during a local `supabase db reset`, the
-- local database would start POSTing to the production edge function every 5
-- minutes. Apply it by hand in the Supabase SQL editor for the target project.
--
-- It schedules the `send-reminders` edge function (supabase/functions/send-reminders)
-- every 5 minutes via pg_cron + pg_net. The function itself queries all past-due
-- reminders and dedupes via notes.reminded_at, so the exact cron cadence is not
-- load-bearing — a missed run is caught on the next one.
--
-- Prereqs (enabled on the live project): extensions pg_cron and pg_net.
-- Replace <PROJECT_REF> and <ANON_KEY> for the target project. The anon key is
-- public-by-design (it also ships in the web bundle); the edge function enforces
-- auth via verify_jwt and uses the service-role key internally.

-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;

select cron.schedule(
  'send-reminders',
  '*/5 * * * *',
  $$
    select net.http_post(
      url    := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
      headers := '{"Authorization": "Bearer <ANON_KEY>"}'::jsonb,
      body   := '{}'::jsonb
    )
  $$
);

-- To inspect / remove:
--   select jobid, schedule, command, active from cron.job where jobname = 'send-reminders';
--   select cron.unschedule('send-reminders');

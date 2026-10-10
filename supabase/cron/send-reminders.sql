-- Reminder delivery scheduler (PRODUCTION-ONLY — do NOT put in migrations/).
--
-- This is deliberately kept out of the auto-run migration chain: it embeds the
-- project URL + anon key and, if it ran during a local `supabase db reset`, the
-- local database would start POSTing to the production edge function every 5
-- minutes. Apply it by hand in the Supabase SQL editor for the target project.
-- Re-running it is safe: cron.schedule() with an existing job name updates it.
--
-- It schedules the `send-reminders` edge function (supabase/functions/send-reminders)
-- every 5 minutes via pg_cron + pg_net. The function itself queries all past-due
-- reminders and dedupes via notes.reminded_at, so the exact cron cadence is not
-- load-bearing — a missed run is caught on the next one.
--
-- Prereqs, all created by supabase/migrations/:
--   - pg_cron and pg_net (20261010000100_enable_pg_net.sql)
--   - the Vault secret `send_reminders_cron_secret` (20261010000300_reminder_cron_ops.sql)
--
-- Replace <PROJECT_REF> and <ANON_KEY> for the target project. The anon key is
-- public-by-design (it also ships in the web bundle) and only gets the request
-- past the gateway's verify_jwt check. The function rejects any request whose
-- x-cron-secret header doesn't match the Vault secret, so the anon key alone
-- can't trigger it.

select cron.schedule(
  'send-reminders',
  '*/5 * * * *',
  $$
    select net.http_post(
      url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <ANON_KEY>',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
                           where name = 'send_reminders_cron_secret')
      ),
      body    := '{}'::jsonb,
      timeout_milliseconds := 30000
    )
  $$
);

-- To inspect / remove:
--   select jobid, jobname, schedule, active from cron.job;
--   select status, return_message, start_time from cron.job_run_details order by start_time desc limit 20;
--   select * from ops.reminder_runs order by ran_at desc limit 20;   -- written by the function
--   select id, status_code, left(content, 200), error_msg, created from net._http_response order by created desc limit 20;
--   select ops.cron_health_report();                                 -- null = healthy
--   select cron.unschedule('send-reminders');

-- Operations for the send-reminders cron job:
--   1. a shared cron secret (Vault) so the edge function rejects anyone holding
--      only the public anon key,
--   2. a run log written by the edge function,
--   3. a daily purge of cron/run logs, and
--   4. a daily health check that alerts on failed or missing runs.
--
-- The send-reminders schedule itself stays in supabase/cron/send-reminders.sql
-- (it targets the prod function URL). The two jobs scheduled here only touch
-- this database, so they are safe on a local stack too.

create extension if not exists pg_cron;

create schema if not exists ops;
revoke all on schema ops from public, anon, authenticated;

-- Cron secret -----------------------------------------------------------------
-- Generated in the database so it never appears in the repo. The cron job reads
-- it from Vault; the edge function checks it via verify_reminder_cron_secret().
-- Rotate with: select vault.update_secret(
--   (select id from vault.secrets where name = 'send_reminders_cron_secret'),
--   encode(extensions.gen_random_bytes(32), 'hex'));
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'send_reminders_cron_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'send_reminders_cron_secret',
      'Shared secret the send-reminders cron job sends as x-cron-secret'
    );
  end if;
end $$;

create or replace function public.verify_reminder_cron_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select decrypted_secret = p_secret
       from vault.decrypted_secrets
      where name = 'send_reminders_cron_secret'
        and coalesce(p_secret, '') <> ''),
    false);
$$;

revoke all on function public.verify_reminder_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_reminder_cron_secret(text) to service_role;

-- Run log ---------------------------------------------------------------------
create table if not exists ops.reminder_runs (
  id        bigint generated always as identity primary key,
  ran_at    timestamptz not null default now(),
  ok        boolean not null,
  processed integer not null default 0,
  sent      integer not null default 0,
  failed    integer not null default 0,
  pruned    integer not null default 0,
  error     text
);

create index if not exists reminder_runs_ran_at_idx on ops.reminder_runs (ran_at desc);

create or replace function public.log_reminder_run(
  p_ok boolean,
  p_processed integer default 0,
  p_sent integer default 0,
  p_failed integer default 0,
  p_pruned integer default 0,
  p_error text default null
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into ops.reminder_runs (ok, processed, sent, failed, pruned, error)
  values (p_ok, p_processed, p_sent, p_failed, p_pruned, left(p_error, 2000));
$$;

revoke all on function public.log_reminder_run(boolean, integer, integer, integer, integer, text) from public, anon, authenticated;
grant execute on function public.log_reminder_run(boolean, integer, integer, integer, integer, text) to service_role;

-- Health check ----------------------------------------------------------------
-- Returns null when healthy, otherwise one line per problem. pg_net only
-- queues the HTTP call, so a cron run "succeeds" even when the function returns
-- 401/500; the function's own run log is what proves reminders are going out.
create or replace function ops.cron_health_report(p_window interval default interval '24 hours')
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_problems text[] := '{}';
  v_row record;
  v_last_ok timestamptz;
begin
  for v_row in
    select j.jobname,
           count(*) as n,
           (array_agg(left(d.return_message, 200) order by d.start_time desc))[1] as last_msg
      from cron.job_run_details d
      join cron.job j on j.jobid = d.jobid
     where d.status = 'failed'
       and d.start_time > now() - p_window
       and j.jobname <> 'cron-failure-check'
     group by j.jobname
  loop
    v_problems := v_problems || format('cron job %s: %s failed run(s); latest: %s',
                                       v_row.jobname, v_row.n, v_row.last_msg);
  end loop;

  select max(ran_at) into v_last_ok from ops.reminder_runs where ok;
  if v_last_ok is null or v_last_ok < now() - interval '30 minutes' then
    v_problems := v_problems || format('send-reminders: no successful function run since %s',
                                       coalesce(v_last_ok::text, 'ever'));
  end if;

  for v_row in
    select count(*) as n,
           (array_agg(error order by ran_at desc))[1] as last_error
      from ops.reminder_runs
     where not ok
       and ran_at > now() - p_window
    having count(*) > 0
  loop
    v_problems := v_problems || format('send-reminders: %s failed function run(s); latest: %s',
                                       v_row.n, v_row.last_error);
  end loop;

  if cardinality(v_problems) = 0 then
    return null;
  end if;
  return array_to_string(v_problems, E'\n');
end;
$$;

-- A procedure (not a function) so the alert POST is committed before the
-- exception marks this cron run as failed in the dashboard. Transaction
-- control is why it can't be SECURITY DEFINER or carry a SET clause.
create or replace procedure ops.run_cron_health_check()
language plpgsql
as $$
declare
  v_report text := ops.cron_health_report();
  v_webhook text;
  v_message text;
begin
  if v_report is null then
    return;
  end if;

  -- Optional: a Slack- or Discord-compatible incoming webhook URL stored in
  -- Vault under this name. Without it, the failed run in cron history is the
  -- only signal.
  select decrypted_secret into v_webhook
    from vault.decrypted_secrets
   where name = 'ops_alert_webhook_url';

  if v_webhook is not null then
    v_message := 'CacheNotes cron health check failed:' || E'\n' || v_report;
    perform net.http_post(
      url     := v_webhook,
      body    := jsonb_build_object('text', v_message, 'content', left(v_message, 1900)),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
    commit;
  end if;

  raise exception 'cron health check failed: %', v_report;
end;
$$;

revoke all on function ops.cron_health_report(interval) from public;
revoke all on procedure ops.run_cron_health_check() from public;

-- Schedules -------------------------------------------------------------------
select cron.schedule(
  'cron-log-purge',
  '17 3 * * *',
  $$
    delete from cron.job_run_details where end_time < now() - interval '7 days';
    delete from ops.reminder_runs where ran_at < now() - interval '30 days';
  $$
);

select cron.schedule(
  'cron-failure-check',
  '0 8 * * *',
  $$ call ops.run_cron_health_check() $$
);

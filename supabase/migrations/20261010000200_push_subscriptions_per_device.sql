-- One push subscription per device (browser endpoint) instead of one per user:
-- with UNIQUE (user_id), subscribing on a phone silently replaced the laptop.
-- Step 1 of 2, backward compatible with clients that still upsert on user_id.
-- UNIQUE (user_id) is dropped in 20261010000400, once the web client that
-- calls register_push_subscription is deployed.

-- Keep the newest row per endpoint so the unique constraint can be added.
delete from public.push_subscriptions a
  using public.push_subscriptions b
  where a.endpoint = b.endpoint
    and (a.created_at, a.id) < (b.created_at, b.id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.push_subscriptions'::regclass
      and conname = 'push_subscriptions_endpoint_key'
  ) then
    alter table public.push_subscriptions
      add constraint push_subscriptions_endpoint_key unique (endpoint);
  end if;
end $$;

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

-- A device's endpoint belongs to whoever signed in on it most recently. A plain
-- client upsert can't take over a row owned by another user (RLS hides it), so
-- the second account on a shared browser would fail to subscribe while the
-- first kept receiving reminders there. This claims the endpoint for the caller.
create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh_key text,
  p_auth_key text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if coalesce(p_endpoint, '') = '' or coalesce(p_p256dh_key, '') = '' or coalesce(p_auth_key, '') = '' then
    raise exception 'endpoint and keys are required' using errcode = '22023';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh_key, auth_key)
  values (v_uid, p_endpoint, p_p256dh_key, p_auth_key)
  on conflict (endpoint) do update
    set user_id    = excluded.user_id,
        p256dh_key = excluded.p256dh_key,
        auth_key   = excluded.auth_key,
        created_at = now();
end;
$$;

revoke all on function public.register_push_subscription(text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text) to authenticated;

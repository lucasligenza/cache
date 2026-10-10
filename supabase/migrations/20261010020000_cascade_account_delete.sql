-- Production notes.user_id and categories.user_id reference auth.users(id)
-- with the default NO ACTION (no ON DELETE CASCADE). Deleting an auth user
-- then fails while those rows exist. push_subscriptions.user_id already
-- cascades; this migration makes all three match.
--
-- The delete-account edge function still removes the rows itself, so account
-- deletion works even if this migration has not been applied yet. Applying
-- it means a dashboard user-delete also removes the rows instead of erroring.
--
-- NOT APPLIED to production. Lucas reviews and applies this.
-- Idempotent: a database built from the baseline (already CASCADE) is a no-op.

do $$
declare
  tbl text;
  rec record;
  tables text[] := array['notes', 'categories', 'push_subscriptions'];
begin
  foreach tbl in array tables loop
    for rec in
      select c.conname
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid
       and a.attnum = any (c.conkey)
      where c.conrelid = format('public.%I', tbl)::regclass
        and c.contype = 'f'
        and a.attname = 'user_id'
        and c.confdeltype <> 'c' -- 'c' = ON DELETE CASCADE
    loop
      execute format('alter table public.%I drop constraint %I', tbl, rec.conname);
    end loop;

    if not exists (
      select 1
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid
       and a.attnum = any (c.conkey)
      where c.conrelid = format('public.%I', tbl)::regclass
        and c.contype = 'f'
        and a.attname = 'user_id'
        and c.confdeltype = 'c'
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (user_id) references auth.users(id) on delete cascade',
        tbl,
        tbl || '_user_id_fkey'
      );
    end if;
  end loop;
end $$;

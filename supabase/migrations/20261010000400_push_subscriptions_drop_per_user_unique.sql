-- Step 2 of 2 of per-device push subscriptions (see 20261010000200).
-- Apply to prod only after the web client that registers through
-- register_push_subscription is live: older clients upsert with
-- onConflict 'user_id', which errors once this constraint is gone.
alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_user_id_key;

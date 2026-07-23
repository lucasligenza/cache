import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
const vapidSubject = Deno.env.get('VAPID_SUBJECT')!;

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async () => {
  const nowIso = new Date().toISOString();

  // Every past-due reminder — NOT a 5-minute window. Querying `remind_at <= now`
  // means a missed/failed cron run never silently drops a reminder (the old
  // `remind_at BETWEEN now AND now+5min` lost anything whose window slipped).
  const { data: notes, error: notesError } = await supabase
    .from('notes')
    .select('id, text, user_id, remind_at, reminded_at')
    .is('archived_at', null)
    .not('remind_at', 'is', null)
    .lte('remind_at', nowIso);

  if (notesError) {
    return new Response(JSON.stringify({ error: notesError.message }), { status: 500 });
  }

  // Dedupe: only notes not yet notified for their CURRENT remind_at. Rescheduling
  // (a newer remind_at) makes reminded_at stale again and re-arms the reminder.
  // (Column-to-column comparison isn't expressible in a PostgREST filter, so it's
  // done here — the due set is tiny.)
  const due = (notes ?? []).filter(
    n => !n.reminded_at || new Date(n.reminded_at).getTime() < new Date(n.remind_at).getTime()
  );

  if (due.length === 0) {
    return new Response(JSON.stringify({ sent: 0, processed: 0 }), { status: 200 });
  }

  let sent = 0;
  for (const note of due) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh_key, auth_key')
      .eq('user_id', note.user_id);

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
          JSON.stringify({ title: 'cache reminder', body: note.text.slice(0, 100) })
        );
        sent++;
      } catch (err) {
        console.error('Push failed:', err);
      }
    }
  }

  // Stamp every processed reminder so it fires at most once per remind_at. Marked
  // regardless of delivery outcome — the note still surfaces as overdue in-app, so
  // a user with no push subscription (or a transient send failure) isn't left in a
  // loop of retries, and can still act on it in the review view.
  const dueIds = due.map(n => n.id);
  const { error: markError } = await supabase
    .from('notes')
    .update({ reminded_at: nowIso })
    .in('id', dueIds);
  if (markError) console.error('Failed to mark reminded_at:', markError);

  return new Response(JSON.stringify({ sent, processed: due.length }), { status: 200 });
});

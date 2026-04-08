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
  // Find notes with remind_at in the next 5 minutes
  const now = new Date();
  const soon = new Date(now.getTime() + 5 * 60 * 1000);

  const { data: notes, error: notesError } = await supabase
    .from('notes')
    .select('id, text, user_id')
    .gte('remind_at', now.toISOString())
    .lte('remind_at', soon.toISOString());

  if (notesError) {
    return new Response(JSON.stringify({ error: notesError.message }), { status: 500 });
  }

  if (!notes || notes.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  let sent = 0;
  for (const note of notes) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh_key, auth_key')
      .eq('user_id', note.user_id);

    if (!subs || subs.length === 0) continue;

    for (const sub of subs) {
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

  return new Response(JSON.stringify({ sent }), { status: 200 });
});

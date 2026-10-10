import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import webpush from 'npm:web-push@3.6.7';
import {
  selectDue,
  reminderPayload,
  dueUserIds,
  groupByUser,
  isGonePushError,
  type ReminderRow,
  type SubscriptionRow,
} from './due.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface RunResult {
  processed: number;
  sent: number;
  failed: number;
  pruned: number;
}

// Configured on first send rather than at module load, so missing VAPID secrets
// fail a run that actually has pushes to send (and get logged + alerted) instead
// of crashing every invocation at boot.
let vapidConfigured = false;
function configureVapid(): void {
  if (vapidConfigured) return;
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT');
  if (!publicKey || !privateKey || !subject) {
    throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT secrets are not set');
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function isAuthorized(req: Request): Promise<boolean> {
  const secret = req.headers.get('x-cron-secret');
  if (!secret) return false;
  const { data, error } = await supabase.rpc('verify_reminder_cron_secret', { p_secret: secret });
  if (error) throw new Error(`cron secret check failed: ${error.message}`);
  return data === true;
}

async function logRun(ok: boolean, result: RunResult, error?: string): Promise<void> {
  const { error: logError } = await supabase.rpc('log_reminder_run', {
    p_ok: ok,
    p_processed: result.processed,
    p_sent: result.sent,
    p_failed: result.failed,
    p_pruned: result.pruned,
    p_error: error ?? null,
  });
  if (logError) console.error('Failed to log reminder run:', logError.message);
}

async function sendDueReminders(): Promise<RunResult> {
  const nowIso = new Date().toISOString();

  // Every past-due reminder — NOT a 5-minute window. Querying `remind_at <= now`
  // means a missed/failed cron run never silently drops a reminder.
  const { data: notes, error: notesError } = await supabase
    .from('notes')
    .select('id, text, user_id, remind_at, reminded_at')
    .is('archived_at', null)
    .not('remind_at', 'is', null)
    .lte('remind_at', nowIso);
  if (notesError) throw new Error(`notes query failed: ${notesError.message}`);

  // Dedupe + past-due cutoff live in selectDue (pure, unit-tested in due.test.ts).
  // Column-to-column comparison isn't expressible in a PostgREST filter, so the
  // dedup is done here — the due set is tiny.
  const due = selectDue((notes ?? []) as ReminderRow[], nowIso);
  const result: RunResult = { processed: due.length, sent: 0, failed: 0, pruned: 0 };
  if (due.length === 0) return result;

  // A failed lookup throws before reminded_at is stamped, so the next run retries.
  const { data: subs, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh_key, auth_key')
    .in('user_id', dueUserIds(due));
  if (subsError) throw new Error(`push_subscriptions query failed: ${subsError.message}`);

  const subsByUser = groupByUser((subs ?? []) as SubscriptionRow[]);
  const deliveries = due.flatMap(note => (subsByUser.get(note.user_id) ?? []).map(sub => ({ note, sub })));
  if (deliveries.length > 0) configureVapid();

  const gone = new Set<string>();
  await Promise.all(
    deliveries.map(async ({ note, sub }) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
          reminderPayload(note),
        );
        result.sent++;
      } catch (err) {
        if (isGonePushError(err)) {
          gone.add(sub.endpoint);
        } else {
          result.failed++;
          console.error('Push failed:', err);
        }
      }
    }),
  );

  if (gone.size > 0) {
    const { error: pruneError } = await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', [...gone]);
    if (pruneError) console.error('Failed to prune dead subscriptions:', pruneError.message);
    else result.pruned = gone.size;
  }

  // Stamp every processed reminder so it fires at most once per remind_at. Marked
  // regardless of delivery outcome — the note still surfaces as overdue in-app, so
  // a user with no push subscription (or a transient send failure) isn't left in a
  // loop of retries, and can still act on it in the review view.
  const { error: markError } = await supabase
    .from('notes')
    .update({ reminded_at: nowIso })
    .in('id', due.map(n => n.id));
  if (markError) throw new Error(`failed to mark reminded_at: ${markError.message}`);

  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    if (!(await isAuthorized(req))) return json({ error: 'unauthorized' }, 401);
  } catch (err) {
    console.error(err);
    return json({ error: 'authorization check failed' }, 500);
  }

  try {
    const result = await sendDueReminders();
    await logRun(true, result);
    return json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('send-reminders failed:', message);
    await logRun(false, { processed: 0, sent: 0, failed: 0, pruned: 0 }, message);
    return json({ error: message }, 500);
  }
});

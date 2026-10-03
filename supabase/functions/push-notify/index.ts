// ============================================================
// Watchtower edge function: push-notify
// Delivers Web Push notifications to registered devices in the
// caller's organization. Chat messages skip the sender's own devices;
// attention/safety alerts skip only the single device that raised
// them (via exclude_endpoint) so the person at risk is still alerted.
// Optional profile_ids targets specific members (check-ins).
// Every recipient's notification_prefs are honoured: categories,
// minimum severity, vibration pattern. Check-ins and criticals are
// never dropped — a muted category only makes a critical silent.
//
// Deploy: Supabase Dashboard → Edge Functions → New function
//   name: push-notify → paste this file → Deploy
// Secret: VAPID_KEYS_JSON = the JSON keypair (provided separately)
// ============================================================

import * as webpush from 'jsr:@negrel/webpush';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

// Mirrors src/lib/notifyPrefs.js — keep the two in step.
const VIBRATE: Record<string, number[]> = {
  standard: [200, 100, 200, 100, 400],
  siren: [600, 150, 600, 150, 600],
  chime: [150, 80, 150],
  pulse: [80, 60, 80, 60, 80, 60, 80],
  vibrate: [300, 120, 300],
};
const RANK: Record<string, number> = { info: 0, warning: 1, critical: 2 };
const LEVEL_MIN: Record<string, number> = { all: 0, warnings: 1, critical: 2 };
type Prefs = { categories?: Record<string, boolean>; level?: string; sound?: string };
const shouldDeliver = (prefs: Prefs, category: string, severity: string) => {
  if (category === 'checkin') return { deliver: true, silent: false };
  const enabled = prefs?.categories?.[category] !== false;
  if (severity === 'critical') return { deliver: true, silent: !enabled };
  if (!enabled) return { deliver: false, silent: true };
  if ((RANK[severity] ?? 0) < (LEVEL_MIN[prefs?.level ?? 'all'] ?? 0)) return { deliver: false, silent: true };
  return { deliver: true, silent: false };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const reqBody = await req.json();
    const { title, body, url, kind, tag, exclude_endpoint, profile_ids } = reqBody;
    const category: string = reqBody.category
      ?? (kind === 'message' ? 'comms' : kind === 'checkin' ? 'checkin' : kind === 'forecast' ? 'briefs' : 'hazard');
    const severity: string = reqBody.severity ?? (kind === 'message' ? 'info' : 'critical');

    const supaUrl = Deno.env.get('SUPABASE_URL');
    const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const vapidJson = Deno.env.get('VAPID_KEYS_JSON');
    if (!supaUrl || !svc) return json({ error: 'missing Supabase env' }, 500);
    if (!vapidJson) return json({ error: 'VAPID_KEYS_JSON secret is not set' }, 500);

    // Caller identity from the verified JWT
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const payload = JSON.parse(atob(jwt.split('.')[1] ?? '') || '{}');
    const uid = payload.sub;
    if (!uid) return json({ error: 'no caller identity' }, 401);

    const q = async (path: string) =>
      (await fetch(`${supaUrl}/rest/v1/${path}`, { headers: { apikey: svc, Authorization: `Bearer ${svc}` } })).json();

    const profs = await q(`profiles?id=eq.${uid}&select=org_id`);
    const orgId = profs?.[0]?.org_id;
    if (!orgId) return json({ error: 'caller has no organization' }, 400);

    // Chat messages: skip the sender's own devices (you don't need a ping
    // for your own words). Everything else (attention/safety alerts): reach
    // EVERY device except the one that raised it — the person at risk is
    // usually the one whose device detected the danger.
    const profileFilter = kind === 'message' ? `&profile_id=neq.${uid}` : '';
    const targetFilter = Array.isArray(profile_ids) && profile_ids.length
      ? `&profile_id=in.(${profile_ids.filter((x: unknown) => typeof x === 'string').join(',')})`
      : '';
    const all = await q(
      `push_subscriptions?org_id=eq.${orgId}${profileFilter}${targetFilter}&select=endpoint,p256dh,auth,profile_id`
    );
    const subs = (Array.isArray(all) ? all : []).filter(
      (s: { endpoint: string }) => s.endpoint !== exclude_endpoint
    );
    if (subs.length === 0) return json({ sent: 0, failed: 0, note: 'no subscribed devices' });

    const prefRows = await q(
      `profiles?org_id=eq.${orgId}&select=id,notification_prefs`
    );
    const prefsOf: Record<string, Prefs> = Object.fromEntries(
      (Array.isArray(prefRows) ? prefRows : []).map((p: { id: string; notification_prefs: Prefs }) => [p.id, p.notification_prefs ?? {}])
    );

    const vapidKeys = await webpush.importVapidKeys(JSON.parse(vapidJson), { extractable: false });
    const appServer = await webpush.ApplicationServer.new({
      contactInformation: 'mailto:jamietxtcal@gmail.com',
      vapidKeys,
    });

    let sent = 0, failed = 0, filtered = 0;
    for (const s of subs) {
      const prefs = prefsOf[s.profile_id] ?? {};
      const { deliver, silent } = shouldDeliver(prefs, category, severity);
      if (!deliver) { filtered++; continue; }
      const sound = prefs.sound ?? 'standard';
      const message = JSON.stringify({ title, body, url, kind, tag, category, severity, silent, sound, vibrate: VIBRATE[sound] ?? VIBRATE.standard });
      try {
        const subscriber = appServer.subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } });
        await subscriber.pushTextMessage(message, {});
        sent++;
      } catch (e) {
        failed++;
        const msg = String(e);
        if (msg.includes('410') || msg.includes('404')) {
          // subscription expired — prune it
          await fetch(`${supaUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, {
            method: 'DELETE',
            headers: { apikey: svc, Authorization: `Bearer ${svc}` },
          });
        }
      }
    }
    return json({ sent, failed, filtered });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

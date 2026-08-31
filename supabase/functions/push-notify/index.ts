// ============================================================
// Watchtower edge function: push-notify
// Delivers Web Push notifications to registered devices in the
// caller's organization. Chat messages skip the sender's own devices;
// attention/safety alerts skip only the single device that raised
// them (via exclude_endpoint) so the person at risk is still alerted.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { title, body, url, kind, tag, exclude_endpoint } = await req.json();
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
    const all = await q(
      `push_subscriptions?org_id=eq.${orgId}${profileFilter}&select=endpoint,p256dh,auth`
    );
    const subs = (Array.isArray(all) ? all : []).filter(
      (s: { endpoint: string }) => s.endpoint !== exclude_endpoint
    );
    if (subs.length === 0) return json({ sent: 0, failed: 0, note: 'no subscribed devices' });

    const vapidKeys = await webpush.importVapidKeys(JSON.parse(vapidJson), { extractable: false });
    const appServer = await webpush.ApplicationServer.new({
      contactInformation: 'mailto:jamietxtcal@gmail.com',
      vapidKeys,
    });

    let sent = 0, failed = 0;
    const message = JSON.stringify({ title, body, url, kind, tag });
    for (const s of subs) {
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
    return json({ sent, failed });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

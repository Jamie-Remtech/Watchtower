// ============================================================
// Watchtower edge function: tower-watchdog
// pg_cron every 10 minutes. If tower-sweep's heartbeat is older than
// 15 minutes (or missing), push every platform owner/staff device —
// at most once an hour while it stays down — and once more when it
// recovers.
// ============================================================

import * as webpush from 'jsr:@negrel/webpush';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

const STALE_MIN = 15;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const supaUrl = Deno.env.get('SUPABASE_URL')!;
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const vapidJson = Deno.env.get('VAPID_KEYS_JSON');
  const H = { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' };
  const q = async (path: string) => (await fetch(`${supaUrl}/rest/v1/${path}`, { headers: H })).json();

  try {
    const hb = (await q('system_heartbeats?name=eq.tower-sweep&select=at,ok,alerted_at'))?.[0];
    const ageMin = hb ? (Date.now() - Date.parse(hb.at)) / 60000 : Infinity;
    const stale = ageMin > STALE_MIN;
    const alertedRecently = hb?.alerted_at && Date.now() - Date.parse(hb.alerted_at) < 3600e3;
    const recovered = !stale && hb?.alerted_at;

    let message: string | null = null;
    if (stale && !alertedRecently) {
      message = JSON.stringify({
        title: '🛑 Watchtower tower is NOT sweeping',
        body: hb ? `Last sweep ${Math.round(ageMin)} min ago — automatic alerts are paused. Check the tower-sweep schedule.`
          : 'No sweep has ever reported in — automatic alerts are not running.',
        url: '/?tab=platform', kind: 'system', tag: 'tower-down', category: 'hazard', severity: 'critical',
        silent: false, sound: 'siren', vibrate: [600, 150, 600, 150, 600],
      });
    } else if (recovered) {
      message = JSON.stringify({
        title: '✅ Watchtower tower is sweeping again',
        body: 'Automatic alerts are back on.', url: '/?tab=platform', kind: 'system', tag: 'tower-down',
        category: 'hazard', severity: 'info', silent: false, sound: 'chime', vibrate: [150, 80, 150],
      });
    }
    if (!message) return json({ stale, age_min: Math.round(ageMin), sent: 0 });
    if (!vapidJson) return json({ error: 'VAPID_KEYS_JSON secret is not set' }, 500);

    const staff: any[] = await q('profiles?platform_role=in.(owner,staff)&select=id');
    const subs: any[] = staff.length
      ? await q(`push_subscriptions?profile_id=in.(${staff.map(s => s.id).join(',')})&select=endpoint,p256dh,auth`)
      : [];
    const vapidKeys = await webpush.importVapidKeys(JSON.parse(vapidJson), { extractable: false });
    const appServer = await webpush.ApplicationServer.new({ contactInformation: 'mailto:jamietxtcal@gmail.com', vapidKeys });
    let sent = 0;
    for (const s of Array.isArray(subs) ? subs : []) {
      try {
        await appServer.subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }).pushTextMessage(message, {});
        sent++;
      } catch { /* expired subscriptions are pruned by push-notify */ }
    }
    await fetch(`${supaUrl}/rest/v1/system_heartbeats?on_conflict=name`, {
      method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(hb
        ? { name: 'tower-sweep', at: hb.at, ok: hb.ok, alerted_at: stale ? new Date().toISOString() : null }
        : { name: 'tower-sweep', at: new Date(0).toISOString(), ok: false, alerted_at: new Date().toISOString() }),
    });
    return json({ stale, recovered: !!recovered, age_min: Math.round(ageMin), sent });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

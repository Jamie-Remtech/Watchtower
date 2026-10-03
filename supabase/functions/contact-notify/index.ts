// ============================================================
// Watchtower edge function: contact-notify
// Called by a database trigger the moment a homepage contact request
// arrives. Pushes it to every platform owner/staff device, then stamps
// notified_at. The caller's input is ignored — the function reads the
// un-notified rows itself, so calling it twice never double-sends.
// ============================================================

import * as webpush from 'jsr:@negrel/webpush';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

const TOPIC: Record<string, string> = {
  access: 'wants access for their team', dispatch: 'wants to connect their dispatch / CAD',
  pricing: 'asks about pricing', other: 'sent a question',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const supaUrl = Deno.env.get('SUPABASE_URL')!;
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const vapidJson = Deno.env.get('VAPID_KEYS_JSON');
  if (!vapidJson) return json({ error: 'VAPID_KEYS_JSON secret is not set' }, 500);
  const H = { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' };
  const q = async (path: string) => (await fetch(`${supaUrl}/rest/v1/${path}`, { headers: H })).json();

  try {
    const fresh: any[] = await q('contact_requests?notified_at=is.null&select=id,name,email,organization,topic,message,created_at&order=created_at&limit=20');
    if (!Array.isArray(fresh) || !fresh.length) return json({ sent: 0, note: 'nothing new' });

    const staff: any[] = await q('profiles?platform_role=in.(owner,staff)&select=id');
    const ids = staff.map(s => s.id);
    const subs: any[] = ids.length
      ? await q(`push_subscriptions?profile_id=in.(${ids.join(',')})&select=endpoint,p256dh,auth`)
      : [];

    const vapidKeys = await webpush.importVapidKeys(JSON.parse(vapidJson), { extractable: false });
    const appServer = await webpush.ApplicationServer.new({ contactInformation: 'mailto:jamietxtcal@gmail.com', vapidKeys });

    let sent = 0, failed = 0;
    for (const r of fresh) {
      const who = r.organization ? `${r.name} (${r.organization})` : r.name;
      const message = JSON.stringify({
        title: `📨 New contact request — ${who}`,
        body: `${who} ${TOPIC[r.topic] ?? TOPIC.other}${r.message ? `: “${String(r.message).slice(0, 140)}”` : ''}`,
        url: '/?tab=platform', kind: 'contact', tag: `contact-${r.id}`,
        category: 'comms', severity: 'warning', silent: false, sound: 'chime', vibrate: [150, 80, 150],
      });
      for (const s of Array.isArray(subs) ? subs : []) {
        try {
          await appServer.subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }).pushTextMessage(message, {});
          sent++;
        } catch (e) {
          failed++;
          const m = String(e);
          if (m.includes('410') || m.includes('404')) {
            await fetch(`${supaUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE', headers: H });
          }
        }
      }
    }
    await fetch(`${supaUrl}/rest/v1/contact_requests?id=in.(${fresh.map(r => r.id).join(',')})`, {
      method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ notified_at: new Date().toISOString() }),
    });
    return json({ requests: fresh.length, devices: subs.length, sent, failed });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

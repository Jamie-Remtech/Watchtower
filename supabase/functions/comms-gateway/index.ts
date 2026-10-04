// ============================================================
// Watchtower edge function: comms-gateway   (deploy with JWT verification OFF)
// The door for outside systems — each request names its connector (?c=<id>)
// and proves itself the way that system can:
//   generic webhook  POST JSON {text, from?, lat?, lng?}   header x-watchtower-key (or ?key=)
//   Twilio SMS / WhatsApp  POST form, X-Twilio-Signature checked with the company's auth token
//   Telegram         POST update, X-Telegram-Bot-Api-Secret-Token checked
//   CAP feed         GET ?cap=<connector id>&key=<feed key>[&id=<broadcast>]  → CAP 1.2 XML
// Inbound text lands in the connector's channel, matched to a contact when
// the number/address is known; "OK" replies acknowledge the latest broadcast.
// ============================================================
import * as webpush from 'jsr:@negrel/webpush';

const SUPA = Deno.env.get('SUPABASE_URL')!;
const SVC = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const H = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' };
const q = async (path: string): Promise<any> => (await fetch(`${SUPA}/rest/v1/${path}`, { headers: H })).json();
const post = (table: string, body: unknown, ret = false) => fetch(`${SUPA}/rest/v1/${table}`, { method: 'POST', headers: { ...H, Prefer: ret ? 'return=representation' : 'return=minimal' }, body: JSON.stringify(body) });
const patch = (path: string, body: unknown) => fetch(`${SUPA}/rest/v1/${path}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body) });

type Row = Record<string, any>;
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
async function hmacSha1B64(key: string, data: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)))));
}
const safeEq = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const digits = (s: string) => String(s ?? '').replace(/\D/g, '').slice(-10);
const xml = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = (b: string, status = 200, type = 'text/plain') => new Response(b, { status, headers: { 'content-type': `${type}; charset=utf-8`, 'Access-Control-Allow-Origin': '*' } });
const ACK = /^\s*(ok|okay|ack|yes|y|oui|si|sí|copy|copied|received|reçu|recu|roger|10-4|👍)\b/i;

async function findContact(orgId: string, from: string, field: 'phone' | 'email' | 'telegram') {
  const all: Row[] = await q(`contacts?org_id=eq.${orgId}&select=id,name,agency,phone,whatsapp,email,telegram,vip`);
  if (field === 'phone') { const d = digits(from); return d.length >= 7 ? all.find(c => digits(c.phone) === d || digits(c.whatsapp) === d) ?? null : null; }
  if (field === 'email') return all.find(c => (c.email ?? '').toLowerCase() === from.toLowerCase()) ?? null;
  return all.find(c => (c.telegram ?? '').replace(/^@/, '').toLowerCase() === from.replace(/^@/, '').toLowerCase()) ?? null;
}

async function pushInbound(orgId: string, channelId: string | null, title: string, body: string, vip = false) {
  const vapidJson = Deno.env.get('VAPID_KEYS_JSON');
  if (!vapidJson) return;
  try {
    let minRole = 'field';
    if (channelId) { const [ch] = await q(`channels?id=eq.${channelId}&select=min_role`); minRole = ch?.min_role ?? 'field'; }
    const ladder = ['viewer', 'field', 'operator', 'coordinator', 'admin'];
    const profs: Row[] = await q(`profiles?org_id=eq.${orgId}&select=id,role`);
    const ok = new Set(profs.filter(p => ladder.indexOf(p.role) >= ladder.indexOf(minRole)).map(p => p.id));
    const subs: Row[] = await q(`push_subscriptions?org_id=eq.${orgId}&select=endpoint,p256dh,auth,profile_id`);
    const keys = await webpush.importVapidKeys(JSON.parse(vapidJson), { extractable: false });
    const app = await webpush.ApplicationServer.new({ contactInformation: 'mailto:jamietxtcal@gmail.com', vapidKeys: keys });
    for (const s of subs.filter(s => ok.has(s.profile_id))) {
      try {
        await app.subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }).pushTextMessage(JSON.stringify({
          title, body: body.slice(0, 140), url: '/?tab=comms', kind: 'message', tag: 'comms', category: 'comms', severity: vip ? 'warning' : 'info',
        }), {});
      } catch { /* expired subscription */ }
    }
  } catch { /* push is best effort */ }
}

async function inbound(c: Row, msg: { text: string; from: string; via: string; contact: Row | null; meta?: Row }) {
  const label = msg.contact ? `${msg.contact.name}${msg.contact.agency ? ` (${msg.contact.agency})` : ''}` : msg.from;
  await post('messages', {
    org_id: c.org_id, sender: null, text: msg.text.slice(0, 4000), source: msg.via, external_from: label,
    contact_id: msg.contact?.id ?? null, connector_id: c.id, channel_id: c.inbound_channel ?? null, meta: msg.meta ?? null,
    ...(msg.contact?.vip ? { vip: true, vip_at: new Date().toISOString() } : {}),
  });
  // "OK" from a known contact acknowledges the company's latest active broadcast
  if (msg.contact && ACK.test(msg.text)) {
    const since = new Date(Date.now() - 24 * 3600e3).toISOString();
    const [b] = await q(`broadcasts?org_id=eq.${c.org_id}&status=eq.active&require_ack=eq.true&created_at=gte.${since}&order=created_at.desc&limit=1&select=id`);
    if (b) await post('broadcast_acks', { broadcast_id: b.id, org_id: c.org_id, contact_id: msg.contact.id, via: msg.via, reply: msg.text.slice(0, 200) });
  }
  await post('comms_deliveries', { org_id: c.org_id, connector_id: c.id, ref_type: 'inbound', target: label.slice(0, 200), status: 'received', detail: msg.text.slice(0, 120) });
  await patch(`connectors?id=eq.${c.id}`, { last_ok_at: new Date().toISOString() });
  await pushInbound(c.org_id, c.inbound_channel ?? null, `${msg.contact?.vip ? '⭐ VIP · ' : ''}${label} (${msg.via})`, msg.text, !!msg.contact?.vip);
}

function capAlert(b: Row, org: Row, base: string) {
  const sev = b.severity === 'emergency' ? 'Extreme' : b.severity === 'urgent' ? 'Severe' : 'Minor';
  const urg = b.severity === 'info' ? 'Expected' : 'Immediate';
  const sent = new Date(b.created_at).toISOString().replace(/\.\d{3}Z$/, '+00:00');
  const area = b.lat != null ? `<area><areaDesc>${xml(org.name)} operation area</areaDesc><circle>${Number(b.lat).toFixed(5)},${Number(b.lng).toFixed(5)} 5</circle></area>` : `<area><areaDesc>${xml(org.name)} operation area</areaDesc></area>`;
  return `<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2"><identifier>watchtower-${b.id}</identifier><sender>${xml(base)}</sender><sent>${sent}</sent><status>Actual</status><msgType>${b.status === 'closed' ? 'Cancel' : 'Alert'}</msgType><scope>Public</scope><info><language>en</language><category>Safety</category><event>${xml(b.title)}</event><urgency>${urg}</urgency><severity>${sev}</severity><certainty>Observed</certainty><senderName>${xml(org.name)}</senderName><headline>${xml(b.title)}</headline><description>${xml(b.body ?? b.title)}</description>${area}</info></alert>`;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-watchtower-key' } });
  try {
    // ---------- CAP feed ----------
    if (req.method === 'GET' && url.searchParams.get('cap')) {
      const [c] = await q(`connectors?id=eq.${encodeURIComponent(url.searchParams.get('cap')!)}&kind=eq.cap&enabled=eq.true&select=*`);
      const key = url.searchParams.get('key') ?? '';
      if (!c || !c.inbound_key_hash || !safeEq(await sha256(key), c.inbound_key_hash)) return text('not found', 404);
      const [org] = await q(`organizations?id=eq.${c.org_id}&select=name`);
      const base = `${SUPA}/functions/v1/comms-gateway`;
      const one = url.searchParams.get('id');
      const since = new Date(Date.now() - (Number(c.config?.hours) || 48) * 3600e3).toISOString();
      const list: Row[] = await q(`broadcasts?org_id=eq.${c.org_id}${one ? `&id=eq.${encodeURIComponent(one)}` : `&created_at=gte.${since}`}&order=created_at.desc&limit=50&select=*`);
      if (one) return list[0] ? text(`<?xml version="1.0" encoding="UTF-8"?>${capAlert(list[0], org, base)}`, 200, 'application/cap+xml') : text('not found', 404);
      const self = `${base}?cap=${c.id}&key=${encodeURIComponent(key)}`;
      const entries = list.map(b => `<entry><id>urn:watchtower:${b.id}</id><title>${xml(b.title)}</title><updated>${new Date(b.closed_at ?? b.created_at).toISOString()}</updated><link rel="alternate" type="application/cap+xml" href="${xml(`${self}&id=${b.id}`)}"/><summary>${xml(b.body ?? '')}</summary><content type="text/xml">${capAlert(b, org, base)}</content></entry>`).join('');
      return text(`<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><id>urn:watchtower:${c.id}</id><title>${xml(org?.name)} — Watchtower alerts</title><updated>${new Date().toISOString()}</updated><link rel="self" href="${xml(self)}"/>${entries}</feed>`, 200, 'application/atom+xml');
    }

    if (req.method !== 'POST') return text('method not allowed', 405);
    const cid = url.searchParams.get('c');
    if (!cid) return text('connector missing', 400);
    const [c] = await q(`connectors?id=eq.${encodeURIComponent(cid)}&enabled=eq.true&select=*`);
    if (!c || !c.inbound_enabled) return text('not found', 404);
    const [sec] = await q(`connector_secrets?connector_id=eq.${c.id}&select=secret`);
    const secret = sec?.secret ?? {};
    const raw = await req.text();

    // ---------- Twilio SMS / WhatsApp ----------
    if (c.kind === 'twilio_sms' || c.kind === 'twilio_whatsapp') {
      const params = Object.fromEntries(new URLSearchParams(raw));
      const sig = req.headers.get('X-Twilio-Signature') ?? '';
      const publicUrl = `${SUPA}/functions/v1/comms-gateway${url.search}`;
      const expected = await hmacSha1B64(secret.auth_token ?? '', publicUrl + Object.keys(params).sort().map(k => k + params[k]).join(''));
      if (!secret.auth_token || !safeEq(sig, expected)) return text('bad signature', 403);
      const from = String(params.From ?? '').replace(/^whatsapp:/, '');
      const body = String(params.Body ?? '').trim();
      const media = Number(params.NumMedia ?? 0) > 0 ? { media: params.MediaUrl0, media_type: params.MediaContentType0 } : undefined;
      if (body || media) await inbound(c, { text: body || '📎', from, via: c.kind === 'twilio_whatsapp' ? 'whatsapp' : 'sms', contact: await findContact(c.org_id, from, 'phone'), meta: media });
      return text('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', 200, 'text/xml');
    }

    // ---------- Telegram ----------
    if (c.kind === 'telegram') {
      const want = secret.bot_token ? (await sha256(`${secret.bot_token}:${c.id}`)).slice(0, 64) : '';
      if (!want || !safeEq(req.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '', want)) return text('forbidden', 403);
      const u = JSON.parse(raw || '{}');
      const m = u.message ?? u.channel_post;
      if (m?.text && String(m.chat?.id) === String(c.config?.chat_id ?? m.chat?.id)) {
        const who = m.from ? [m.from.first_name, m.from.last_name].filter(Boolean).join(' ') || m.from.username : m.chat?.title ?? 'Telegram';
        await inbound(c, { text: m.text, from: who, via: 'telegram', contact: m.from?.username ? await findContact(c.org_id, m.from.username, 'telegram') : null });
      }
      return text('ok');
    }

    // ---------- generic webhook (radio/dispatch gateways, CAD, anything) ----------
    const key = req.headers.get('x-watchtower-key') ?? url.searchParams.get('key') ?? '';
    if (!c.inbound_key_hash || !safeEq(await sha256(key), c.inbound_key_hash)) return text('bad key', 401);
    let body: Row = {};
    const ct = req.headers.get('content-type') ?? '';
    if (ct.includes('json')) { try { body = JSON.parse(raw); } catch { return text('invalid JSON', 400); } }
    else if (ct.includes('form')) body = Object.fromEntries(new URLSearchParams(raw));
    else body = { text: raw };
    const msg = String(body.text ?? body.message ?? body.body ?? '').trim();
    if (!msg) return text('text is required', 400);
    const from = String(body.from ?? body.sender ?? body.unit ?? c.name).slice(0, 120);
    const lat = Number(body.lat ?? body.latitude), lng = Number(body.lng ?? body.lon ?? body.longitude);
    const meta = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
    const contact = body.from ? (await findContact(c.org_id, from, from.includes('@') ? 'email' : 'phone')) : null;
    await inbound(c, { text: msg, from, via: c.config?.source === 'radio' ? 'radio' : 'webhook', contact, meta });
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return text(String(e), 500);
  }
});

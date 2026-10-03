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

// Push texts in each recipient's language: per-company cache first
// (same table the app uses), then one Claude call per language.
const fnv = (s: string) => {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < s.length; i++) { h ^= BigInt(s.charCodeAt(i)); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; }
  return h.toString(16);
};
const trCache = new Map<string, string>();
async function translateTexts(texts: string[], lang: string, orgId: string, supaUrl: string, svc: string): Promise<string[]> {
  if (!lang || lang === 'en') return texts;
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  const out = [...texts];
  const todo: number[] = [];
  texts.forEach((t, i) => { const k = `${orgId}|${lang}|${fnv(t)}`; if (trCache.has(k)) out[i] = trCache.get(k)!; else todo.push(i); });
  if (!todo.length) return out;
  const hashes = todo.map(i => fnv(texts[i]));
  try {
    const rows = await (await fetch(`${supaUrl}/rest/v1/translations?org_id=eq.${orgId}&lang=eq.${lang}&src_hash=in.(${hashes.join(',')})&select=src_hash,text`, {
      headers: { apikey: svc, Authorization: `Bearer ${svc}` },
    })).json();
    for (const r of Array.isArray(rows) ? rows : []) trCache.set(`${orgId}|${lang}|${r.src_hash}`, r.text);
  } catch { /* cache unavailable */ }
  const missing = todo.filter(i => !trCache.has(`${orgId}|${lang}|${fnv(texts[i])}`));
  if (missing.length && key) {
    try {
      const list = missing.map(i => texts[i]);
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-5', max_tokens: 1500,
          messages: [{ role: 'user', content: `Translate each item of this JSON array into the language with code "${lang}". Emergency-responder alerts: be faithful and terse; keep numbers, units, times, place names and people's names exactly. Respond with STRICT JSON only: {"translations":[...]} same length and order.\n\n${JSON.stringify(list)}` }],
        }),
      });
      const data = await r.json();
      const txt = (data?.content ?? []).filter((c: { text?: string }) => typeof c.text === 'string').map((c: { text: string }) => c.text).join('');
      const m = txt.replace(/```(?:json)?/gi, '').match(/\{[\s\S]*\}/);
      const tr = m ? JSON.parse(m[0]).translations : null;
      if (Array.isArray(tr) && tr.length === list.length) {
        const rows = missing.map((i, j) => {
          trCache.set(`${orgId}|${lang}|${fnv(texts[i])}`, String(tr[j]));
          return { org_id: orgId, src_hash: fnv(texts[i]), lang, text: String(tr[j]) };
        });
        await fetch(`${supaUrl}/rest/v1/translations`, {
          method: 'POST',
          headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify(rows),
        });
      }
    } catch { /* translation unavailable — originals go out */ }
  }
  todo.forEach(i => { out[i] = trCache.get(`${orgId}|${lang}|${fnv(texts[i])}`) ?? texts[i]; });
  return out;
}

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
      `profiles?org_id=eq.${orgId}&select=id,notification_prefs,language`
    );
    const prefsOf: Record<string, Prefs> = Object.fromEntries(
      (Array.isArray(prefRows) ? prefRows : []).map((p: { id: string; notification_prefs: Prefs }) => [p.id, p.notification_prefs ?? {}])
    );
    const langOf: Record<string, string> = Object.fromEntries(
      (Array.isArray(prefRows) ? prefRows : []).map((p: { id: string; language: string | null }) => [p.id, p.language ?? 'en'])
    );
    // Translate title + body once per recipient language
    const textsByLang: Record<string, string[]> = {};
    for (const lang of new Set(subs.map((s: { profile_id: string }) => langOf[s.profile_id] ?? 'en'))) {
      textsByLang[lang] = await translateTexts([String(title ?? ''), String(body ?? '')], lang, orgId, supaUrl, svc);
    }

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
      const [tTitle, tBody] = textsByLang[langOf[s.profile_id] ?? 'en'] ?? [title, body];
      const message = JSON.stringify({ title: tTitle || title, body: tBody || body, url, kind, tag, category, severity, silent, sound, vibrate: VIBRATE[sound] ?? VIBRATE.standard });
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

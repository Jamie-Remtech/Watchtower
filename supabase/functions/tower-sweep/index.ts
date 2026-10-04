// ============================================================
// Watchtower edge function: tower-sweep — the tower never sleeps.
// Runs on a 5-minute cron for EVERY company, no open app required.
// Watches the safety layer around every anchor (fresh crew positions
// + device fleet): measured radar echoes, rain nowcast, earthquakes,
// wildfires. Raises attention items (same dedupe keys as the in-app
// sweep, so the two cooperate) and pushes critical ones to pockets.
//
// Deploy: Supabase Dashboard → Edge Functions → New function
//   name: tower-sweep → paste this file → Deploy
// Secrets used: VAPID_KEYS_JSON (already set for push-notify)
// Schedule (SQL Editor, after enabling pg_cron + pg_net):
//   see the cron block provided in chat / README.
// ============================================================

import * as webpush from 'jsr:@negrel/webpush';
import UPNG from 'npm:upng-js@2.1.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

const WX_CODES: Record<number, string> = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Icy fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Heavy freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Showers', 82: 'Violent showers', 85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorms', 96: 'Thunderstorms w/ hail', 99: 'Severe thunderstorms w/ hail',
};
const DAY_WORD = (i: number, dateStr: string) =>
  i === 0 ? 'today' : i === 1 ? 'tomorrow' : new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-CA', { weekday: 'long' });

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
const ROLE_ORDER = ['viewer', 'field', 'operator', 'coordinator', 'admin'];

const KM = 6371;
const haversine = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * KM * Math.asin(Math.sqrt(s));
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

// RainViewer "Universal Blue" (colour scheme 2) — the only scheme the API
// serves since 2026-01-01. Generated from rainviewer.com/files/rainviewer_api_colors_table.csv.
// Each entry: [rgb, alpha, dBZ, snow]. Several dBZ share a colour; lookups
// keep the LOWEST dBZ for a colour so readings are never overstated.
const RV_PALETTE = [[6512985,20,-10,0],[6710106,25,-9,0],[6907484,30,-8,0],[7104605,36,-7,0],[7301983,41,-6,0],[7499361,46,-5,0],[7696482,52,-4,0],[7893860,57,-3,0],[8156517,62,-2,0],[8353895,68,-1,0],[8551273,73,0,0],[8748394,78,1,0],[8945772,84,2,0],[9142893,89,3,0],[9340271,94,4,0],[9603185,100,5,0],[10392437,110,6,0],[11181689,120,7,0],[11970942,130,8,0],[12760194,140,9,0],[13549703,150,10,0],[13812875,160,11,0],[14076047,170,12,0],[14339219,180,13,0],[14602391,190,14,0],[8969710,255,15,0],[7131627,255,16,0],[5359080,255,17,0],[3586789,255,18,0],[1814242,255,19,0],[41952,255,20,0],[39637,255,21,0],[37322,255,22,0],[35007,255,23,0],[32692,255,24,0],[30634,255,25,0],[28835,255,26,0],[27036,255,27,0],[25237,255,28,0],[23438,255,29,0],[21896,255,30,0],[20864,255,31,0],[20088,255,32,0],[19056,255,33,0],[18280,255,34,0],[16772608,255,35,0],[16769024,255,36,0],[16765440,255,37,0],[16762112,255,38,0],[16758528,255,39,0],[16755200,255,40,0],[16752384,255,41,0],[16749824,255,42,0],[16747264,255,43,0],[16744704,255,44,0],[16729088,255,45,0],[15873536,255,46,0],[15083520,255,47,0],[14228224,255,48,0],[13438208,255,49,0],[12648448,255,50,0],[11010048,255,51,0],[9371648,255,52,0],[7733248,255,53,0],[6094848,255,54,0],[16755455,255,55,0],[16752639,255,56,0],[16750079,255,57,0],[16747519,255,58,0],[16744959,255,59,0],[16742399,255,60,0],[16739583,255,61,0],[16737023,255,62,0],[16734463,255,63,0],[16731903,255,64,0],[16777215,255,65,0],[16777215,255,66,0],[16777215,255,67,0],[16777215,255,68,0],[16777215,255,69,0],[16777215,255,70,0],[16777215,255,71,0],[16777215,255,72,0],[16777215,255,73,0],[16777215,255,74,0],[65280,255,75,0],[65280,255,76,0],[65280,255,77,0],[65280,255,78,0],[65280,255,79,0],[65280,255,80,0],[65280,255,81,0],[65280,255,82,0],[65280,255,83,0],[65280,255,84,0],[65280,255,85,0],[65280,255,86,0],[65280,255,87,0],[65280,255,88,0],[65280,255,89,0],[65280,255,90,0],[65280,255,91,0],[65280,255,92,0],[65280,255,93,0],[65280,255,94,0],[65280,255,95,0],[13565951,12,-9,1],[13500415,25,-8,1],[13434879,38,-7,1],[13369343,51,-6,1],[13369343,63,-5,1],[13303807,76,-4,1],[13238271,89,-3,1],[13172735,102,-2,1],[13107199,114,-1,1],[13107199,127,0,1],[13041663,140,1,1],[12976127,153,2,1],[12910591,165,3,1],[12845055,178,4,1],[12845055,191,5,1],[12779519,204,6,1],[12713983,216,7,1],[12648447,229,8,1],[12582911,242,9,1],[12582911,255,10,1],[12122367,255,11,1],[11727615,255,12,1],[11267071,255,13,1],[10872319,255,14,1],[10477567,255,15,1],[10017023,255,16,1],[9622271,255,17,1],[9161727,255,18,1],[8766975,255,19,1],[8372223,255,20,1],[7911679,255,21,1],[7516927,255,22,1],[7056383,255,23,1],[6661631,255,24,1],[6266879,255,25,1],[6003711,255,26,1],[5806335,255,27,1],[5608959,255,28,1],[5411583,255,29,1],[5214207,255,30,1],[4951039,255,31,1],[4753663,255,32,1],[4556287,255,33,1],[4358911,255,34,1],[4161535,255,35,1],[3898367,255,36,1],[3700991,255,37,1],[3503615,255,38,1],[3306239,255,39,1],[3108863,255,40,1],[2845695,255,41,1],[2648319,255,42,1],[2450943,255,43,1],[2253567,255,44,1],[2056191,255,45,1],[1793023,255,46,1],[1595647,255,47,1],[1398271,255,48,1],[1200895,255,49,1],[1003519,255,50,1],[805887,255,51,1],[608511,255,52,1],[411135,255,53,1],[148223,255,54,1],[16383,255,55,1],[15359,255,56,1],[14591,255,57,1],[13823,255,58,1],[13055,255,59,1],[12287,255,60,1],[11263,255,61,1],[10495,255,62,1],[9727,255,63,1],[8959,255,64,1],[8191,255,65,1],[7167,255,66,1],[6399,255,67,1],[5631,255,68,1],[4863,255,69,1],[4095,255,70,1],[3327,255,71,1],[2559,255,72,1],[1791,255,73,1],[767,255,74,1],[255,255,75,1],[255,255,76,1],[255,255,77,1],[255,255,78,1],[255,255,79,1],[255,255,80,1],[255,255,81,1],[255,255,82,1],[255,255,83,1],[255,255,84,1],[255,255,85,1],[255,255,86,1],[255,255,87,1],[255,255,88,1],[255,255,89,1],[255,255,90,1],[255,255,91,1],[255,255,92,1],[255,255,93,1],[255,255,94,1],[255,255,95,1]];

const exact = new Map();
for (const [rgb, a, dbz, snow] of RV_PALETTE) {
  const k = rgb * 256 + a;
  if (!exact.has(k) || exact.get(k)[0] > dbz) exact.set(k, [dbz, snow]);
}

// dBZ for one RGBA pixel, or null when it is not an echo. Exact palette
// match first; otherwise the nearest colour if it is close (anti-aliasing).
function rvPixelDbz(r: number, g: number, b: number, a: number): number | null {
  if (!a) return null;
  const hit = exact.get(((r << 16) | (g << 8) | b) * 256 + a);
  if (hit) return hit[0];
  let best: number | null = null, bestD = Infinity;
  for (const [rgb, pa, dbz] of RV_PALETTE) {
    const dr = ((rgb >> 16) & 255) - r, dg = ((rgb >> 8) & 255) - g, db = (rgb & 255) - b, da = pa - a;
    const d = dr * dr + dg * dg + db * db + da * da;
    if (d < bestD || (d === bestD && best !== null && dbz < best)) { bestD = d; best = dbz; }
  }
  return bestD <= 40 * 40 ? best : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const supaUrl = Deno.env.get('SUPABASE_URL');
    const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const vapidJson = Deno.env.get('VAPID_KEYS_JSON');
    if (!supaUrl || !svc) return json({ error: 'missing env' }, 500);

    const qErrors: string[] = [];
    const q = async (path: string) => {
      const res = await fetch(`${supaUrl}/rest/v1/${path}`, { headers: { apikey: svc, Authorization: `Bearer ${svc}` } });
      const body = await res.json();
      if (!res.ok || !Array.isArray(body)) {
        qErrors.push(`${path.split('?')[0]}: ${res.status} ${JSON.stringify(body).slice(0, 120)}`);
        return [];
      }
      return body;
    };
    const insert = (path: string, body: unknown) =>
      fetch(`${supaUrl}/rest/v1/${path}`, {
        method: 'POST',
        headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(body),
      });

    // ---------- gather platform state ----------
    const freshCutMs = Date.now() - 15 * 60 * 1000;
    const dayCut = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const [orgs, profiles, positions, devices, existing, subs] = await Promise.all([
      q('organizations?select=id,name,settings'),
      q('profiles?select=id,display_name,org_id,role,team_id,notification_prefs,language'),
      q(`positions?select=profile_id,org_id,lat,lng,at&at=gte.${dayCut}&order=at.desc&limit=2000`),
      q('devices?select=org_id,lat,lng,name'),
      q('attention_items?select=org_id,dedupe_key&status=neq.resolved'),
      q('push_subscriptions?select=org_id,profile_id,endpoint,p256dh,auth'),
    ]);
    const [openCheckins, recentCheckins] = await Promise.all([
      q('checkins?select=id,org_id,team_id,requested_by,created_at,message&status=eq.open'),
      q(`checkins?select=id,org_id,created_at&created_at=gte.${new Date(Date.now() - 30 * 60e3).toISOString()}`),
    ]);
    const openIds = (openCheckins ?? []).map((c: { id: string }) => c.id);
    const checkinResponses = openIds.length
      ? await q(`checkin_responses?select=checkin_id,profile_id&checkin_id=in.(${openIds.join(',')})`)
      : [];
    const prefsOf: Record<string, Prefs> = Object.fromEntries(
      (profiles ?? []).map((p: { id: string; notification_prefs: Prefs }) => [p.id, p.notification_prefs ?? {}])
    );
    const nameOf = Object.fromEntries((profiles ?? []).map((p: { id: string; display_name: string }) => [p.id, p.display_name]));
    const liveKeys = new Set((existing ?? []).map((i: { org_id: string; dedupe_key: string }) => `${i.org_id}|${i.dedupe_key}`));
    const hourBucket = new Date().toISOString().slice(0, 13);

    // Anchors per org: fresh crew positions (latest per person, <15 min)
    // drive the live radar/nowcast checks; the last KNOWN position per
    // person (<48 h) drives daily briefs and the forward outlook — a
    // crew member's phone may sleep, but their environment does not.
    const anchorsByOrg = new Map<string, Array<{ lat: number; lng: number; label: string }>>();
    const peopleByOrg = new Map<string, Array<{ lat: number; lng: number; label: string; profileId: string }>>();
    const seen = new Set<string>();
    for (const p of positions ?? []) {
      if (!p.org_id || seen.has(p.profile_id)) continue;
      seen.add(p.profile_id);
      const label = nameOf[p.profile_id] ?? 'crew member';
      if (new Date(p.at).getTime() >= freshCutMs) {
        const arr = anchorsByOrg.get(p.org_id) ?? [];
        arr.push({ lat: p.lat, lng: p.lng, label });
        anchorsByOrg.set(p.org_id, arr);
      }
      const ppl = peopleByOrg.get(p.org_id) ?? [];
      ppl.push({ lat: p.lat, lng: p.lng, label, profileId: p.profile_id });
      peopleByOrg.set(p.org_id, ppl);
    }
    for (const org of orgs ?? []) {
      const placed = (devices ?? []).filter((d: { org_id: string; lat: number | null }) => d.org_id === org.id && d.lat != null);
      if (placed.length) {
        const arr = anchorsByOrg.get(org.id) ?? [];
        arr.push({
          lat: placed.reduce((a: number, d: { lat: number }) => a + d.lat, 0) / placed.length,
          lng: placed.reduce((a: number, d: { lng: number }) => a + d.lng, 0) / placed.length,
          label: 'device fleet',
        });
        anchorsByOrg.set(org.id, arr);
      }
    }

    // ---------- shared feeds (fetched once for the whole platform) ----------
    let radarMeta: { host: string; frame: { path: string; time: number } } | null = null;
    try {
      const m = await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();
      const frame = m?.radar?.past?.at(-1);
      if (frame) radarMeta = { host: m.host, frame };
    } catch { /* radar down — other checks continue */ }

    let quakes: Array<{ id: string; mag: number; place: string; lat: number; lng: number; tsunami: number; url: string }> = [];
    try {
      const d = await (await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson')).json();
      quakes = (d.features ?? []).map((f: { id: string; properties: { mag: number; place: string; tsunami: number; url: string }; geometry: { coordinates: number[] } }) => ({
        id: f.id, mag: f.properties.mag, place: f.properties.place,
        lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1],
        tsunami: f.properties.tsunami, url: f.properties.url,
      }));
    } catch { /* feed down */ }

    let fires: Array<{ id: string; title: string; lat: number; lng: number }> = [];
    try {
      // Only fires reported in the last 14 days and not planned burns: EONET
      // keeps most US incidents "open" for months after they are out.
      const d = await (await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=wildfires&days=14&limit=500')).json();
      const cutoff = Date.now() - 14 * 86400e3;
      for (const e of d.events ?? []) {
        if (/prescribed|\bRX\b|pile burn/i.test(e.title ?? '')) continue;
        const g = e.geometry?.at(-1);
        if (!g?.date || Date.parse(g.date) < cutoff) continue;
        const c = g?.type === 'Point' ? g.coordinates : g?.coordinates?.[0]?.[0];
        if (Array.isArray(c)) fires.push({ id: e.id, title: e.title, lng: c[0], lat: c[1] });
      }
    } catch { /* feed down */ }

    // Radar tile cache: decode each z7 tile once. Pixels are Universal Blue colours,
    // mapped back to dBZ through RainViewer's own palette (rvPixelDbz).
    const tileCache = new Map<string, Uint8Array | null>();
    const radarDbz = async (a: { lat: number; lng: number }) => {
      if (!radarMeta) return null;
      const z = 7, n = 2 ** z;
      const xf = ((a.lng + 180) / 360) * n;
      const latRad = (a.lat * Math.PI) / 180;
      const yf = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
      const tx = Math.floor(xf), ty = Math.floor(yf);
      const key = `${tx},${ty}`;
      let rgba = tileCache.get(key);
      if (rgba === undefined) {
        try {
          const buf = await (await fetch(`${radarMeta.host}${radarMeta.frame.path}/256/${z}/${tx}/${ty}/2/0_0.png`)).arrayBuffer();
          const png = UPNG.decode(buf);
          rgba = new Uint8Array(UPNG.toRGBA8(png)[0]);
        } catch { rgba = null; }
        tileCache.set(key, rgba);
      }
      if (!rgba) return null;
      const px = Math.floor((xf - tx) * 256), py = Math.floor((yf - ty) * 256);
      let best: number | null = null;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const X = Math.min(255, Math.max(0, px + dx)), Y = Math.min(255, Math.max(0, py + dy));
          const i = (Y * 256 + X) * 4;
          const v = rvPixelDbz(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]);
          if (v != null && (best == null || v > best)) best = v;
        }
      }
      return best;
    };

    // ---------- per-org detection ----------
    type Cand = { dedupe_key: string; severity: string; kind: string; title: string; detail: string; source?: unknown };
    let raised = 0, pushed = 0;
    const appServer = vapidJson
      ? await webpush.ApplicationServer.new({
        contactInformation: 'mailto:jamietxtcal@gmail.com',
        vapidKeys: await webpush.importVapidKeys(JSON.parse(vapidJson), { extractable: false }),
      })
      : null;

    // One sender for every push the tower makes: honours each
    // recipient's preferences, prunes dead subscriptions.
    type Sub = { org_id: string; profile_id: string; endpoint: string; p256dh: string; auth: string };
    const sendTo = async (
      list: Sub[],
      msg: { kind: string; title: string; body: string; url?: string; tag: string },
      category: string,
      severity: string,
    ) => {
      if (!appServer) return;
      const langOf: Record<string, string> = Object.fromEntries(
        (profiles ?? []).map((p: { id: string; language: string | null }) => [p.id, p.language ?? 'en']));
      const byLang: Record<string, string[]> = {};
      for (const sub of list) {
        const lang = langOf[sub.profile_id] ?? 'en';
        if (!byLang[lang]) byLang[lang] = await translateTexts([msg.title, msg.body], lang, sub.org_id, supaUrl, svc);
      }
      for (const sub of list) {
        const prefs = prefsOf[sub.profile_id] ?? {};
        const [tTitle, tBody] = byLang[langOf[sub.profile_id] ?? 'en'] ?? [msg.title, msg.body];
        const { deliver, silent } = shouldDeliver(prefs, category, severity);
        if (!deliver) continue;
        const sound = prefs.sound ?? 'standard';
        const message = JSON.stringify({
          url: '/', ...msg, title: tTitle || msg.title, body: tBody || msg.body,
          category, severity, silent, sound, vibrate: VIBRATE[sound] ?? VIBRATE.standard,
        });
        try {
          await appServer.subscribe({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }).pushTextMessage(message, {});
          pushed++;
        } catch (e) {
          if (String(e).includes('410') || String(e).includes('404')) {
            await fetch(`${supaUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, {
              method: 'DELETE', headers: { apikey: svc, Authorization: `Bearer ${svc}` },
            });
          }
        }
      }
    };
    const subsOfOrg = (orgId: string) => (subs ?? []).filter((x: Sub) => x.org_id === orgId);
    const categoryOf = (c: Cand) =>
      c.kind === 'weather' ? (c.dedupe_key.startsWith('brief:') ? 'briefs' : 'weather') : 'hazard';
    // Who a check-in expects: operational members of its team (or the
    // whole org), never the person who asked.
    const expectedOf = (ck: { org_id: string; team_id: string | null; requested_by: string | null }) =>
      (profiles ?? []).filter((p: { id: string; org_id: string; role: string; team_id: string | null }) =>
        p.org_id === ck.org_id && p.role !== 'viewer' && p.id !== ck.requested_by
        && (!ck.team_id || p.team_id === ck.team_id));
    const recentCheckinOrgs = new Set((recentCheckins ?? []).map((c: { org_id: string }) => c.org_id));

    for (const org of orgs ?? []) {
      const anchors = (anchorsByOrg.get(org.id) ?? []).slice(0, 12);
      const people = (peopleByOrg.get(org.id) ?? []).slice(0, 12);
      if (!anchors.length && !people.length) continue;
      const s = org.settings ?? {};
      const FIRE_KM = +s.wildfire_radius_km > 0 ? +s.wildfire_radius_km : 150;
      const HAZ_KM = +s.hazard_radius_km > 0 ? +s.hazard_radius_km : 300;
      const cands: Cand[] = [];

      // 1) measured radar over each anchor
      for (const a of anchors) {
        const dbz = await radarDbz(a);
        // Graded: drizzle is not an alert, rain is a bell note, heavy rain a
        // warning, and only a real convective cell (45+ dBZ) is critical.
        if (dbz != null && dbz >= 45) {
          cands.push({
            dedupe_key: `radar-storm:${a.label}:${hourBucket}`, severity: 'critical', kind: 'weather',
            title: `Intense cell over ${a.label} (radar ${Math.round(dbz)} dBZ)`,
            detail: 'Radar measures a strong precipitation cell at this exact position right now — torrential rain, possible hail and lightning. Source: RainViewer radar composite.',
            source: { lat: a.lat, lng: a.lng, dbz: Math.round(dbz) },
          });
        } else if (dbz != null && dbz >= 35) {
          cands.push({
            dedupe_key: `radar-heavy:${a.label}:${hourBucket}`, severity: 'warning', kind: 'weather',
            title: `Heavy rain over ${a.label} now (radar ${Math.round(dbz)} dBZ)`,
            detail: `Radar shows heavy rain at this exact position (${Math.round(dbz)} dBZ) — reduced visibility, water on roads. Source: RainViewer radar composite.`,
            source: { lat: a.lat, lng: a.lng, dbz: Math.round(dbz) },
          });
        } else if (dbz != null && dbz >= 20) {
          cands.push({
            dedupe_key: `radar-rain:${a.label}:${hourBucket}`, severity: 'info', kind: 'weather',
            title: `Rain over ${a.label} now (radar)`,
            detail: `Radar shows precipitation at this exact position (${Math.round(dbz)} dBZ). Source: RainViewer radar composite.`,
            source: { lat: a.lat, lng: a.lng, dbz: Math.round(dbz) },
          });
        }
      }

      // 2) rain nowcast (lead time, where the model has skill)
      if (anchors.length) try {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${anchors.map(a => a.lat.toFixed(3)).join(',')}` +
          `&longitude=${anchors.map(a => a.lng.toFixed(3)).join(',')}&minutely_15=precipitation&forecast_minutely_15=8&timezone=UTC`
        );
        const j = await r.json();
        const rows = Array.isArray(j) ? j : [j];
        for (let i = 0; i < anchors.length; i++) {
          const a = anchors[i];
          const m = rows[i]?.minutely_15;
          if (!m?.time?.length) continue;
          let idx = 0;
          for (let k = 0; k < m.time.length; k++) {
            if (new Date(m.time[k] + 'Z').getTime() <= Date.now()) idx = k; else break;
          }
          if (idx > m.time.length - 5) idx = 0;
          const cur = m.precipitation[idx] ?? 0;
          const next = m.precipitation.slice(idx + 1, idx + 5);
          if (cur < 0.1) {
            const onset = next.findIndex((v: number) => v >= 0.2);
            if (onset >= 0) {
              const peak = Math.max(...next.map((v: number) => v ?? 0)) * 4;
              cands.push({
                dedupe_key: `rain:${a.label}:${hourBucket}`,
                severity: peak >= 2 ? 'critical' : 'warning', kind: 'weather',
                title: `Rain reaching ${a.label} in ~${(onset + 1) * 15} min`,
                detail: `Point nowcast at this exact position: up to ${peak.toFixed(1)} mm/h within the hour. Source: Open-Meteo 15-minute model.`,
              });
            }
          }
        }
      } catch { /* nowcast down */ }

      // 3) significant earthquakes near anchors
      for (const qk of quakes) {
        const dist = Math.min(...anchors.map(a => haversine(a, qk)));
        if (dist <= HAZ_KM) {
          cands.push({
            dedupe_key: `quake:${qk.id}`,
            severity: qk.mag >= 6 || qk.tsunami === 1 ? 'critical' : 'warning', kind: 'seismic',
            title: `M${qk.mag} earthquake ${Math.round(dist)} km from your fleet`,
            detail: `${qk.place ?? 'Location unknown'}${qk.tsunami === 1 ? ' — TSUNAMI SIGNAL ISSUED' : ''}. Verify: ${qk.url}`,
          });
        }
      }

      // 4) wildfires near anchors
      for (const f of fires) {
        const dist = Math.min(...anchors.map(a => haversine(a, f)));
        if (dist <= FIRE_KM) {
          cands.push({
            dedupe_key: `eonet:${f.id}`, severity: 'critical', kind: 'hazard',
            title: `Wildfire ${Math.round(dist)} km from your fleet`,
            detail: `${f.title}. Source: NASA EONET.`,
          });
        }
      }

      // 5) daily brief + forward outlook at each person's last known position
      if (people.length) {
        try {
          const r = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${people.map(p => p.lat.toFixed(3)).join(',')}` +
            `&longitude=${people.map(p => p.lng.toFixed(3)).join(',')}` +
            `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max` +
            `&forecast_days=3&timezone=auto`
          );
          const j = await r.json();
          const rows = Array.isArray(j) ? j : [j];
          for (let i = 0; i < people.length; i++) {
            const person = people[i];
            const row = rows[i];
            const d = row?.daily;
            if (!d?.time?.length) continue;
            const offset = row.utc_offset_seconds ?? 0;
            const localNow = new Date((Date.now() / 1000 + offset) * 1000);
            const localHour = localNow.getUTCHours();
            const localDate = localNow.toISOString().slice(0, 10);

            // Forward outlook: see trouble coming, day by day
            for (let k = 0; k < d.time.length; k++) {
              const date = d.time[k];
              const day = DAY_WORD(k, date);
              const gust = d.wind_gusts_10m_max?.[k] ?? 0;
              const rain = d.precipitation_sum?.[k] ?? 0;
              const prob = d.precipitation_probability_max?.[k] ?? 0;
              const tmax = d.temperature_2m_max?.[k];
              const tmin = d.temperature_2m_min?.[k];
              const code = d.weather_code?.[k] ?? 0;
              const flags: Array<{ tag: string; sev: string; title: string; detail: string }> = [];
              if (gust >= 90) flags.push({ tag: 'wind', sev: 'critical', title: `Damaging winds ${day} at ${person.label} (gusts ${Math.round(gust)} km/h)`, detail: `Forecast gusts to ${Math.round(gust)} km/h ${day} (${date}) at this position. Secure equipment; expect treefall and debris. Source: Open-Meteo.` });
              else if (gust >= 70) flags.push({ tag: 'wind', sev: 'warning', title: `Strong winds ${day} at ${person.label} (gusts ${Math.round(gust)} km/h)`, detail: `Forecast gusts to ${Math.round(gust)} km/h ${day} (${date}). Source: Open-Meteo.` });
              if (rain >= 50) flags.push({ tag: 'rain', sev: 'critical', title: `Flood-level rain ${day} at ${person.label} (~${Math.round(rain)} mm)`, detail: `~${Math.round(rain)} mm forecast ${day} (${date}, ${prob}% probability). Watch drainages, burn scars and low crossings. Source: Open-Meteo.` });
              else if (rain >= 25) flags.push({ tag: 'rain', sev: 'warning', title: `Heavy rain ${day} at ${person.label} (~${Math.round(rain)} mm)`, detail: `~${Math.round(rain)} mm forecast ${day} (${date}, ${prob}% probability). Source: Open-Meteo.` });
              if (tmax != null && tmax >= 38) flags.push({ tag: 'heat', sev: 'critical', title: `Extreme heat ${day} at ${person.label} (${Math.round(tmax)}°C)`, detail: `Heat-illness risk ${day} (${date}) — plan hydration and work/rest cycles. Source: Open-Meteo.` });
              else if (tmax != null && tmax >= 33) flags.push({ tag: 'heat', sev: 'warning', title: `Heat ${day} at ${person.label} (${Math.round(tmax)}°C)`, detail: `Plan hydration and shade ${day} (${date}). Source: Open-Meteo.` });
              if (tmin != null && tmin <= -30) flags.push({ tag: 'cold', sev: 'critical', title: `Extreme cold ${day} at ${person.label} (${Math.round(tmin)}°C)`, detail: `Frostbite risk in minutes ${day} (${date}) — plan exposure limits. Source: Open-Meteo.` });
              else if (tmin != null && tmin <= -22) flags.push({ tag: 'cold', sev: 'warning', title: `Severe cold ${day} at ${person.label} (${Math.round(tmin)}°C)`, detail: `Severe cold forecast ${day} (${date}). Source: Open-Meteo.` });
              if (code >= 95 && prob >= 60) flags.push({ tag: 'tstorm', sev: gust >= 80 ? 'critical' : 'warning', title: `Thunderstorms ${day} at ${person.label}`, detail: `Thunderstorm day (${date}, ${prob}% precip probability${gust ? `, gusts to ${Math.round(gust)} km/h` : ''}). Lightning and sudden cells. Source: Open-Meteo.` });
              for (const f of flags) {
                cands.push({ dedupe_key: `wx-outlook:${person.label}:${date}:${f.tag}`, severity: f.sev, kind: 'weather', title: f.title, detail: f.detail });
              }
            }

            // Morning brief: once per local day, pushed to that person only
            if (localHour >= 6 && localHour < 10) {
              const key = `brief:${person.label}:${localDate}`;
              if (!liveKeys.has(`${org.id}|${key}`)) {
                const desc = WX_CODES[d.weather_code?.[0] ?? 0] ?? 'Conditions';
                const brief = `${desc} · ${Math.round(d.temperature_2m_min?.[0] ?? 0)} to ${Math.round(d.temperature_2m_max?.[0] ?? 0)}°C · rain ${(d.precipitation_sum?.[0] ?? 0).toFixed(1)} mm (${d.precipitation_probability_max?.[0] ?? 0}%) · gusts ${Math.round(d.wind_gusts_10m_max?.[0] ?? 0)} km/h`;
                const res = await insert('attention_items', {
                  org_id: org.id, dedupe_key: key, severity: 'info', kind: 'weather',
                  title: `Daily brief — ${person.label}`,
                  detail: `${brief}. At your last known position. Source: Open-Meteo.`,
                });
                if (res.ok) {
                  liveKeys.add(`${org.id}|${key}`);
                  raised++;
                  await insert('events', {
                    org_id: org.id, actor_kind: 'system', type: 'brief.sent',
                    subject: key, payload: { label: person.label, brief },
                  });
                  await sendTo(
                    subsOfOrg(org.id).filter((x: Sub) => x.profile_id === person.profileId),
                    { kind: 'forecast', title: `☀ Your day — ${desc}`, body: brief, tag: key },
                    'briefs', 'info',
                  );
                }
              }
            }
          }
        } catch { /* forecast service down — live checks already ran */ }
      }

      // ---------- raise + push ----------
      const fresh = cands.filter(c => !liveKeys.has(`${org.id}|${c.dedupe_key}`));
      for (const c of fresh) {
        const res = await insert('attention_items', { org_id: org.id, ...c });
        if (!res.ok) continue;
        raised++;
        liveKeys.add(`${org.id}|${c.dedupe_key}`);
        await insert('events', {
          org_id: org.id, actor_kind: 'system', type: 'attention.raised',
          subject: c.dedupe_key, payload: { severity: c.severity, kind: c.kind, title: c.title, via: 'tower-sweep' },
        });
        if (c.severity === 'warning' && c.dedupe_key.startsWith('radar-heavy:')) {
          await sendTo(
            subsOfOrg(org.id),
            { kind: 'attention', title: `🌧 ${c.title}`, body: c.detail.slice(0, 140), tag: c.dedupe_key },
            categoryOf(c), 'warning',
          );
        }
        if (c.severity === 'critical') {
          await sendTo(
            subsOfOrg(org.id),
            { kind: 'attention', title: `⚠ ${c.title}`, body: c.detail.slice(0, 140), tag: c.dedupe_key },
            categoryOf(c), 'critical',
          );
          // Opt-in: a critical hazard or weather hit asks everyone to
          // check in (at most once per 30 min per company)
          if (s.par_auto_on_critical === true && !recentCheckinOrgs.has(org.id)) {
            const ckRes = await fetch(`${supaUrl}/rest/v1/checkins`, {
              method: 'POST',
              headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
              body: JSON.stringify({ org_id: org.id, source: 'auto', message: c.title.slice(0, 140) }),
            });
            const created = ckRes.ok ? (await ckRes.json())?.[0] : null;
            if (created) {
              recentCheckinOrgs.add(org.id);
              await insert('events', {
                org_id: org.id, actor_kind: 'system', type: 'checkin.requested',
                subject: created.id, payload: { source: 'auto', trigger: c.title, via: 'tower-sweep' },
              });
              const expectedIds = new Set(expectedOf(created).map((p: { id: string }) => p.id));
              await sendTo(
                subsOfOrg(org.id).filter((x: Sub) => expectedIds.has(x.profile_id)),
                { kind: 'checkin', title: '✋ Check-in requested — are you OK?', body: c.title.slice(0, 140), url: `/?checkin=${created.id}`, tag: `checkin:${created.id}` },
                'checkin', 'critical',
              );
            }
          }
        }
      }
    }

    // ---------- check-in silence: re-alert at the red threshold ----------
    for (const ck of openCheckins ?? []) {
      const org = (orgs ?? []).find((o: { id: string }) => o.id === ck.org_id);
      const s = org?.settings ?? {};
      if (!org || s.par_auto_escalate === false) continue;
      const redMin = +s.par_red_min > 0 ? +s.par_red_min : 10;
      const elapsedMin = (Date.now() - new Date(ck.created_at).getTime()) / 60000;
      if (elapsedMin < redMin || elapsedMin > 180) continue;
      const answered = new Set((checkinResponses ?? [])
        .filter((r: { checkin_id: string }) => r.checkin_id === ck.id)
        .map((r: { profile_id: string }) => r.profile_id));
      for (const p of expectedOf(ck)) {
        if (answered.has(p.id)) continue;
        const key = `par-silent:${ck.id}:${p.id}`;
        if (liveKeys.has(`${ck.org_id}|${key}`)) continue;
        const res = await insert('attention_items', {
          org_id: ck.org_id, dedupe_key: key, severity: 'critical', kind: 'hazard',
          title: `${p.display_name ?? 'A member'} has not answered the check-in (${Math.round(elapsedMin)} min)`,
          detail: `No answer to the check-in sent ${Math.round(elapsedMin)} min ago${ck.message ? ` (“${ck.message}”)` : ''}. Try radio or phone; check their last position on the tactical map.`,
        });
        if (!res.ok) continue;
        raised++;
        liveKeys.add(`${ck.org_id}|${key}`);
        await insert('events', {
          org_id: ck.org_id, actor_kind: 'system', type: 'checkin.escalated',
          subject: ck.id, payload: { name: p.display_name, minutes: Math.round(elapsedMin), via: 'tower-sweep' },
        });
        // Second ask to the silent member, then tell the coordinators
        await sendTo(
          subsOfOrg(ck.org_id).filter((x: Sub) => x.profile_id === p.id),
          { kind: 'checkin', title: '✋ Second request — are you OK?', body: 'Your coordinator has not heard from you. Tap to answer.', url: `/?checkin=${ck.id}`, tag: `checkin:${ck.id}` },
          'checkin', 'critical',
        );
        const coordIds = new Set((profiles ?? [])
          .filter((x: { org_id: string; role: string }) => x.org_id === ck.org_id && ROLE_ORDER.indexOf(x.role) >= ROLE_ORDER.indexOf('coordinator'))
          .map((x: { id: string }) => x.id));
        await sendTo(
          subsOfOrg(ck.org_id).filter((x: Sub) => coordIds.has(x.profile_id)),
          { kind: 'attention', title: `⚠ ${p.display_name ?? 'A member'} — no check-in answer`, body: `${Math.round(elapsedMin)} min without an answer. Try radio or phone.`, tag: key },
          'hazard', 'critical',
        );
      }
    }

    // Housekeeping: weather items age out on their own (radar/rain/brief/
    // outlook entries are moment-in-time; stale ones must not pile up)
    await fetch(
      `${supaUrl}/rest/v1/attention_items?kind=eq.weather&status=in.(open,acknowledged)&created_at=lt.${new Date(Date.now() - 24 * 3600e3).toISOString()}`,
      {
        method: 'PATCH',
        headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'resolved' }),
      }
    ).catch(() => {});

    // Heartbeat: tower-watchdog and the app alert staff if this goes stale
    await fetch(`${supaUrl}/rest/v1/system_heartbeats?on_conflict=name`, {
      method: 'POST',
      headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        name: 'tower-sweep', at: new Date().toISOString(), ok: qErrors.length === 0,
        detail: { orgs: (orgs ?? []).length, raised, pushed, errors: qErrors.slice(0, 5) },
      }),
    }).catch(() => {});

    return json({
      ok: qErrors.length === 0,
      orgs: (orgs ?? []).length,
      anchored_orgs: anchorsByOrg.size,
      raised,
      pushed,
      ...(qErrors.length ? { query_errors: qErrors } : {}),
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

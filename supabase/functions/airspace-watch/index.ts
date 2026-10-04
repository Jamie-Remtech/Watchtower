// ============================================================
// Watchtower edge function: airspace-watch
// pg_cron every 30 s. For every company with a drone in the air
// (declared flight, live telemetry or Remote ID), take the aircraft
// around it — public ADS-B plus the company's own receivers — project
// each one 2 minutes ahead and raise an alert when its path enters the
// drone's airspace column:
//   critical  closest approach ≤ radius + 1.5 km, below the drone's ceiling + 300 m
//   warning   closest approach ≤ radius + 5 km, same vertical test
// Also: two drone flights overlapping (warning), declared flights end
// after 4 h, stale aircraft rows are cleared.
// POST { dryRun: true } returns what it would alert, without writing.
// Awareness aid only — it does not replace see-and-avoid or the air boss.
// ============================================================

import * as webpush from 'jsr:@negrel/webpush';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

const FT = 0.3048;
const LOOKAHEAD_S = 120;
const VERTICAL_BUFFER_M = 300;
const DECL_MAX_MS = 4 * 3600e3;
const kindOf = (cat?: string) => (cat === 'A7' ? 'helicopter' : cat === 'B6' ? 'drone' : cat === 'B2' ? 'balloon' : 'aircraft');

type Track = {
  id: string; kind: string; source?: string; label?: string | null; callsign?: string | null; registration?: string | null;
  lat: number; lng: number; alt_msl_m: number | null; alt_agl_m?: number | null; ceiling_m?: number | null; radius_m?: number | null;
  heading: number | null; speed_kmh: number | null; seen_at?: string; started_at?: string; status?: string;
};

// local flat projection (metres) around a reference point
const toXY = (ref: { lat: number; lng: number }, p: { lat: number; lng: number }) => ({
  x: (p.lng - ref.lng) * 111320 * Math.cos(ref.lat * Math.PI / 180),
  y: (p.lat - ref.lat) * 110540,
});
const vel = (t: Track) => {
  if (!t.speed_kmh || t.heading == null) return { vx: 0, vy: 0 };
  const v = t.speed_kmh / 3.6, h = t.heading * Math.PI / 180;
  return { vx: v * Math.sin(h), vy: v * Math.cos(h) };
};
// closest approach between a (moving) and d (moving) within the look-ahead
function closest(a: Track, d: Track) {
  const p = toXY(d, a);
  const va = vel(a), vd = vel(d);
  const rx = p.x, ry = p.y, vx = va.vx - vd.vx, vy = va.vy - vd.vy;
  const vv = vx * vx + vy * vy;
  let t = vv > 0 ? -(rx * vx + ry * vy) / vv : 0;
  t = Math.max(0, Math.min(LOOKAHEAD_S, t));
  const dx = rx + vx * t, dy = ry + vy * t;
  return { dist: Math.hypot(dx, dy), t: Math.round(t), now: Math.hypot(rx, ry) };
}
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const bearing = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
  const p = toXY(from, to);
  return DIRS[Math.round(((Math.atan2(p.x, p.y) * 180 / Math.PI + 360) % 360) / 45) % 8];
};

function normaliseAdsb(a: Record<string, any>): Track | null {
  if (typeof a.lat !== 'number' || typeof a.lon !== 'number' || a.alt_baro === 'ground') return null;
  if (typeof a.seen_pos === 'number' && a.seen_pos > 60) return null;
  const hex = String(a.hex ?? '').replace(/^~/, '').toLowerCase();
  const geom = typeof a.alt_geom === 'number' ? a.alt_geom : null, baro = typeof a.alt_baro === 'number' ? a.alt_baro : null;
  return {
    id: `icao:${hex}`, kind: kindOf(a.category), callsign: a.flight ? String(a.flight).trim() : null, registration: a.r ?? null,
    lat: a.lat, lng: a.lon, alt_msl_m: geom != null ? geom * FT : baro != null ? baro * FT : null,
    heading: typeof a.track === 'number' ? a.track : null, speed_kmh: typeof a.gs === 'number' ? a.gs * 1.852 : null,
  };
}

// Push texts in each recipient's language (same cache table as the app)
const fnv = (s: string) => {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < s.length; i++) { h ^= BigInt(s.charCodeAt(i)); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; }
  return h.toString(16);
};
async function translateTexts(texts: string[], lang: string): Promise<string[]> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!lang || lang === 'en' || !key) return texts;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-5', max_tokens: 800,
        messages: [{ role: 'user', content: `Translate each item of this JSON array into the language with code "${lang}". Aviation safety alerts for drone pilots: be faithful and terse; keep numbers, units, callsigns, registrations and compass letters exactly. Respond with STRICT JSON only: {"translations":[...]} same length and order.\n\n${JSON.stringify(texts)}` }],
      }),
    });
    const data = await r.json();
    const txt = (data?.content ?? []).map((c: { text?: string }) => c.text ?? '').join('');
    const m = txt.replace(/```(?:json)?/gi, '').match(/\{[\s\S]*\}/);
    const tr = m ? JSON.parse(m[0]).translations : null;
    return Array.isArray(tr) && tr.length === texts.length ? tr.map(String) : texts;
  } catch { return texts; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const supaUrl = Deno.env.get('SUPABASE_URL')!;
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const vapidJson = Deno.env.get('VAPID_KEYS_JSON');
  const H = { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' };
  const q = async (path: string) => (await fetch(`${supaUrl}/rest/v1/${path}`, { headers: H })).json();
  let dryRun = false;
  try { dryRun = !!(await req.json())?.dryRun; } catch { /* cron sends {} */ }

  try {
    const nowMs = Date.now();
    const recent = new Date(nowMs - 2 * 60000).toISOString();
    // housekeeping
    if (!dryRun) {
      await fetch(`${supaUrl}/rest/v1/air_tracks?source=eq.declared&status=eq.active&started_at=lt.${new Date(nowMs - DECL_MAX_MS).toISOString()}`, {
        method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'ended' }),
      });
      await fetch(`${supaUrl}/rest/v1/air_tracks?source=in.(receiver,remoteid,telemetry)&seen_at=lt.${new Date(nowMs - 30 * 60000).toISOString()}`, { method: 'DELETE', headers: H });
    }

    const drones: (Track & { org_id: string })[] = (await q(
      `air_tracks?status=eq.active&kind=eq.drone&or=(source.eq.declared,seen_at.gte.${recent})&select=*`,
    )) ?? [];
    if (!Array.isArray(drones) || !drones.length) return json({ drones: 0, conflicts: [] });

    // aircraft per area: one public query per 0.5° cell with drones, plus each org's receivers
    const cells = new Map<string, { lat: number; lng: number }>();
    for (const d of drones) cells.set(`${Math.round(d.lat * 2) / 2},${Math.round(d.lng * 2) / 2}`, { lat: d.lat, lng: d.lng });
    const publicAir: Track[] = [];
    for (const c of cells.values()) {
      try {
        const r = await fetch(`https://api.adsb.lol/v2/point/${c.lat.toFixed(3)}/${c.lng.toFixed(3)}/40`, { headers: { 'User-Agent': 'Watchtower emergency coordination' } });
        const d = await r.json();
        for (const a of d.ac ?? []) { const n = normaliseAdsb(a); if (n) publicAir.push(n); }
      } catch { /* public feed unavailable — receivers still count */ }
    }
    const recvAir: (Track & { org_id: string })[] = (await q(
      `air_tracks?source=eq.receiver&seen_at=gte.${new Date(nowMs - 60000).toISOString()}&select=*`,
    )) ?? [];

    const conflicts: Record<string, unknown>[] = [];
    const byOrg = new Map<string, (Track & { org_id: string })[]>();
    for (const d of drones) byOrg.set(d.org_id, [...(byOrg.get(d.org_id) ?? []), d]);

    for (const [orgId, orgDrones] of byOrg) {
      const air = new Map<string, Track>();
      for (const a of publicAir) air.set(a.id, a);
      for (const a of recvAir.filter(r => r.org_id === orgId)) air.set(a.id, a); // own receiver wins (fresher, local)
      for (const d of orgDrones) {
        const radius = d.radius_m ?? 100;
        const top = d.alt_msl_m ?? null; // declared: ground + ceiling; live: current altitude
        for (const a of air.values()) {
          if (a.id === d.id) continue;
          const c = closest(a, d);
          if (c.dist > radius + 5000 || c.now > 60000) continue;
          const vertRisk = a.alt_msl_m == null || top == null || a.alt_msl_m <= top + VERTICAL_BUFFER_M;
          if (!vertRisk) continue;
          const severity = c.dist <= radius + 1500 ? 'critical' : 'warning';
          conflicts.push({
            org_id: orgId, severity, drone: d.id, droneLabel: d.label ?? 'Drone', aircraft: a.id,
            who: a.callsign || a.registration || a.id.replace('icao:', ''), kind: a.kind,
            alt: a.alt_msl_m != null ? Math.round(a.alt_msl_m) : null, distNowKm: +(c.now / 1000).toFixed(1),
            cpaKm: +(c.dist / 1000).toFixed(1), tCpa: c.t, dir: bearing(d, a), lat: a.lat, lng: a.lng,
          });
        }
        // drone ↔ drone overlap
        for (const o of orgDrones) {
          if (o.id <= d.id) continue;
          const p = toXY(d, o);
          const sep = Math.hypot(p.x, p.y);
          if (sep <= radius + (o.radius_m ?? 100) + 50) {
            conflicts.push({ org_id: orgId, severity: 'warning', drone: d.id, droneLabel: d.label ?? 'Drone', aircraft: o.id, who: o.label ?? 'another drone', kind: 'drone', alt: o.alt_msl_m, distNowKm: +(sep / 1000).toFixed(2), cpaKm: +(sep / 1000).toFixed(2), tCpa: 0, dir: bearing(d, o), lat: o.lat, lng: o.lng });
          }
        }
      }
    }
    if (dryRun) return json({ drones: drones.length, aircraft: publicAir.length + recvAir.length, conflicts });

    // raise + push (one alert per drone/aircraft pair per 15 minutes)
    const bucket = Math.floor(nowMs / (15 * 60000));
    let raised = 0, pushed = 0;
    const vapidKeys = vapidJson ? await webpush.importVapidKeys(JSON.parse(vapidJson), { extractable: false }) : null;
    const appServer = vapidKeys ? await webpush.ApplicationServer.new({ contactInformation: 'mailto:jamietxtcal@gmail.com', vapidKeys }) : null;
    for (const c of conflicts) {
      const isDrone = c.kind === 'drone';
      const title = isDrone
        ? `Drone airspace overlap: ${c.droneLabel} and ${c.who}`
        : `${c.severity === 'critical' ? 'Aircraft inbound — land drones' : 'Aircraft approaching drone area'}: ${c.who}`;
      const detail = isDrone
        ? `${c.droneLabel} and ${c.who} are ${c.distNowKm} km apart — agree on separate areas or heights.`
        : `${c.who} (${c.kind}${c.alt != null ? `, ${c.alt} m` : ', altitude unknown'}) is ${c.distNowKm} km ${c.dir} of ${c.droneLabel}; closest approach ${c.cpaKm} km in ${c.tCpa} s.`;
      const ins = await fetch(`${supaUrl}/rest/v1/attention_items`, {
        method: 'POST', headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify({
          org_id: c.org_id, dedupe_key: `air:${c.drone}:${c.aircraft}:${bucket}`, severity: c.severity, kind: 'hazard',
          title, detail, source: { lat: c.lat, lng: c.lng, airspace: true },
        }),
      });
      if (!ins.ok) continue; // already raised in this window
      raised++;
      if (c.severity !== 'critical' || !appServer) continue;
      const subs: any[] = await q(`push_subscriptions?org_id=eq.${c.org_id}&select=endpoint,p256dh,auth,profile_id`);
      const profs: any[] = await q(`profiles?org_id=eq.${c.org_id}&select=id,language`);
      const langOf = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.language ?? 'en']));
      const byLang: Record<string, string[]> = {};
      for (const s of subs ?? []) {
        const lang = langOf[s.profile_id] ?? 'en';
        if (!byLang[lang]) byLang[lang] = await translateTexts([`✈ ${title}`, detail], lang);
        const [tt, tb] = byLang[lang];
        try {
          await appServer.subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }).pushTextMessage(JSON.stringify({
            title: tt, body: tb, url: '/?tab=world', kind: 'attention', tag: `air:${c.drone}:${c.aircraft}`,
            category: 'hazard', severity: 'critical', silent: false, sound: 'siren', vibrate: [600, 150, 600, 150, 600],
          }), {});
          pushed++;
        } catch { /* expired subscription */ }
      }
    }
    return json({ drones: drones.length, conflicts: conflicts.length, raised, pushed });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

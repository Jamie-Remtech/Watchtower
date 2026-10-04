// ============================================================
// Watchtower edge function: geofence-watch
// pg_cron every 30 s. Takes each person's latest position (last 2 min)
// and every active zone / circle that has an alert, works out who is
// inside, and compares with geofence_state. A crossing that matches the
// shape's alert mode ('enter' | 'exit' | 'both') raises an attention
// item and a push:
//   critical (exclusion zones, or custom categories set to critical)
//            → every subscribed device in the company
//   warning  → the person concerned + the company's coordinators/admins
// One alert per shape/person/direction per 10 minutes (dedupe_key).
// Someone first seen inside a zone counts as entering it; someone first
// seen outside never counts as leaving.
// POST { dryRun: true } returns the crossings, without writing.
// ============================================================

import * as webpush from 'jsr:@negrel/webpush';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

type LatLng = { lat: number; lng: number };
type Shape = {
  id: string; org_id: string; kind: 'zone' | 'circle' | 'route'; category: string; label: string;
  alert: 'none' | 'enter' | 'exit' | 'both'; geometry: { path?: LatLng[]; center?: LatLng; radius?: number };
};
type Pos = { profile_id: string; org_id: string; lat: number; lng: number; at: string };
type Transition = {
  org_id: string; shape_id: string; profile_id: string; dir: 'enter' | 'exit'; alert: boolean;
  severity: 'critical' | 'warning'; who: string; shapeName: string; category: string; categoryLabel: string;
  lat: number; lng: number; at: string;
};

// Built-in categories (mirror of src/hooks/useMapShapes.js SHAPE_CATEGORIES)
const BUILTIN: Record<string, { label: string; severity: 'critical' | 'warning' }> = {
  exclusion: { label: 'exclusion zone', severity: 'critical' },
  hazard_area: { label: 'hazard area', severity: 'warning' },
  evacuation: { label: 'evacuation zone', severity: 'warning' },
  staging_area: { label: 'staging area', severity: 'warning' },
  search_sector: { label: 'search sector', severity: 'warning' },
  perimeter: { label: 'perimeter / work area', severity: 'warning' },
};

const R_EARTH = 6371008.8;
const toRad = (d: number) => (d * Math.PI) / 180;
function distanceM(a: LatLng, b: LatLng) {
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
}
function pointInPolygon(pt: LatLng, ring: LatLng[]) {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.lat > pt.lat) !== (b.lat > pt.lat)) {
      const x = ((b.lng - a.lng) * (pt.lat - a.lat)) / (b.lat - a.lat) + a.lng;
      if (pt.lng < x) inside = !inside;
    }
  }
  return inside;
}
function insideShape(s: Shape, p: LatLng) {
  const g = s.geometry ?? {};
  if (s.kind === 'circle') {
    const c = g.center, r = Number(g.radius);
    return !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng) && r > 0 && distanceM(c, p) <= r;
  }
  if (s.kind === 'zone') return pointInPolygon(p, g.path ?? []);
  return false;
}

// Push texts in each recipient's language (same approach as airspace-watch)
async function translateTexts(texts: string[], lang: string): Promise<string[]> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!lang || lang === 'en' || !key) return texts;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-5', max_tokens: 800,
        messages: [{ role: 'user', content: `Translate each item of this JSON array into the language with code "${lang}". Safety alerts for emergency responders about people entering or leaving map zones: be faithful and terse; keep people's names, zone names in quotes, numbers and coordinates exactly. Respond with STRICT JSON only: {"translations":[...]} same length and order.\n\n${JSON.stringify(texts)}` }],
      }),
    });
    const data = await r.json();
    const txt = (data?.content ?? []).map((c: { text?: string }) => c.text ?? '').join('');
    const m = txt.replace(/```(?:json)?/gi, '').match(/\{[\s\S]*\}/);
    const tr = m ? JSON.parse(m[0]).translations : null;
    return Array.isArray(tr) && tr.length === texts.length ? tr.map(String) : texts;
  } catch { return texts; }
}

const inList = (ids: string[]) => `(${ids.map(encodeURIComponent).join(',')})`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const supaUrl = Deno.env.get('SUPABASE_URL')!;
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const vapidJson = Deno.env.get('VAPID_KEYS_JSON');
  const H = { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' };
  const q = async (path: string) => {
    const r = await fetch(`${supaUrl}/rest/v1/${path}`, { headers: H });
    const d = await r.json();
    if (!r.ok) throw new Error(`${path.split('?')[0]}: ${d?.message ?? r.status}`);
    return d;
  };
  let dryRun = false;
  try { dryRun = !!(await req.json())?.dryRun; } catch { /* cron sends {} */ }

  try {
    const nowMs = Date.now();
    const recent = new Date(nowMs - 2 * 60000).toISOString();

    // shapes that can alert
    const shapes: Shape[] = (await q(
      'map_shapes?active=eq.true&alert=neq.none&kind=in.(zone,circle)&select=id,org_id,kind,category,label,alert,geometry',
    )) ?? [];
    if (!shapes.length) return json({ shapes: 0, positions: 0, transitions: [] });
    const orgs = [...new Set(shapes.map(s => s.org_id))];

    // latest fix per person in those companies (last 2 minutes)
    const rows: Pos[] = (await q(
      `positions?at=gte.${encodeURIComponent(recent)}&org_id=in.${inList(orgs)}&select=profile_id,org_id,lat,lng,at&order=at.desc&limit=20000`,
    )) ?? [];
    const latest = new Map<string, Pos>();
    for (const p of rows) if (!latest.has(p.profile_id) && Number.isFinite(p.lat) && Number.isFinite(p.lng)) latest.set(p.profile_id, p);
    if (!latest.size) return json({ shapes: shapes.length, positions: 0, transitions: [] });

    // previous state, custom category settings, names
    const states: { shape_id: string; profile_id: string; inside: boolean }[] = (await q(
      `geofence_state?org_id=in.${inList(orgs)}&select=shape_id,profile_id,inside`,
    )) ?? [];
    const prev = new Map(states.map(s => [`${s.shape_id}:${s.profile_id}`, s.inside]));
    const configs: { org_id: string; config: Record<string, any> }[] = (await q(
      `map_config?org_id=in.${inList(orgs)}&select=org_id,config`,
    )) ?? [];
    const customCats = new Map<string, Record<string, { label: string; severity: string }>>();
    for (const c of configs) {
      const m: Record<string, { label: string; severity: string }> = {};
      for (const cc of c.config?.custom_shape_categories ?? []) if (cc?.id) m[cc.id] = { label: String(cc.label ?? cc.id), severity: String(cc.severity ?? 'warning') };
      customCats.set(c.org_id, m);
    }
    const catOf = (s: Shape) => {
      const custom = customCats.get(s.org_id)?.[s.category];
      if (custom) return { label: custom.label, severity: (custom.severity === 'critical' ? 'critical' : 'warning') as 'critical' | 'warning' };
      return BUILTIN[s.category] ?? { label: s.kind === 'circle' ? 'circle' : 'zone', severity: 'warning' as const };
    };
    const people: { id: string; org_id: string; display_name: string | null; callsign: string | null; role: string; language: string | null }[] =
      (await q(`profiles?id=in.${inList([...latest.keys()])}&select=id,org_id,display_name,callsign,role,language`)) ?? [];
    const personOf = new Map(people.map(p => [p.id, p]));

    // crossings
    const transitions: Transition[] = [];
    const upserts: Record<string, unknown>[] = [];
    for (const s of shapes) {
      const cat = catOf(s);
      for (const p of latest.values()) {
        if (p.org_id !== s.org_id) continue;
        const person = personOf.get(p.profile_id);
        if (person && person.org_id !== s.org_id) continue; // moved company since
        const inside = insideShape(s, p);
        const key = `${s.id}:${p.profile_id}`;
        const had = prev.get(key);
        if (had === inside) continue;
        upserts.push({ shape_id: s.id, profile_id: p.profile_id, org_id: s.org_id, inside, changed_at: new Date(nowMs).toISOString() });
        if (had === undefined && !inside) continue; // first seen outside: nothing crossed
        const dir = inside ? 'enter' : 'exit';
        const alert = s.alert === 'both' || s.alert === dir;
        const name = person?.display_name?.trim() || person?.callsign || 'A team member';
        transitions.push({
          org_id: s.org_id, shape_id: s.id, profile_id: p.profile_id, dir, alert, severity: cat.severity,
          who: person?.callsign && person.display_name ? `${person.display_name} (${person.callsign})` : name,
          shapeName: s.label?.trim() || cat.label, category: s.category, categoryLabel: cat.label,
          lat: p.lat, lng: p.lng, at: p.at,
        });
      }
    }
    if (dryRun) return json({ shapes: shapes.length, positions: latest.size, transitions });

    if (upserts.length) {
      await fetch(`${supaUrl}/rest/v1/geofence_state?on_conflict=shape_id,profile_id`, {
        method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(upserts),
      });
    }

    // raise + push
    const bucket = Math.floor(nowMs / (10 * 60000));
    let raised = 0, pushed = 0;
    const vapidKeys = vapidJson ? await webpush.importVapidKeys(JSON.parse(vapidJson), { extractable: false }) : null;
    const appServer = vapidKeys ? await webpush.ApplicationServer.new({ contactInformation: 'mailto:jamietxtcal@gmail.com', vapidKeys }) : null;
    const orgCache = new Map<string, { subs: any[]; profs: any[] }>();
    for (const tr of transitions.filter(x => x.alert)) {
      const title = tr.dir === 'enter'
        ? `${tr.severity === 'critical' ? 'Exclusion breach' : 'Zone entered'}: ${tr.who} entered "${tr.shapeName}"`
        : `Zone left: ${tr.who} left "${tr.shapeName}"`;
      const detail = tr.dir === 'enter'
        ? `${tr.who} is now inside the ${tr.categoryLabel} "${tr.shapeName}" (position ${tr.lat.toFixed(5)}, ${tr.lng.toFixed(5)}).`
        : `${tr.who} is now outside the ${tr.categoryLabel} "${tr.shapeName}" (position ${tr.lat.toFixed(5)}, ${tr.lng.toFixed(5)}).`;
      const ins = await fetch(`${supaUrl}/rest/v1/attention_items`, {
        method: 'POST', headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify({
          org_id: tr.org_id, dedupe_key: `geo:${tr.shape_id}:${tr.profile_id}:${tr.dir}:${bucket}`,
          severity: tr.severity, kind: 'hazard', title, detail, subject: tr.shape_id,
          source: { lat: tr.lat, lng: tr.lng, shape_id: tr.shape_id, profile_id: tr.profile_id, direction: tr.dir, category: tr.category, geofence: true },
        }),
      });
      if (!ins.ok) continue; // already raised in this window
      raised++;
      if (!appServer) continue;

      if (!orgCache.has(tr.org_id)) {
        orgCache.set(tr.org_id, {
          subs: (await q(`push_subscriptions?org_id=eq.${tr.org_id}&select=endpoint,p256dh,auth,profile_id`)) ?? [],
          profs: (await q(`profiles?org_id=eq.${tr.org_id}&select=id,role,language`)) ?? [],
        });
      }
      const { subs, profs } = orgCache.get(tr.org_id)!;
      const profOf = new Map(profs.map((p: any) => [p.id, p]));
      const recipients = tr.severity === 'critical'
        ? subs
        : subs.filter((s: any) => s.profile_id === tr.profile_id || ['coordinator', 'admin'].includes(profOf.get(s.profile_id)?.role));
      const byLang: Record<string, string[]> = {};
      for (const s of recipients) {
        const lang = profOf.get(s.profile_id)?.language ?? 'en';
        if (!byLang[lang]) byLang[lang] = await translateTexts([`⬡ ${title}`, detail], lang);
        const [tt, tb] = byLang[lang];
        const critical = tr.severity === 'critical';
        try {
          await appServer.subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }).pushTextMessage(JSON.stringify({
            title: tt, body: tb, url: '/?tab=tactical', kind: 'attention', tag: `geo:${tr.shape_id}:${tr.profile_id}`,
            category: 'hazard', severity: tr.severity, silent: false,
            ...(critical ? { sound: 'siren', vibrate: [600, 150, 600, 150, 600] } : {}),
          }), {});
          pushed++;
        } catch { /* expired subscription */ }
      }
    }
    return json({ shapes: shapes.length, positions: latest.size, transitions: transitions.length, raised, pushed });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

// ============================================================
// Watchtower edge function: air-ingest
// Feeds for the airspace picture. Each feed is an air_link with a secret
// key, sent as the  x-watchtower-key  header (only its SHA-256 is stored).
//
//   ADS-B receiver   body = readsb / dump1090 / tar1090  aircraft.json
//                    { "now": …, "aircraft": [ { hex, flight, lat, lon, alt_baro, alt_geom, gs, track, … } ] }
//   Remote ID        { "remoteid": [ { id, lat, lng, alt_geo_m?, height_m?, height_ref?: "takeoff"|"ground",
//                                       speed_ms?, heading?, op_lat?, op_lng?, ua_type?, operator_id? } ] }
//   Drone telemetry  { "telemetry": { lat, lng, alt_msl_m? | alt_rel_m?, heading?, speed_ms?, vrate_mps?,
//                                     battery?, label? } }
//
// Altitudes are normalised to metres above sea level so aircraft and
// drones compare on one scale: ADS-B geometric altitude (else pressure
// altitude), Remote ID geodetic altitude (else ground + height), and
// telemetry relative altitude + ground elevation at takeoff.
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-watchtower-key',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

const FT = 0.3048;
const kindOf = (cat?: string) => (cat === 'A7' ? 'helicopter' : cat === 'B6' ? 'drone' : cat === 'B2' ? 'balloon' : 'aircraft');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v) ? +v : null));
const validLatLng = (lat: number | null, lng: number | null) => lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const elevCache = new Map<string, number>();
async function groundElevation(lat: number, lng: number): Promise<number | null> {
  const k = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (elevCache.has(k)) return elevCache.get(k)!;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}`);
    const e = (await r.json())?.elevation?.[0];
    if (typeof e === 'number') { elevCache.set(k, e); return e; }
  } catch { /* unknown ground */ }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const supaUrl = Deno.env.get('SUPABASE_URL')!;
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const H = { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' };

  try {
    const key = req.headers.get('x-watchtower-key') ?? '';
    if (key.length < 20) return json({ error: 'missing x-watchtower-key' }, 401);
    const link = (await (await fetch(`${supaUrl}/rest/v1/air_links?key_hash=eq.${await sha256(key)}&select=*`, { headers: H })).json())?.[0];
    if (!link) return json({ error: 'unknown key' }, 401);

    const body = await req.json();
    const now = new Date().toISOString();
    const rows: Record<string, unknown>[] = [];

    if (link.kind === 'adsb') {
      for (const a of Array.isArray(body.aircraft) ? body.aircraft : []) {
        const lat = num(a.lat), lng = num(a.lon ?? a.lng);
        if (!validLatLng(lat, lng) || (num(a.seen_pos) ?? 0) > 60 || a.alt_baro === 'ground') continue;
        const hex = String(a.hex ?? '').replace(/^~/, '').toLowerCase();
        if (!hex) continue;
        const geom = num(a.alt_geom), baro = num(a.alt_baro);
        rows.push({
          org_id: link.org_id, id: `icao:${hex}`, kind: kindOf(a.category), source: 'receiver',
          callsign: a.flight ? String(a.flight).trim() || null : null, registration: a.r ?? null, model: a.t ?? null,
          lat, lng,
          alt_msl_m: geom != null ? Math.round(geom * FT) : baro != null ? Math.round(baro * FT) : null,
          alt_source: geom != null ? 'geom' : baro != null ? 'baro' : null,
          heading: num(a.track) ?? num(a.true_heading), speed_kmh: num(a.gs) != null ? Math.round(num(a.gs)! * 1.852) : null,
          vrate_mps: num(a.geom_rate) != null ? +(num(a.geom_rate)! * 0.00508).toFixed(1) : num(a.baro_rate) != null ? +(num(a.baro_rate)! * 0.00508).toFixed(1) : null,
          link_id: link.id, status: 'active', seen_at: now,
          raw: { squawk: a.squawk ?? null, emergency: a.emergency ?? null, rssi: a.rssi ?? null },
        });
      }
    } else if (link.kind === 'remoteid') {
      for (const d of Array.isArray(body.remoteid) ? body.remoteid : []) {
        const lat = num(d.lat), lng = num(d.lng ?? d.lon);
        const id = String(d.id ?? d.serial ?? d.uas_id ?? '').trim();
        if (!validLatLng(lat, lng) || !id) continue;
        let alt = num(d.alt_geo_m), altSrc = 'rid-geodetic', agl = num(d.height_m);
        if (alt == null && agl != null) {
          const g = await groundElevation(d.height_ref === 'takeoff' && validLatLng(num(d.op_lat), num(d.op_lng)) ? num(d.op_lat)! : lat!, d.height_ref === 'takeoff' && validLatLng(num(d.op_lat), num(d.op_lng)) ? num(d.op_lng)! : lng!);
          if (g != null) { alt = g + agl; altSrc = 'ground+height'; }
        }
        rows.push({
          org_id: link.org_id, id: `rid:${id.slice(0, 64)}`, kind: 'drone', source: 'remoteid',
          label: d.operator_id ? `Remote ID ${String(d.operator_id).slice(0, 24)}` : null,
          registration: id.slice(0, 64), model: d.ua_type ?? null,
          lat, lng, alt_msl_m: alt != null ? Math.round(alt) : null, alt_agl_m: agl, alt_source: alt != null ? altSrc : null,
          heading: num(d.heading), speed_kmh: num(d.speed_ms) != null ? Math.round(num(d.speed_ms)! * 3.6) : null,
          vrate_mps: num(d.vrate_mps),
          operator_lat: num(d.op_lat), operator_lng: num(d.op_lng),
          link_id: link.id, status: 'active', seen_at: now,
        });
      }
    } else if (link.kind === 'telemetry') {
      const t = body.telemetry ?? body;
      const lat = num(t.lat), lng = num(t.lng ?? t.lon);
      if (!validLatLng(lat, lng)) return json({ error: 'telemetry needs lat/lng' }, 400);
      let alt = num(t.alt_msl_m), altSrc = 'msl';
      const rel = num(t.alt_rel_m);
      if (alt == null && rel != null) {
        // ground elevation at takeoff: re-taken when a feed resumes after 15 min of silence
        let home = link.home_elev_m;
        const stale = !link.home_set_at || Date.now() - Date.parse(link.last_seen_at ?? link.home_set_at) > 15 * 60000;
        if (home == null || stale) {
          home = await groundElevation(lat!, lng!);
          if (home != null) await fetch(`${supaUrl}/rest/v1/air_links?id=eq.${link.id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ home_elev_m: home, home_set_at: now }) });
        }
        if (home != null) { alt = home + rel; altSrc = 'takeoff+rel'; }
      }
      rows.push({
        org_id: link.org_id, id: `tel:${link.id}`, kind: 'drone', source: 'telemetry',
        label: t.label ? String(t.label).slice(0, 60) : link.name,
        lat, lng, alt_msl_m: alt != null ? Math.round(alt) : null, alt_agl_m: rel, alt_source: alt != null ? altSrc : null,
        heading: num(t.heading), speed_kmh: num(t.speed_ms) != null ? Math.round(num(t.speed_ms)! * 3.6) : null,
        vrate_mps: num(t.vrate_mps), link_id: link.id, status: 'active', seen_at: now,
        raw: { battery: num(t.battery) },
      });
    }

    for (let i = 0; i < rows.length; i += 300) {
      const r = await fetch(`${supaUrl}/rest/v1/air_tracks?on_conflict=org_id,id`, {
        method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows.slice(i, i + 300)),
      });
      if (!r.ok) return json({ error: `store ${r.status}: ${(await r.text()).slice(0, 200)}` }, 500);
    }
    await fetch(`${supaUrl}/rest/v1/air_links?id=eq.${link.id}`, {
      method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ last_seen_at: now, last_count: rows.length }),
    });
    return json({ ok: true, link: link.name, kind: link.kind, stored: rows.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

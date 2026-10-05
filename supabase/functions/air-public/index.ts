// ============================================================
// Watchtower edge function: air-public
// Live aircraft around a point from the public ADS-B network (adsb.lol,
// open data, ODbL), normalised to Watchtower's air-track shape with
// altitudes in metres above sea level. The browser cannot call adsb.lol
// directly (no CORS), so the app asks here. Results cached 5 s.
// POST { bbox: [west, south, east, north] } → every aircraft in the visible map
//      (served from the shared cell cache kept fresh by air-cells)
// POST { lat, lng, radius_km } → { aircraft: [...], source, at }  (one circle)
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

const FT = 0.3048;
// ADS-B emitter category → kind (A7 rotorcraft, B2 lighter-than-air, B6 UAV)
const kindOf = (cat?: string) => (cat === 'A7' ? 'helicopter' : cat === 'B6' ? 'drone' : cat === 'B2' ? 'balloon' : 'aircraft');

export function normaliseAircraft(a: Record<string, any>) {
  if (typeof a.lat !== 'number' || typeof a.lon !== 'number') return null;
  if (typeof a.seen_pos === 'number' && a.seen_pos > 60) return null;
  if (a.alt_baro === 'ground') return null; // on the ground: not part of the airspace picture
  const geom = typeof a.alt_geom === 'number' ? a.alt_geom : null;
  const baro = typeof a.alt_baro === 'number' ? a.alt_baro : null;
  const hex = String(a.hex ?? '').replace(/^~/, '').toLowerCase();
  if (!hex) return null;
  return {
    id: `icao:${hex}`,
    kind: kindOf(a.category),
    callsign: a.flight ? String(a.flight).trim() || null : null,
    registration: a.r ?? null,
    model: a.t ?? null,
    lat: a.lat, lng: a.lon,
    alt_msl_m: geom != null ? Math.round(geom * FT) : baro != null ? Math.round(baro * FT) : null,
    alt_source: geom != null ? 'geom' : baro != null ? 'baro' : null,
    heading: typeof a.track === 'number' ? a.track : (typeof a.true_heading === 'number' ? a.true_heading : null),
    speed_kmh: typeof a.gs === 'number' ? Math.round(a.gs * 1.852) : null,
    vrate_mps: typeof a.geom_rate === 'number' ? +(a.geom_rate * 0.00508).toFixed(1) : typeof a.baro_rate === 'number' ? +(a.baro_rate * 0.00508).toFixed(1) : null,
    squawk: a.squawk ?? null,
    emergency: a.emergency && a.emergency !== 'none' ? a.emergency : null,
    age_s: typeof a.seen_pos === 'number' ? Math.round(a.seen_pos) : null,
  };
}

const cache = new Map<string, { at: number; body: unknown }>();

// ---- whole-view coverage from the shared cell cache (air_cells, 0038) ----
// The world is cut into fixed cells (5° of latitude, each fetched as one
// 250 nm circle). air-cells (pg_cron) refreshes the cells people look at at
// a polite 1 request/second — the public networks refuse bursts — and every
// user and view reads from here. A zoomed-in view whose cell is missing
// gets it fetched right away (once), so the first look is never empty.
const SUPA = Deno.env.get('SUPABASE_URL')!;
const SVC = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DBH = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' };
const CELL_LAT = 5;
const MAX_CELLS = 40;
const FT_ = 0.3048;

function lngStepAt(latBandEdge: number) {
  return Math.ceil(CELL_LAT / Math.cos(Math.min(80, Math.abs(latBandEdge)) * Math.PI / 180));
}
function cellsFor(w: number, s: number, e: number, n: number) {
  const cells: { key: string; lat: number; lng: number }[] = [];
  s = Math.max(-85, s); n = Math.min(85, n);
  if (e < w) e += 360;
  for (let lat0 = Math.floor(s / CELL_LAT) * CELL_LAT; lat0 < n; lat0 += CELL_LAT) {
    const step = lngStepAt(Math.max(Math.abs(lat0), Math.abs(lat0 + CELL_LAT)));
    for (let lng0 = Math.floor(w / step) * step; lng0 < e; lng0 += step) {
      const lng = ((lng0 + step / 2 + 540) % 360) - 180;
      cells.push({ key: `${lat0}:${step}:${Math.round(lng * 100)}`, lat: lat0 + CELL_LAT / 2, lng: +lng.toFixed(3) });
    }
  }
  return cells;
}
function inBox(lat: number, lng: number, w: number, s: number, e: number, n: number) {
  const pad = 0.3;
  if (lat < s - pad || lat > n + pad) return false;
  if (e < w) return lng >= w - pad || lng <= e + pad;
  return lng >= w - pad && lng <= e + pad;
}
const kindOf2 = (cat?: string) => (cat === 'A7' ? 'helicopter' : cat === 'B6' ? 'drone' : cat === 'B2' ? 'balloon' : 'aircraft');
function compactRow(a: Record<string, any>) {
  if (typeof a.lat !== 'number' || typeof a.lon !== 'number' || a.alt_baro === 'ground') return null;
  if (typeof a.seen_pos === 'number' && a.seen_pos > 60) return null;
  const hex = String(a.hex ?? '').replace(/^~/, '').toLowerCase();
  if (!hex) return null;
  const geom = typeof a.alt_geom === 'number' ? a.alt_geom : null, baro = typeof a.alt_baro === 'number' ? a.alt_baro : null;
  const hdg = typeof a.track === 'number' ? a.track : typeof a.true_heading === 'number' ? a.true_heading : null;
  return [hex, a.flight ? String(a.flight).trim() || null : null, a.r ?? null, a.t ?? null, +a.lat.toFixed(4), +a.lon.toFixed(4),
    geom != null ? Math.round(geom * FT_) : baro != null ? Math.round(baro * FT_) : null, hdg != null ? Math.round(hdg) : null,
    typeof a.gs === 'number' ? Math.round(a.gs * 1.852) : null, kindOf2(a.category), a.ownOp ?? null];
}
async function fetchNow(c: { lat: number; lng: number }) {
  const r = await fetch(`https://opendata.adsb.fi/api/v2/lat/${c.lat.toFixed(3)}/lon/${c.lng.toFixed(3)}/dist/250`, { headers: { 'User-Agent': 'Watchtower emergency coordination' } });
  if (!r.ok) return null;
  return ((await r.json()).aircraft ?? []).map(compactRow).filter(Boolean);
}

async function forBbox(bbox: number[]) {
  const [w, s, e, n] = bbox.map(Number);
  const cy = (s + n) / 2, cx = e < w ? ((w + e + 360) / 2 + 540) % 360 - 180 : (w + e) / 2;
  let cells = cellsFor(w, s, e, n);
  const partial = cells.length > MAX_CELLS;
  if (partial) cells = cells.sort((a, b) => Math.hypot(a.lat - cy, a.lng - cx) - Math.hypot(b.lat - cy, b.lng - cx)).slice(0, MAX_CELLS);
  const fine = cells.length <= 4;
  const nowIso = new Date().toISOString();
  // tell the refresher what people are looking at
  await fetch(`${SUPA}/rest/v1/air_cells?on_conflict=key`, {
    method: 'POST', headers: { ...DBH, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(cells.map(c => ({ key: c.key, lat: c.lat, lng: c.lng, wanted_at: nowIso, ...(fine ? { want_fine_at: nowIso } : {}) }))),
  });
  const keys = cells.map(c => `"${c.key}"`).join(',');
  const rows: any[] = await (await fetch(`${SUPA}/rest/v1/air_cells?key=in.(${encodeURIComponent(keys)})&select=key,lat,lng,at,ac`, { headers: DBH })).json();
  const byKey = new Map(rows.map(r => [r.key, r]));
  // zoomed in and nothing yet for a cell: fetch it now (at most 2)
  if (fine) {
    let n2 = 0;
    for (const c of cells) {
      const row = byKey.get(c.key);
      if (row?.at && Date.now() - Date.parse(row.at) < 60_000) continue;
      if (n2++ >= 2) break;
      const ac = await fetchNow(c);
      if (!ac) continue;
      const at = new Date().toISOString();
      byKey.set(c.key, { ...c, at, ac });
      await fetch(`${SUPA}/rest/v1/air_cells?key=eq.${encodeURIComponent(c.key)}`, { method: 'PATCH', headers: { ...DBH, Prefer: 'return=minimal' }, body: JSON.stringify({ at, ac }) });
    }
  }
  const seen = new Map<string, any>();
  let oldest = 0, pending = 0;
  for (const c of cells) {
    const row = byKey.get(c.key);
    if (!row?.at || !Array.isArray(row.ac)) { pending++; continue; }
    oldest = Math.max(oldest, Date.now() - Date.parse(row.at));
    for (const r of row.ac) {
      if (!inBox(r[4], r[5], w, s, e, n) || seen.has(r[0])) continue;
      seen.set(r[0], { id: `icao:${r[0]}`, callsign: r[1], registration: r[2], model: r[3], lat: r[4], lng: r[5], alt_msl_m: r[6], alt_source: 'geom', heading: r[7], speed_kmh: r[8], kind: r[9], operator: r[10] });
    }
  }
  return { aircraft: [...seen.values()], cells: cells.length, pending, partial, age_s: Math.round(oldest / 1000), source: 'adsb.fi / adsb.lol (open data)', at: nowIso };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body0 = await req.json();
    if (Array.isArray(body0.bbox) && body0.bbox.length === 4 && body0.bbox.every((v: unknown) => Number.isFinite(Number(v)))) {
      return json(await forBbox(body0.bbox));
    }
    const { lat, lng, radius_km } = body0;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return json({ error: 'lat/lng required' }, 400);
    const nm = Math.min(250, Math.max(5, Math.round((Number(radius_km) || 60) / 1.852)));
    const key = `${lat.toFixed(2)},${lng.toFixed(2)},${nm}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 5000) return json(hit.body);
    const r = await fetch(`https://api.adsb.lol/v2/point/${lat.toFixed(4)}/${lng.toFixed(4)}/${nm}`, { headers: { 'User-Agent': 'Watchtower emergency coordination' } });
    if (!r.ok) return json({ error: `adsb.lol ${r.status}` }, 502);
    const d = await r.json();
    const aircraft = (d.ac ?? []).map(normaliseAircraft).filter(Boolean);
    const body = { aircraft, source: 'adsb.lol (ODbL)', at: new Date().toISOString() };
    cache.set(key, { at: Date.now(), body });
    if (cache.size > 200) cache.clear();
    return json(body);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

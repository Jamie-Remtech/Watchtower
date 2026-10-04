// ============================================================
// Watchtower edge function: air-public
// Live aircraft around a point from the public ADS-B network (adsb.lol,
// open data, ODbL), normalised to Watchtower's air-track shape with
// altitudes in metres above sea level. The browser cannot call adsb.lol
// directly (no CORS), so the app asks here. Results cached 5 s.
// POST { lat, lng, radius_km } → { aircraft: [...], source, at }
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const { lat, lng, radius_km } = await req.json();
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

// ============================================================
// Watchtower edge function: air-cells   (pg_cron every 15 s)
// Keeps the shared aircraft cell cache (air_cells, 0038) fresh for the
// cells people are looking at: zoomed-in ("fine") cells when older than
// 15 s, wide-view cells when older than 60 s. One request per second to
// the public ADS-B network (adsb.fi open data; adsb.lol as fallback) —
// both refuse bursts, and this keeps every Watchtower user under the limit.
// Cells nobody has looked at for a day are deleted.
// ============================================================

const SUPA = Deno.env.get('SUPABASE_URL')!;
const SVC = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const H = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const FT = 0.3048;
const kindOf = (cat?: string) => (cat === 'A7' ? 'helicopter' : cat === 'B6' ? 'drone' : cat === 'B2' ? 'balloon' : 'aircraft');

// compact row: [hex, callsign, reg, type, lat, lng, alt_m, heading, kmh, kind, operator]
function compact(a: Record<string, any>) {
  if (typeof a.lat !== 'number' || typeof a.lon !== 'number') return null;
  if (typeof a.seen_pos === 'number' && a.seen_pos > 60) return null;
  if (a.alt_baro === 'ground') return null;
  const hex = String(a.hex ?? '').replace(/^~/, '').toLowerCase();
  if (!hex) return null;
  const geom = typeof a.alt_geom === 'number' ? a.alt_geom : null;
  const baro = typeof a.alt_baro === 'number' ? a.alt_baro : null;
  const hdg = typeof a.track === 'number' ? a.track : typeof a.true_heading === 'number' ? a.true_heading : null;
  return [
    hex, a.flight ? String(a.flight).trim() || null : null, a.r ?? null, a.t ?? null,
    +a.lat.toFixed(4), +a.lon.toFixed(4),
    geom != null ? Math.round(geom * FT) : baro != null ? Math.round(baro * FT) : null,
    hdg != null ? Math.round(hdg) : null, typeof a.gs === 'number' ? Math.round(a.gs * 1.852) : null,
    kindOf(a.category), a.ownOp ?? null,
  ];
}

async function fetchCell(lat: number, lng: number): Promise<any[]> {
  const ua = { 'User-Agent': 'Watchtower emergency coordination' };
  let r = await fetch(`https://opendata.adsb.fi/api/v2/lat/${lat.toFixed(3)}/lon/${lng.toFixed(3)}/dist/250`, { headers: ua });
  if (r.ok) return ((await r.json()).aircraft ?? []).map(compact).filter(Boolean);
  if (r.status === 429) throw new Error('rate');
  r = await fetch(`https://api.adsb.lol/v2/point/${lat.toFixed(3)}/${lng.toFixed(3)}/250`, { headers: ua });
  if (r.ok) return ((await r.json()).ac ?? []).map(compact).filter(Boolean);
  throw new Error(`upstream ${r.status}`);
}

Deno.serve(async () => {
  try {
    const now = Date.now();
    const iso = (ms: number) => new Date(now - ms).toISOString();
    // due cells: zoomed-in ones first, then wide-view ones; oldest first
    const fine: any[] = await (await fetch(`${SUPA}/rest/v1/air_cells?want_fine_at=gte.${iso(120_000)}&or=(at.is.null,at.lt.${iso(15_000)})&order=at.asc.nullsfirst&limit=11&select=key,lat,lng`, { headers: H })).json();
    const wide: any[] = fine.length >= 11 ? [] : await (await fetch(`${SUPA}/rest/v1/air_cells?wanted_at=gte.${iso(300_000)}&or=(at.is.null,at.lt.${iso(60_000)})&order=at.asc.nullsfirst&limit=${11 - fine.length}&select=key,lat,lng`, { headers: H })).json();
    const due = [...fine, ...wide.filter(w => !fine.some(f => f.key === w.key))];
    let done = 0, failed = 0;
    for (const c of due) {
      const t0 = Date.now();
      try {
        const ac = await fetchCell(c.lat, c.lng);
        await fetch(`${SUPA}/rest/v1/air_cells?key=eq.${encodeURIComponent(c.key)}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ at: new Date().toISOString(), ac, last_error: null }) });
        done++;
      } catch (e) {
        failed++;
        await fetch(`${SUPA}/rest/v1/air_cells?key=eq.${encodeURIComponent(c.key)}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ last_error: String(e).slice(0, 120) }) });
        if (String(e).includes('rate')) break; // back off until the next run
      }
      const wait = 1050 - (Date.now() - t0);
      if (wait > 0) await sleep(wait);
    }
    if (new Date().getUTCMinutes() === 0) await fetch(`${SUPA}/rest/v1/air_cells?wanted_at=lt.${iso(86_400_000)}`, { method: 'DELETE', headers: H });
    return json({ due: due.length, done, failed });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

// ============================================================
// Watchtower edge function: ledger
// The prediction ledger and regional memory. Each run (pg_cron, every
// 3 hours — every step is idempotent):
//   1. finds where each company's people are (0.25° cells, last 7 days)
//   2. remembers incidents around them: Canadian burned areas (CWFIS
//      NBAC, 1995→), NASA EONET events (2015→), USGS earthquakes
//      (2000→) — backfilled once per 0.5° cell, then kept current
//   3. issues today's predictions once per cell: days 1–3 for gusts,
//      rain, heat, cold, thunderstorms, burn-scar runoff; and once a
//      month the next three months vs the 1991–2020 normal. Every
//      prediction stores its variables, the raw model value AND the
//      value after Watchtower's learned local bias, and a SHA-256
//      fingerprint; the database refuses later edits.
//   4. scores matured predictions against ERA5 reanalysis (available
//      ~6 days after the fact) — raw and corrected, so the record shows
//      whether the learning is helping.
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

const VERSION = 'ledger v1';
const MAX_BACKFILLS_PER_RUN = 3;
const MAX_SCORE_CELLS_PER_RUN = 25;
const MIN_BIAS_SAMPLES = 10;

// Warning thresholds — the same numbers the app and tower-sweep use
const DAILY_METRICS: Record<string, { unit: string; threshold: number; below?: boolean; correct: boolean }> = {
  gust_max: { unit: 'km/h', threshold: 70, correct: true },
  precip_sum: { unit: 'mm', threshold: 25, correct: true },
  temp_max: { unit: '°C', threshold: 33, correct: true },
  temp_min: { unit: '°C', threshold: -22, below: true, correct: true },
  tstorm: { unit: 'flag', threshold: 1, correct: false },
  burn_runoff: { unit: 'mm', threshold: 20, correct: false },
};
const OBSERVED_VAR: Record<string, string> = {
  gust_max: 'wind_gusts_10m_max', precip_sum: 'precipitation_sum', burn_runoff: 'precipitation_sum',
  temp_max: 'temperature_2m_max', temp_min: 'temperature_2m_min',
};

const cell = (v: number, step: number) => Math.round(v / step) * step;
const key25 = (lat: number, lng: number) => `${cell(lat, 0.25).toFixed(2)},${cell(lng, 0.25).toFixed(2)}`;
const key50 = (lat: number, lng: number) => `${cell(lat, 0.5).toFixed(1)},${cell(lng, 0.5).toFixed(1)}`;
const parseKey = (k: string) => { const [a, b] = k.split(',').map(Number); return { lat: a, lng: b }; };
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
// distance to an incident: its bounding box when it has one (fire perimeters)
const kmToIncident = (p: { lat: number; lng: number }, inc: { lat: number; lng: number; details?: { bbox?: number[] } }) => {
  const bb = inc.details?.bbox;
  if (!bb) return km(p, inc);
  const lng = Math.min(Math.max(p.lng, bb[0]), bb[2]);
  const lat = Math.min(Math.max(p.lat, bb[1]), bb[3]);
  return km(p, { lat, lng });
};
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => isoDay(new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000));
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

async function sha256(obj: unknown) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(obj)));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getJson(url: string, timeoutMs = 45000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`${r.status} ${url.slice(0, 80)}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

const EONET_KIND: Record<string, string> = {
  wildfires: 'wildfire', severeStorms: 'severe_storm', floods: 'flood', volcanoes: 'volcano',
  landslides: 'landslide', snow: 'snow_ice', seaLakeIce: 'snow_ice', drought: 'drought',
  tempExtremes: 'heat', earthquakes: 'earthquake', dustHaze: 'other', manmade: 'other',
};

type Incident = {
  source: string; external_id: string; kind: string; title: string | null; lat: number; lng: number;
  region_key: string; started_at: string | null; ended_at: string | null; magnitude: number | null;
  magnitude_unit: string | null; details: Record<string, unknown>;
};

function eonetToIncidents(events: any[]): Incident[] {
  const out: Incident[] = [];
  for (const e of events ?? []) {
    const kind = EONET_KIND[e.categories?.[0]?.id];
    if (!kind) continue;
    const geos = (e.geometry ?? []).filter((g: any) => g.type === 'Point');
    const g = geos.at(-1);
    if (!g) continue;
    const [lng, lat] = g.coordinates;
    out.push({
      source: 'eonet', external_id: e.id, kind, title: e.title ?? null, lat, lng, region_key: key50(lat, lng),
      started_at: geos[0]?.date ?? null, ended_at: e.closed ?? null,
      magnitude: g.magnitudeValue ?? null, magnitude_unit: g.magnitudeUnit ?? null,
      details: { link: e.link, sources: (e.sources ?? []).map((s: any) => s.id) },
    });
  }
  return out;
}

function usgsToIncidents(features: any[]): Incident[] {
  return (features ?? []).map((f: any) => {
    const [lng, lat, depth] = f.geometry.coordinates;
    return {
      source: 'usgs', external_id: f.id, kind: 'earthquake', title: f.properties.title ?? null, lat, lng,
      region_key: key50(lat, lng), started_at: new Date(f.properties.time).toISOString(), ended_at: null,
      magnitude: f.properties.mag ?? null, magnitude_unit: f.properties.magType ?? 'M',
      details: { depth_km: depth, url: f.properties.url },
    };
  });
}

function nbacToIncidents(features: any[]): Incident[] {
  const out: Incident[] = [];
  for (const f of features ?? []) {
    const coords: number[][] = [];
    const walk = (c: any) => { if (typeof c?.[0] === 'number') coords.push(c); else c?.forEach(walk); };
    walk(f.geometry?.coordinates);
    if (!coords.length) continue;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, sx = 0, sy = 0;
    for (const [x, y] of coords) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); sx += x; sy += y; }
    const lat = sy / coords.length, lng = sx / coords.length;
    const p = f.properties ?? {};
    const ha = Number(p.adj_ha ?? p.poly_ha ?? 0);
    out.push({
      source: 'cwfis-nbac', external_id: String(f.id ?? p.__gid ?? `${p.year}_${p.nfireid}`), kind: 'wildfire',
      title: `Burned area ${p.year}${ha ? ` — ${Math.round(ha).toLocaleString('en')} ha` : ''}`,
      lat, lng, region_key: key50(lat, lng),
      started_at: p.ag_sdate ? new Date(p.ag_sdate.replace('Z', '')).toISOString() : `${p.year}-06-01T00:00:00Z`,
      ended_at: p.ag_edate ? new Date(p.ag_edate.replace('Z', '')).toISOString() : null,
      magnitude: ha || null, magnitude_unit: 'ha',
      details: { year: p.year, cause: p.firecaus ?? null, bbox: [minX, minY, maxX, maxY], admin: p.admin_area ?? null },
    });
  }
  return out;
}

const inCanada = (lat: number, lng: number) => lat >= 41 && lat <= 84 && lng >= -142 && lng <= -52;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const supaUrl = Deno.env.get('SUPABASE_URL')!;
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const H = { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' };
  const q = async (path: string) => {
    const r = await fetch(`${supaUrl}/rest/v1/${path}`, { headers: H });
    if (!r.ok) throw new Error(`db ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  };
  const upsert = async (table: string, rows: unknown[], onConflict: string, merge = false) => {
    for (let i = 0; i < rows.length; i += 500) {
      const r = await fetch(`${supaUrl}/rest/v1/${table}?on_conflict=${onConflict}`, {
        method: 'POST',
        headers: { ...H, Prefer: `resolution=${merge ? 'merge' : 'ignore'}-duplicates,return=minimal` },
        body: JSON.stringify(rows.slice(i, i + 500)),
      });
      if (!r.ok) throw new Error(`${table} ${r.status}: ${(await r.text()).slice(0, 300)}`);
    }
  };

  const report: Record<string, unknown> = { version: VERSION };
  const errors: string[] = [];
  try {
    // ---------- 1. where people are ----------
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const pos: { org_id: string; profile_id: string; lat: number; lng: number; at: string }[] =
      await q(`positions?at=gte.${since}&select=org_id,profile_id,lat,lng,at&order=at.desc&limit=20000`);
    const latest = new Map<string, typeof pos[0]>();
    for (const p of pos) if (!latest.has(p.profile_id)) latest.set(p.profile_id, p);
    const cells = new Map<string, { org_id: string; key: string; lat: number; lng: number; members: number }>();
    for (const p of latest.values()) {
      const k = key25(p.lat, p.lng);
      const id = `${p.org_id}|${k}`;
      const c = cells.get(id) ?? { org_id: p.org_id, key: k, ...parseKey(k), members: 0 };
      c.members++;
      cells.set(id, c);
    }
    report.cells = cells.size;
    const geoCells = [...new Set([...cells.values()].map(c => key50(c.lat, c.lng)))];
    const near = (lat: number, lng: number, radius: number) =>
      [...cells.values()].some(c => km(c, { lat, lng }) <= radius);

    // ---------- 2. regional memory ----------
    const done = new Set((await q('region_backfills?select=region_key')).map((r: { region_key: string }) => r.region_key));
    const todo = geoCells.filter(k => !done.has(k)).slice(0, MAX_BACKFILLS_PER_RUN);
    let remembered = 0;
    for (const k of todo) {
      const c = parseKey(k);
      const found: Incident[] = [];
      try {
        const e = await getJson(`https://eonet.gsfc.nasa.gov/api/v3/events?status=all&start=2015-01-01&end=${isoDay(new Date())}` +
          `&bbox=${c.lng - 1},${c.lat + 1},${c.lng + 1},${c.lat - 1}&limit=500`);
        found.push(...eonetToIncidents(e.events));
        const u = await getJson(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2000-01-01` +
          `&latitude=${c.lat}&longitude=${c.lng}&maxradiuskm=150&minmagnitude=2.5&limit=2000`);
        found.push(...usgsToIncidents(u.features));
        if (inCanada(c.lat, c.lng)) {
          const f = encodeURIComponent(`year>=1995 AND BBOX(geometry,${c.lng - 0.5},${c.lat - 0.5},${c.lng + 0.5},${c.lat + 0.5},'EPSG:4326')`);
          const n = await getJson(`https://cwfis.cfs.nrcan.gc.ca/geoserver/public/ows?service=WFS&version=1.0.0&request=GetFeature` +
            `&typeName=public:nbac&outputFormat=application/json&srsName=EPSG:4326&propertyName=year,adj_ha,poly_ha,ag_sdate,ag_edate,firecaus,admin_area,nfireid,geometry&CQL_FILTER=${f}`, 90000);
          found.push(...nbacToIncidents(n.features));
        }
        await upsert('regional_incidents', found, 'source,external_id');
        await upsert('region_backfills', [{ region_key: k }], 'region_key', true);
        remembered += found.length;
      } catch (e) { errors.push(`backfill ${k}: ${String(e).slice(0, 160)}`); }
    }
    // keep current: last 20 days of EONET, last 7 days of quakes, near anyone
    if (cells.size) {
      try {
        const e = await getJson('https://eonet.gsfc.nasa.gov/api/v3/events?status=all&days=20&limit=1000');
        const u = await getJson('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson');
        const fresh = [...eonetToIncidents(e.events), ...usgsToIncidents(u.features)].filter(i => near(i.lat, i.lng, 300));
        await upsert('regional_incidents', fresh, 'source,external_id');
        remembered += fresh.length;
      } catch (e) { errors.push(`recent incidents: ${String(e).slice(0, 160)}`); }
    }
    report.incidents_seen = remembered;
    report.backfilled_cells = todo.length;

    // ---------- 3. issue predictions ----------
    const today = isoDay(new Date());
    const issuedToday = new Set<string>(
      (await q(`predictions?kind=eq.daily&issue_date=gte.${addDays(today, -1)}&select=org_id,region_key,issue_date&limit=20000`))
        .map((r: any) => `${r.org_id}|${r.region_key}|${r.issue_date}`));
    const monthStart = today.slice(0, 8) + '01';
    const seasonalDone = new Set(
      (await q(`predictions?kind=eq.seasonal&issue_date=gte.${monthStart}&select=org_id,region_key&limit=20000`))
        .map((r: any) => `${r.org_id}|${r.region_key}`));

    // learned local bias per org+cell+metric (raw model minus truth)
    const biasRows: any[] = cells.size
      ? await q(`predictions?kind=eq.daily&abs_error_raw=not.is.null&select=org_id,region_key,metric,predicted_raw,observed&order=scored_at.desc&limit=20000`)
      : [];
    const biasAcc = new Map<string, { s: number; n: number }>();
    for (const r of biasRows) {
      const k = `${r.org_id}|${r.region_key}|${r.metric}`;
      const a = biasAcc.get(k) ?? { s: 0, n: 0 };
      if (a.n < 60) { a.s += Number(r.predicted_raw) - Number(r.observed); a.n++; }
      biasAcc.set(k, a);
    }
    const biasFor = (org: string, region: string, metric: string) => {
      const a = biasAcc.get(`${org}|${region}|${metric}`);
      return a && a.n >= MIN_BIAS_SAMPLES ? { bias: a.s / a.n, n: a.n } : { bias: 0, n: a?.n ?? 0 };
    };

    let enso: Record<string, unknown> | null = null;
    try {
      const w = await (await fetch(`${supaUrl}/functions/v1/world-outlook`, { method: 'POST', headers: H, body: '{}' })).json();
      enso = { status: w?.status ?? null, phase: w?.phase ?? null, strength: w?.strength ?? null, oni: Array.isArray(w?.oni) ? w.oni.slice(-3) : null };
    } catch { /* outlook unavailable */ }

    const placeCache = new Map<string, string | null>();
    const placeOf = async (lat: number, lng: number) => {
      const k = `${lat},${lng}`;
      if (placeCache.has(k)) return placeCache.get(k)!;
      let name: string | null = null;
      try {
        const g = await getJson(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`, 10000);
        name = [g.city || g.locality, g.principalSubdivision].filter(Boolean).join(', ') || g.countryName || null;
      } catch { /* unnamed */ }
      placeCache.set(k, name);
      return name;
    };

    const wildfires = async (c: { lat: number; lng: number }) => {
      const rows: any[] = await q(`regional_incidents?kind=eq.wildfire&lat=gte.${c.lat - 1.5}&lat=lte.${c.lat + 1.5}` +
        `&lng=gte.${c.lng - 2}&lng=lte.${c.lng + 2}&select=title,lat,lng,started_at,magnitude,details&limit=3000`);
      return rows;
    };

    const predRows: any[] = [];
    let normalsMade = 0;
    for (const c of cells.values()) {
      const needDaily = !issuedToday.has(`${c.org_id}|${c.key}|${today}`);
      const needSeasonal = !seasonalDone.has(`${c.org_id}|${c.key}`);
      if (!needDaily && !needSeasonal) continue;
      try {
        const place = await placeOf(c.lat, c.lng);
        const fires = await wildfires(c);
        const thisYear = new Date().getUTCFullYear();
        const scars = fires
          .map(f => ({ ...f, km: kmToIncident(c, f), year: Number(f.details?.year ?? String(f.started_at ?? '').slice(0, 4)) }))
          .filter(f => f.km <= 10 && f.year >= thisYear - 5 && Number(f.magnitude ?? 0) >= 10) // tiny burns change nothing
          .sort((a, b) => b.year - a.year)
          .slice(0, 5)
          .map(f => ({ year: f.year, km: Math.round(f.km * 10) / 10, ha: f.magnitude, title: f.title }));
        const context = { members: c.members, burn_scars: scars };

        if (needDaily) {
          const f = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}` +
            `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max` +
            `&forecast_days=4&timezone=auto`);
          const d = f.daily;
          const localToday = d.time[0];
          for (let i = 1; i <= 3 && !issuedToday.has(`${c.org_id}|${c.key}|${localToday}`); i++) {
            const raw: Record<string, number | null> = {
              gust_max: d.wind_gusts_10m_max?.[i], precip_sum: d.precipitation_sum?.[i],
              temp_max: d.temperature_2m_max?.[i], temp_min: d.temperature_2m_min?.[i],
              tstorm: (d.weather_code?.[i] ?? 0) >= 95 && (d.precipitation_probability_max?.[i] ?? 0) >= 60 ? 1 : 0,
            };
            if (scars.length) raw.burn_runoff = d.precipitation_sum?.[i];
            for (const [metric, value] of Object.entries(raw)) {
              if (value == null) continue;
              const m = DAILY_METRICS[metric];
              const b = m.correct ? biasFor(c.org_id, c.key, metric) : { bias: 0, n: 0 };
              let adj = value - b.bias;
              if (metric === 'precip_sum' && adj < 0) adj = 0;
              const flag = (v: number) => (m.below ? v <= m.threshold : v >= m.threshold);
              const row: any = {
                org_id: c.org_id, region_key: c.key, lat: c.lat, lng: c.lng, place, kind: 'daily', metric,
                issue_date: localToday, valid_date: d.time[i], lead_days: i,
                predicted_raw: Math.round(value * 10) / 10, predicted: Math.round(adj * 10) / 10,
                flagged: flag(adj), flagged_raw: flag(value), threshold: m.threshold, unit: m.unit,
                inputs: {
                  model: 'Open-Meteo best match', timezone: f.timezone,
                  weather_code: d.weather_code?.[i] ?? null, precip_probability: d.precipitation_probability_max?.[i] ?? null,
                  bias: b.n >= MIN_BIAS_SAMPLES ? { value: Math.round(b.bias * 100) / 100, samples: b.n } : { value: 0, samples: b.n, note: 'not enough history yet' },
                  context,
                },
                source: 'api.open-meteo.com/v1/forecast', version: VERSION,
              };
              row.fingerprint = await sha256([row.org_id, row.region_key, row.kind, row.metric, row.issue_date, row.valid_date, row.lead_days,
                row.predicted_raw, row.predicted, row.flagged, row.flagged_raw, row.threshold, row.inputs]);
              predRows.push(row);
            }
          }
        }

        if (needSeasonal) {
          let normals = (await q(`region_normals?region_key=eq.${c.key}&select=months`))?.[0]?.months;
          if (!normals) {
            const a = await getJson(`https://archive-api.open-meteo.com/v1/archive?latitude=${c.lat}&longitude=${c.lng}` +
              `&start_date=1991-01-01&end_date=2020-12-31&daily=temperature_2m_mean,precipitation_sum&timezone=auto`, 90000);
            const acc = Array.from({ length: 12 }, () => ({ t: 0, n: 0, p: 0 }));
            a.daily.time.forEach((day: string, i: number) => {
              const m = Number(day.slice(5, 7)) - 1;
              if (a.daily.temperature_2m_mean[i] != null) { acc[m].t += a.daily.temperature_2m_mean[i]; acc[m].n++; }
              if (a.daily.precipitation_sum[i] != null) acc[m].p += a.daily.precipitation_sum[i];
            });
            normals = acc.map(x => ({ temp: x.n ? Math.round(x.t / x.n * 100) / 100 : null, precip: Math.round(x.p / 30 * 10) / 10 }));
            await upsert('region_normals', [{ region_key: c.key, months: normals }], 'region_key', true);
            normalsMade++;
          }
          const s = await getJson(`https://seasonal-api.open-meteo.com/v1/seasonal?latitude=${c.lat}&longitude=${c.lng}` +
            `&daily=temperature_2m_mean,precipitation_sum&forecast_days=120&timezone=auto`);
          const sd = s.daily;
          const tK = Object.keys(sd).filter(k => k.startsWith('temperature_2m_mean'));
          const pK = Object.keys(sd).filter(k => k.startsWith('precipitation_sum'));
          const by = new Map<string, { t: number; tn: number; p: number; days: number; spreadT: number[] }>();
          sd.time.forEach((day: string, i: number) => {
            const ym = day.slice(0, 7);
            const ts = tK.map(k => sd[k][i]).filter((v: number | null) => v != null);
            const ps = pK.map(k => sd[k][i]).filter((v: number | null) => v != null);
            const cur = by.get(ym) ?? { t: 0, tn: 0, p: 0, days: 0, spreadT: [] };
            if (ts.length) { cur.t += ts.reduce((x: number, y: number) => x + y, 0) / ts.length; cur.tn++; }
            if (ps.length) cur.p += ps.reduce((x: number, y: number) => x + y, 0) / ps.length;
            cur.days++;
            by.set(ym, cur);
          });
          const months = [...by.entries()].filter(([ym, v]) => v.days >= 20 && `${ym}-01` > today).slice(0, 3);
          for (const [ym, v] of months) {
            const m = Number(ym.slice(5, 7)) - 1;
            const dim = new Date(Date.UTC(Number(ym.slice(0, 4)), m + 1, 0)).getUTCDate();
            const temp = v.tn ? v.t / v.tn : null;
            const precip = v.p * (dim / v.days);
            const n = normals[m];
            const tAnom = temp != null && n?.temp != null ? temp - n.temp : null;
            const pRatio = n?.precip ? precip / n.precip : null;
            const tCat = tAnom == null ? null : tAnom > 0.5 ? 'above' : tAnom < -0.5 ? 'below' : 'near';
            const pCat = pRatio == null ? null : pRatio > 1.15 ? 'above' : pRatio < 0.85 ? 'below' : 'near';
            for (const [metric, value, cat, normal, unit] of [
              ['temp_mean', temp, tCat, n?.temp, '°C'], ['precip_month', precip, pCat, n?.precip, 'mm'],
            ] as [string, number | null, string | null, number | null, string][]) {
              if (value == null) continue;
              const row: any = {
                org_id: c.org_id, region_key: c.key, lat: c.lat, lng: c.lng, place, kind: 'seasonal', metric,
                issue_date: today, valid_date: `${ym}-01`, lead_days: daysBetween(today, `${ym}-01`),
                predicted_raw: Math.round(value * 10) / 10, predicted: Math.round(value * 10) / 10,
                flagged: cat !== 'near', flagged_raw: cat !== 'near', threshold: null, unit,
                inputs: {
                  model: 'ECMWF SEAS5 ensemble mean (Open-Meteo seasonal)', members: tK.length,
                  normal_1991_2020: normal, category: cat,
                  anomaly: metric === 'temp_mean' ? (tAnom != null ? Math.round(tAnom * 10) / 10 : null) : (pRatio != null ? Math.round(pRatio * 100) / 100 : null),
                  enso, context,
                },
                source: 'seasonal-api.open-meteo.com', version: VERSION,
              };
              row.fingerprint = await sha256([row.org_id, row.region_key, row.kind, row.metric, row.issue_date, row.valid_date, row.lead_days,
                row.predicted_raw, row.predicted, row.flagged, row.flagged_raw, row.threshold, row.inputs]);
              predRows.push(row);
            }
          }
        }
      } catch (e) { errors.push(`issue ${c.key}: ${String(e).slice(0, 160)}`); }
    }
    if (predRows.length) await upsert('predictions', predRows, 'org_id,region_key,kind,metric,valid_date,issue_date');
    report.issued = predRows.length;
    report.normals_computed = normalsMade;

    // ---------- 4. score what has matured ----------
    const cutoff = addDays(today, -6); // ERA5 reaches the archive ~5 days later
    const pending: any[] = await q(`predictions?verdict=eq.pending&valid_date=lte.${cutoff}&select=*&order=valid_date&limit=5000`);
    const byCell = new Map<string, any[]>();
    for (const p of pending) {
      if (p.kind === 'seasonal') {
        const end = addDays(addDays(p.valid_date, 32).slice(0, 8) + '01', -1); // last day of that month
        if (end > cutoff) continue;
      }
      const k = `${p.lat},${p.lng}`;
      byCell.set(k, [...(byCell.get(k) ?? []), p]);
    }
    const scored: any[] = [];
    for (const [k, rows] of [...byCell.entries()].slice(0, MAX_SCORE_CELLS_PER_RUN)) {
      try {
        const { lat, lng } = parseKey(k);
        const start = rows.reduce((a, r) => (r.valid_date < a ? r.valid_date : a), rows[0].valid_date);
        const end = rows.reduce((a, r) => {
          const e = r.kind === 'seasonal' ? addDays(addDays(r.valid_date, 32).slice(0, 8) + '01', -1) : r.valid_date;
          return e > a ? e : a;
        }, start);
        const a = await getJson(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}` +
          `&start_date=${start}&end_date=${end}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_gusts_10m_max&timezone=auto`);
        const idx = new Map<string, number>(a.daily.time.map((t: string, i: number) => [t, i]));
        for (const r of rows) {
          const out = { ...r, observed_source: 'ERA5 reanalysis (Open-Meteo archive)', scored_at: new Date().toISOString() };
          if (r.kind === 'daily') {
            const i = idx.get(r.valid_date);
            const v = OBSERVED_VAR[r.metric];
            const obs = i != null && v ? a.daily[v]?.[i] : null;
            if (obs == null) {
              out.verdict = 'no_data';
              out.observed_source = r.metric === 'tstorm' ? 'no lightning record available to verify thunderstorms' : out.observed_source;
            } else {
              const m = DAILY_METRICS[r.metric];
              const oflag = m.below ? obs <= m.threshold : obs >= m.threshold;
              const verdict = (f: boolean) => (f && oflag ? 'hit' : f && !oflag ? 'false_alarm' : !f && oflag ? 'miss' : 'correct_negative');
              Object.assign(out, {
                observed: Math.round(obs * 10) / 10, observed_flag: oflag,
                verdict: verdict(r.flagged), verdict_raw: verdict(r.flagged_raw),
                abs_error: Math.round(Math.abs(Number(r.predicted) - obs) * 100) / 100,
                abs_error_raw: Math.round(Math.abs(Number(r.predicted_raw) - obs) * 100) / 100,
              });
            }
          } else {
            const ym = r.valid_date.slice(0, 7);
            const ts: number[] = [], ps: number[] = [];
            a.daily.time.forEach((t: string, i: number) => {
              if (!t.startsWith(ym)) return;
              if (a.daily.temperature_2m_mean[i] != null) ts.push(a.daily.temperature_2m_mean[i]);
              if (a.daily.precipitation_sum[i] != null) ps.push(a.daily.precipitation_sum[i]);
            });
            const obs = r.metric === 'temp_mean'
              ? (ts.length >= 25 ? ts.reduce((x, y) => x + y, 0) / ts.length : null)
              : (ps.length >= 25 ? ps.reduce((x, y) => x + y, 0) : null);
            const normal = r.inputs?.normal_1991_2020;
            if (obs == null || normal == null) { out.verdict = 'no_data'; }
            else {
              const ocat = r.metric === 'temp_mean'
                ? (obs - normal > 0.5 ? 'above' : obs - normal < -0.5 ? 'below' : 'near')
                : (obs / normal > 1.15 ? 'above' : obs / normal < 0.85 ? 'below' : 'near');
              Object.assign(out, {
                observed: Math.round(obs * 10) / 10, observed_flag: ocat !== 'near',
                verdict: ocat === r.inputs?.category ? 'hit' : 'miss', verdict_raw: ocat === r.inputs?.category ? 'hit' : 'miss',
                abs_error: Math.round(Math.abs(Number(r.predicted) - obs) * 100) / 100,
                abs_error_raw: Math.round(Math.abs(Number(r.predicted_raw) - obs) * 100) / 100,
              });
            }
          }
          scored.push(out);
        }
      } catch (e) { errors.push(`score ${k}: ${String(e).slice(0, 160)}`); }
    }
    if (scored.length) await upsert('predictions', scored, 'id', true);
    report.scored = scored.length;
    report.pending_matured = pending.length;
  } catch (e) {
    errors.push(String(e));
  }
  report.errors = errors;
  return json({ ok: errors.length === 0, ...report });
});

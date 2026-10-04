// ============================================
// FIRES & NATURAL EVENTS — one honest picture for the map and the alerts.
// NASA EONET keeps wildfire incidents "open" long after they are out (most
// of its US IRWIN feed has not been updated in months) and mixes in
// prescribed burns. A fire counts here only if it was reported in the last
// FIRE_FRESH_DAYS days and is not a planned burn. Canada's satellite heat
// detections (CWFIS hotspots, last 24 h) add what is burning right now.
// ============================================

export const FIRE_FRESH_DAYS = 14;
const EONET = 'https://eonet.gsfc.nasa.gov/api/v3/events';
const OTHER_CATS = 'volcanoes,severeStorms,floods,seaLakeIce,landslides,dustHaze,snow,tempExtremes,drought,manmade,waterColor,earthquakes';

export function isPrescribed(title) {
  return /prescribed|\bRX\b|pile burn/i.test(title ?? '');
}

function lastPoint(e) {
  const g = e.geometry?.at(-1);
  const c = g?.type === 'Point' ? g.coordinates : g?.coordinates?.[0]?.[0];
  return Array.isArray(c) ? { lng: c[0], lat: c[1], date: g.date, size: g.magnitudeValue ?? null, unit: g.magnitudeUnit ?? null } : null;
}

// Open EONET events worth showing: fresh, real wildfires + every other open category.
export async function fetchNaturalEvents() {
  const [fires, other] = await Promise.all([
    fetch(`${EONET}?status=open&category=wildfires&days=${FIRE_FRESH_DAYS}&limit=1000`).then(r => r.json()).catch(() => null),
    fetch(`${EONET}?status=open&category=${OTHER_CATS}&limit=1000`).then(r => r.json()).catch(() => null),
  ]);
  if (!fires && !other) throw new Error('EONET unreachable'); // callers keep what they had
  const cutoff = Date.now() - FIRE_FRESH_DAYS * 86400e3;
  const out = [];
  for (const e of [...(fires?.events ?? []), ...(other?.events ?? [])]) {
    const p = lastPoint(e);
    if (!p) continue;
    const cat = e.categories?.[0]?.id ?? 'other';
    if (cat === 'wildfires' && (isPrescribed(e.title) || Date.parse(p.date) < cutoff)) continue;
    out.push({ id: e.id, title: e.title, cat, ...p, link: e.sources?.[0]?.url ?? e.link, sourceId: e.sources?.[0]?.id ?? null });
  }
  return out;
}

// Canadian Wildland Fire Information System: satellite heat detections in the
// last 24 h (VIIRS / MODIS), with fuel type and fire weather. 'farm' and
// non-fuel detections are usually agricultural burning.
export async function fetchHotspots() {
  const url = 'https://cwfis.cfs.nrcan.gc.ca/geoserver/public/wfs?service=WFS&version=2.0.0&request=GetFeature'
    + '&typeNames=public:hotspots_last24hrs&outputFormat=application/json&srsName=EPSG:4326&count=5000';
  try {
    const j = await (await fetch(url)).json();
    return (j.features ?? []).map(f => {
      const p = f.properties ?? {};
      const [lng, lat] = f.geometry?.coordinates ?? [p.lon, p.lat];
      return {
        lat: Number(lat), lng: Number(lng), date: p.rep_date, fuel: p.fuel ?? null, agency: p.agency ?? null,
        sensor: [p.sensor, p.satellite].filter(Boolean).join(' · '), hfi: p.hfi ?? null, fwi: p.fwi ?? null,
        farm: /farm|non-fuel|water|urban/i.test(p.fuel ?? ''),
      };
    }).filter(h => Number.isFinite(h.lat) && Number.isFinite(h.lng));
  } catch { return []; }
}

export const daysAgo = (iso) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86400e3));

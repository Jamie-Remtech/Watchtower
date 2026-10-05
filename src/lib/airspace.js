import { supabase } from './supabase';
import { getOrgId } from './org';

// ============================================
// AIRSPACE — aircraft and drones on one altitude scale (metres above
// sea level). Public ADS-B comes through the air-public function; the
// company's own receivers, drone telemetry, Remote ID and declared
// flights come from air_tracks. Conflict maths mirrors airspace-watch.
// ============================================

export const LOOKAHEAD_S = 120;
export const VERTICAL_BUFFER_M = 300;
export const FT = 3.28084;

// how long each kind of feed stays "live" without an update
// public: wide views come from a cache refreshed about every minute
const FRESH_S = { receiver: 90, remoteid: 120, telemetry: 120, declared: Infinity, public: 150 };

export async function fetchPublicAir(lat, lng, radiusKm) {
  const { data, error } = await supabase.functions.invoke('air-public', { body: { lat, lng, radius_km: radiusKm } });
  if (error || !Array.isArray(data?.aircraft)) return [];
  return data.aircraft.map(a => ({ ...a, source: 'public', seen_at: new Date(Date.now() - (a.age_s ?? 0) * 1000).toISOString() }));
}

// Every aircraft in a map view: bbox = [west, south, east, north]
export async function fetchPublicAirBox(bbox) {
  const { data, error } = await supabase.functions.invoke('air-public', { body: { bbox } });
  if (error || !Array.isArray(data?.aircraft)) return null;
  return {
    aircraft: data.aircraft.map(a => ({ ...a, source: 'public', seen_at: new Date(Date.now() - (data.age_s ?? 0) * 1000).toISOString() })),
    partial: !!data.partial,      // view larger than the server covers at once
    pending: data.pending ?? 0,   // areas still being fetched for the first time
    ageS: data.age_s ?? 0,        // oldest area in the view
  };
}

export async function fetchOwnAir() {
  const org = await getOrgId();
  if (!org) return [];
  const since = new Date(Date.now() - 3 * 60000).toISOString();
  const { data } = await supabase.from('air_tracks').select('*').eq('org_id', org).eq('status', 'active')
    .or(`source.eq.declared,seen_at.gte.${since}`).limit(1000);
  return data ?? [];
}

export const isFresh = (t, now = Date.now()) =>
  (now - Date.parse(t.seen_at ?? 0)) / 1000 <= (FRESH_S[t.source] ?? 60);

// own feeds win over the public network for the same aircraft
export function mergeTracks(publicAir, ownAir) {
  const m = new Map();
  for (const a of publicAir) m.set(a.id, a);
  for (const a of ownAir) m.set(a.id, a);
  const now = Date.now();
  return [...m.values()].filter(t => isFresh(t, now) && Number.isFinite(t.lat) && Number.isFinite(t.lng));
}

const toXY = (ref, p) => ({
  x: (p.lng - ref.lng) * 111320 * Math.cos(ref.lat * Math.PI / 180),
  y: (p.lat - ref.lat) * 110540,
});
const vel = (t) => {
  if (!t.speed_kmh || t.heading == null) return { vx: 0, vy: 0 };
  const v = t.speed_kmh / 3.6, h = t.heading * Math.PI / 180;
  return { vx: v * Math.sin(h), vy: v * Math.cos(h) };
};
export function closestApproach(a, d) {
  const p = toXY(d, a);
  const va = vel(a), vd = vel(d);
  const vx = va.vx - vd.vx, vy = va.vy - vd.vy;
  const vv = vx * vx + vy * vy;
  let t = vv > 0 ? -(p.x * vx + p.y * vy) / vv : 0;
  t = Math.max(0, Math.min(LOOKAHEAD_S, t));
  return { dist: Math.hypot(p.x + vx * t, p.y + vy * t), t: Math.round(t), now: Math.hypot(p.x, p.y) };
}
export const distanceKm = (a, b) => Math.hypot(toXY(a, b).x, toXY(a, b).y) / 1000;
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const bearingTo = (from, to) => {
  const p = toXY(from, to);
  return DIRS[Math.round(((Math.atan2(p.x, p.y) * 180 / Math.PI + 360) % 360) / 45) % 8];
};

// conflicts between this company's drones and everything else in the air
export function findConflicts(tracks) {
  const drones = tracks.filter(t => t.kind === 'drone' && t.source !== 'public');
  const out = [];
  for (const d of drones) {
    const radius = d.radius_m ?? 100;
    const top = d.alt_msl_m;
    for (const a of tracks) {
      if (a.id === d.id) continue;
      const c = closestApproach(a, d);
      if (a.kind === 'drone' && a.source !== 'public') {
        if (c.now <= radius + (a.radius_m ?? 100) + 50 && d.id < a.id) out.push({ severity: 'warning', drone: d, other: a, ...c, overlap: true });
        continue;
      }
      if (c.dist > radius + 5000 || c.now > 60000) continue;
      if (!(a.alt_msl_m == null || top == null || a.alt_msl_m <= top + VERTICAL_BUFFER_M)) continue;
      out.push({ severity: c.dist <= radius + 1500 ? 'critical' : 'warning', drone: d, other: a, ...c });
    }
  }
  return out.sort((x, y) => (x.severity === y.severity ? x.dist - y.dist : x.severity === 'critical' ? -1 : 1));
}

const elevCache = new Map();
export async function groundElevation(lat, lng) {
  const k = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (elevCache.has(k)) return elevCache.get(k);
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}`);
    const e = (await r.json())?.elevation?.[0];
    if (typeof e === 'number') { elevCache.set(k, e); return e; }
  } catch { /* unknown ground */ }
  return null;
}

// a pilot declares a drone flight: a column from the ground to the ceiling
export async function declareFlight({ label, ceilingM, radiusM, lat, lng, userId }) {
  const org = await getOrgId();
  const ground = await groundElevation(lat, lng);
  const id = `decl:${crypto.randomUUID()}`;
  const { error } = await supabase.from('air_tracks').insert({
    org_id: org, id, kind: 'drone', source: 'declared', label,
    lat, lng, alt_msl_m: ground != null ? Math.round(ground + ceilingM) : null, alt_agl_m: ceilingM,
    alt_source: ground != null ? 'ground+ceiling' : null, ceiling_m: ceilingM, radius_m: radiusM,
    operator_lat: lat, operator_lng: lng, declared_by: userId, status: 'active',
  });
  if (error) throw error;
  return id;
}

export async function endFlight(id) {
  const org = await getOrgId();
  const { error } = await supabase.from('air_tracks').update({ status: 'ended', seen_at: new Date().toISOString() }).eq('org_id', org).eq('id', id);
  if (error) throw error;
}

export const metres = (m) => (m == null ? '—' : `${Math.round(m).toLocaleString()} m`);
export const feet = (m) => (m == null ? '' : `${Math.round(m * FT).toLocaleString()} ft`);
export const KIND_ICON = { aircraft: '✈️', helicopter: '🚁', drone: '🛸', balloon: '🎈', other: '•' };
export const KIND_COLOR = { aircraft: '#38bdf8', helicopter: '#a78bfa', drone: '#f97316', balloon: '#f472b6', other: '#94a3b8' };

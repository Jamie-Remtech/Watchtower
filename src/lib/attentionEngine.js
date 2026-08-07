import { supabase, isSupabaseConfigured } from './supabase';
import { logEvent } from './eventLog';

// ============================================
// ATTENTION ENGINE v1
// Sweeps real signals and raises attention items for coordinators:
//  - devices offline / in maintenance / unplaced
//  - natural events (NASA EONET) near the fleet
//  - significant earthquakes (USGS) near the fleet
//  - fire-weather conditions at the fleet centroid (Open-Meteo)
//  - invitations about to expire
// Each condition has a dedupe key so it raises exactly once while live.
// Device-condition items auto-resolve when the condition clears.
// ============================================

const KM = 6371; // Earth radius
const haversine = (a, b) => {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * KM * Math.asin(Math.sqrt(s));
};

const HAZARD_RADIUS_KM = 300;   // seismic / general events
const WILDFIRE_RADIUS_KM = 150; // wildfires get a tighter, more serious radius

export async function runAttentionSweep() {
  if (!isSupabaseConfigured) return { raised: 0 };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { raised: 0 };
  const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
  const orgId = prof?.org_id;
  if (!orgId) return { raised: 0 };

  const { data: devices } = await supabase.from('devices').select('*');
  const { data: invites } = await supabase.from('invitations').select('*').eq('status', 'pending');
  const candidates = [];

  // ---- Device conditions ----
  for (const d of devices ?? []) {
    if (d.status === 'offline') {
      candidates.push({
        dedupe_key: `device-offline:${d.id}`, severity: 'warning', kind: 'device',
        title: `${d.name} is offline`,
        detail: 'Device is not reporting. Check power and connectivity.',
        subject: d.id,
      });
    }
    if (d.status === 'maintenance') {
      candidates.push({
        dedupe_key: `device-maintenance:${d.id}`, severity: 'info', kind: 'device',
        title: `${d.name} is in maintenance`,
        detail: 'Coverage is reduced while this device is serviced.',
        subject: d.id,
      });
    }
    if (d.lat == null || d.lng == null) {
      candidates.push({
        dedupe_key: `device-unplaced:${d.id}`, severity: 'info', kind: 'device',
        title: `${d.name} has no position`,
        detail: 'Place it in Settings so it appears on the tactical map.',
        subject: d.id,
      });
    }
  }

  // ---- Fleet centroid for proximity rules ----
  const placed = (devices ?? []).filter(d => d.lat != null && d.lng != null);
  const centroid = placed.length
    ? {
        lat: placed.reduce((a, d) => a + d.lat, 0) / placed.length,
        lng: placed.reduce((a, d) => a + d.lng, 0) / placed.length,
      }
    : null;

  if (centroid) {
    // ---- Natural events near the fleet (NASA EONET) ----
    try {
      const res = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=1000');
      const data = await res.json();
      for (const e of data.events ?? []) {
        const g = e.geometry?.at(-1);
        const coords = g?.type === 'Point' ? g.coordinates : g?.coordinates?.[0]?.[0];
        if (!Array.isArray(coords)) continue;
        const pos = { lng: coords[0], lat: coords[1] };
        const dist = haversine(centroid, pos);
        const cat = e.categories?.[0]?.id;
        const isFire = cat === 'wildfires';
        const radius = isFire ? WILDFIRE_RADIUS_KM : HAZARD_RADIUS_KM;
        if (dist <= radius) {
          candidates.push({
            dedupe_key: `eonet:${e.id}`,
            severity: isFire ? 'critical' : 'warning',
            kind: 'hazard',
            title: `${isFire ? 'Wildfire' : 'Natural event'} ${Math.round(dist)} km from your fleet`,
            detail: `${e.title}. Source: NASA EONET${e.sources?.[0]?.url ? ` — verify: ${e.sources[0].url}` : ''}`,
            subject: e.id,
            source: { lat: pos.lat, lng: pos.lng, category: cat, distance_km: Math.round(dist) },
          });
        }
      }
    } catch { /* feed unreachable — sweep continues */ }

    // ---- Significant earthquakes near the fleet (USGS) ----
    try {
      const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson');
      const data = await res.json();
      for (const f of data.features ?? []) {
        const [lng, lat] = f.geometry.coordinates;
        const dist = haversine(centroid, { lat, lng });
        if (dist <= HAZARD_RADIUS_KM) {
          const mag = f.properties.mag;
          candidates.push({
            dedupe_key: `quake:${f.id}`,
            severity: mag >= 6 || f.properties.tsunami === 1 ? 'critical' : 'warning',
            kind: 'seismic',
            title: `M${mag} earthquake ${Math.round(dist)} km from your fleet`,
            detail: `${f.properties.place ?? 'Location unknown'}${f.properties.tsunami === 1 ? ' — TSUNAMI SIGNAL ISSUED' : ''}. Verify: ${f.properties.url}`,
            subject: f.id,
            source: { lat, lng, mag, distance_km: Math.round(dist) },
          });
        }
      }
    } catch { /* feed unreachable */ }

    // ---- Fire weather at the fleet centroid (Open-Meteo) ----
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${centroid.lat.toFixed(3)}&longitude=${centroid.lng.toFixed(3)}` +
        `&current=temperature_2m,relative_humidity_2m,wind_speed_10m`
      );
      const w = (await res.json()).current;
      if (w && w.temperature_2m > 28 && w.relative_humidity_2m < 30 && w.wind_speed_10m > 30) {
        const day = new Date().toISOString().slice(0, 10);
        candidates.push({
          dedupe_key: `fireweather:${day}`,
          severity: 'warning',
          kind: 'weather',
          title: 'Fire weather conditions at your fleet location',
          detail: `${w.temperature_2m}°C, ${w.relative_humidity_2m}% humidity, wind ${w.wind_speed_10m} km/h. Heightened ignition and spread risk today. Source: Open-Meteo.`,
          source: { ...w, day },
        });
      }
    } catch { /* feed unreachable */ }
  }

  // ---- Invitations expiring within 48h ----
  for (const inv of invites ?? []) {
    const msLeft = new Date(inv.expires_at) - Date.now();
    if (msLeft > 0 && msLeft < 48 * 60 * 60 * 1000) {
      candidates.push({
        dedupe_key: `invite-expiry:${inv.id}`, severity: 'info', kind: 'admin',
        title: `Invitation ${inv.code} expires soon`,
        detail: `The ${inv.role} invitation${inv.email ? ` for ${inv.email}` : ''} expires ${new Date(inv.expires_at).toLocaleString()}.`,
        subject: inv.id,
      });
    }
  }

  // ---- Raise fresh items (dedupe against live ones) ----
  const { data: existing } = await supabase
    .from('attention_items')
    .select('id, dedupe_key, status')
    .neq('status', 'resolved');
  const liveKeys = new Set((existing ?? []).map(i => i.dedupe_key));
  const fresh = candidates.filter(c => !liveKeys.has(c.dedupe_key));

  let raised = 0;
  for (const c of fresh) {
    const { error } = await supabase.from('attention_items').insert({ org_id: orgId, ...c });
    if (!error) {
      raised++;
      logEvent('attention.raised', { severity: c.severity, kind: c.kind, title: c.title }, c.dedupe_key);
    }
  }

  // ---- Auto-resolve device conditions that cleared ----
  const currentDeviceKeys = new Set(candidates.filter(c => c.dedupe_key.startsWith('device-')).map(c => c.dedupe_key));
  const cleared = (existing ?? []).filter(
    i => i.dedupe_key.startsWith('device-') && !currentDeviceKeys.has(i.dedupe_key)
  );
  if (cleared.length) {
    await supabase.from('attention_items').update({ status: 'resolved' }).in('id', cleared.map(i => i.id));
  }

  return { raised };
}

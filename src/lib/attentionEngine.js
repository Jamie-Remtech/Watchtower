import { supabase, isSupabaseConfigured } from './supabase';
import { logEvent } from './eventLog';
import { pushToTeam } from './push';

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

// Initial bearing a -> b in degrees (0 = north)
const bearing = (a, b) => {
  const φ1 = (a.lat * Math.PI) / 180, φ2 = (b.lat * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

const angleDiff = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

// Default watch ranges — admins can override per-org in Settings
const DEFAULT_HAZARD_RADIUS_KM = 300;   // seismic / general events
const DEFAULT_WILDFIRE_RADIUS_KM = 150; // wildfires: tighter, more serious

export async function runAttentionSweep() {
  if (!isSupabaseConfigured) return { raised: 0 };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { raised: 0 };
  const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
  const orgId = prof?.org_id;
  if (!orgId) return { raised: 0 };

  const { data: devices } = await supabase.from('devices').select('*');
  const { data: invites } = await supabase.from('invitations').select('*').eq('status', 'pending');

  // Org-configurable watch ranges (Settings → Organization)
  let WILDFIRE_RADIUS_KM = DEFAULT_WILDFIRE_RADIUS_KM;
  let HAZARD_RADIUS_KM = DEFAULT_HAZARD_RADIUS_KM;
  try {
    const { data: org } = await supabase.from('organizations').select('settings').limit(1).single();
    const s = org?.settings ?? {};
    if (Number.isFinite(+s.wildfire_radius_km) && +s.wildfire_radius_km > 0) WILDFIRE_RADIUS_KM = +s.wildfire_radius_km;
    if (Number.isFinite(+s.hazard_radius_km) && +s.hazard_radius_km > 0) HAZARD_RADIUS_KM = +s.hazard_radius_km;
  } catch { /* settings column absent — defaults apply */ }

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

  // ---- Anchors for proximity rules: the device fleet's centroid PLUS
  // every crew member's fresh live position. Hazards are judged by the
  // nearest anchor — the engine watches around PEOPLE, not just gear.
  const placed = (devices ?? []).filter(d => d.lat != null && d.lng != null);
  const anchors = [];
  if (placed.length) {
    anchors.push({
      lat: placed.reduce((a, d) => a + d.lat, 0) / placed.length,
      lng: placed.reduce((a, d) => a + d.lng, 0) / placed.length,
    });
  }
  if (anchors[0]) anchors[0].label = 'device fleet';
  try {
    const [{ data: fixes }, { data: profs }] = await Promise.all([
      supabase.from('positions').select('profile_id, lat, lng, at').order('at', { ascending: false }).limit(100),
      supabase.from('profiles').select('id, display_name'),
    ]);
    const nameOf = Object.fromEntries((profs ?? []).map(p => [p.id, p.display_name]));
    const seen = new Set();
    for (const p of fixes ?? []) {
      if (seen.has(p.profile_id) || Date.now() - new Date(p.at) > 15 * 60 * 1000) continue;
      seen.add(p.profile_id);
      anchors.push({ lat: p.lat, lng: p.lng, label: nameOf[p.profile_id] ?? 'crew member' });
    }
  } catch { /* positions unavailable — fleet anchor still works */ }

  const nearbyFires = [];
  const nearbyQuakes = [];

  const nearestDist = (pos) => Math.min(...anchors.map(a => haversine(a, pos)));
  const centroid = anchors[0] ?? null;

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
        const dist = nearestDist(pos);
        const cat = e.categories?.[0]?.id;
        const isFire = cat === 'wildfires';
        const radius = isFire ? WILDFIRE_RADIUS_KM : HAZARD_RADIUS_KM;
        if (dist <= radius) {
          if (isFire) nearbyFires.push({ id: e.id, title: e.title, lat: pos.lat, lng: pos.lng, dist });
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
        const dist = nearestDist({ lat, lng });
        if (dist <= HAZARD_RADIUS_KM) {
          const mag = f.properties.mag;
          nearbyQuakes.push({ id: f.id, place: f.properties.place, mag, lat, lng, dist });
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

  // ---- CASCADE LAYER 1 (geometric, always on): downwind of a fire ----
  // Wind at each nearby fire; if it blows toward an anchor within the
  // wind's plausible reach, that person gets a critical warning.
  let fireWeather = [];
  if (nearbyFires.length && anchors.length) {
    try {
      const fires = nearbyFires.slice(0, 8);
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${fires.map(f => f.lat.toFixed(2)).join(',')}` +
        `&longitude=${fires.map(f => f.lng.toFixed(2)).join(',')}&current=wind_speed_10m,wind_direction_10m,relative_humidity_2m,temperature_2m`
      );
      const j = await res.json();
      const rows = Array.isArray(j) ? j : [j];
      fireWeather = fires.map((f, i) => ({ ...f, wx: rows[i]?.current ?? null }));
      for (const f of fireWeather) {
        if (!f.wx || f.wx.wind_speed_10m == null) continue;
        const windTo = (f.wx.wind_direction_10m + 180) % 360;
        const reach = Math.min(80, 15 + f.wx.wind_speed_10m * 2.5); // km, scales with wind
        for (const a of anchors) {
          const d = haversine(f, a);
          const brg = bearing(f, a);
          if (d <= reach && angleDiff(windTo, brg) <= 50) {
            candidates.push({
              dedupe_key: `downwind:${f.id}:${a.label}`,
              severity: 'critical',
              kind: 'cascade',
              title: `${a.label} is DOWNWIND of ${f.title} (${Math.round(d)} km)`,
              detail: `Wind ${Math.round(f.wx.wind_speed_10m)} km/h blowing from the fire toward this position (fire humidity ${f.wx.relative_humidity_2m}%, ${f.wx.temperature_2m}°C). Spread direction favors approach — reassess position and escape routes.`,
              source: { fire: f.title, wind_kmh: f.wx.wind_speed_10m, wind_to: windTo, distance_km: Math.round(d) },
            });
            break; // one item per fire per sweep is enough
          }
        }
      }
    } catch { /* wind sampling unavailable */ }
  }

  // ---- CASCADE LAYER 2 (AI analysis): secondary and chained risks ----
  // Claude examines the whole threat picture around each person —
  // spread setups, post-seismic slides/mudflows, storm-flood chains.
  // Throttled: runs when the picture changes or every 30 minutes.
  if ((nearbyFires.length || nearbyQuakes.length) && anchors.length) {
    try {
      const picture = {
        anchors: anchors.map(a => ({ label: a.label, lat: +a.lat.toFixed(3), lng: +a.lng.toFixed(3) })),
        fires: fireWeather.length ? fireWeather.map(f => ({ title: f.title, lat: f.lat, lng: f.lng, dist_km: Math.round(f.dist), weather: f.wx }))
          : nearbyFires.map(f => ({ title: f.title, lat: f.lat, lng: f.lng, dist_km: Math.round(f.dist) })),
        quakes: nearbyQuakes.map(q => ({ place: q.place, mag: q.mag, lat: q.lat, lng: q.lng, dist_km: Math.round(q.dist) })),
      };
      const hash = JSON.stringify(picture);
      let last = null;
      try { last = JSON.parse(localStorage.getItem('wt-cascade-last') ?? 'null'); } catch { /* fresh */ }
      const changed = !last || last.hash !== hash;
      const stale = !last || Date.now() - last.at > 30 * 60 * 1000;
      if (changed || stale) {
        localStorage.setItem('wt-cascade-last', JSON.stringify({ hash, at: Date.now() }));
        const { data } = await supabase.functions.invoke('field-assist', {
          body: { mode: 'cascade', picture },
        });
        for (const w of data?.warnings ?? []) {
          if (!w?.title) continue;
          candidates.push({
            dedupe_key: `cascade:${(w.key ?? w.title).slice(0, 80)}`,
            severity: ['critical', 'warning', 'info'].includes(w.severity) ? w.severity : 'warning',
            kind: 'cascade',
            title: w.title.slice(0, 140),
            detail: `${(w.detail ?? '').slice(0, 400)} — AI cascade analysis; verify before acting.`,
          });
        }
      }
    } catch { /* AI not configured or unreachable — geometric layer still ran */ }
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
      // Critical anomalies reach pockets, not just open apps
      if (c.severity === 'critical') {
        pushToTeam({ kind: 'attention', title: `⚠ ${c.title}`, body: c.detail?.slice(0, 140) ?? '', url: '/', tag: c.dedupe_key });
      }
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

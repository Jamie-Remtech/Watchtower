import { supabase, isSupabaseConfigured } from './supabase';

// ============================================
// AI CONTEXT SNAPSHOT
// Gathers the live operational state the assistant is allowed to see —
// through the user's own session, so RLS applies exactly as it does in
// the UI. Compact by design: the AI answers from THIS, nothing else.
// ============================================

const quickPosition = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 3500, maximumAge: 120000 }
    );
  });

export async function gatherContext() {
  if (!isSupabaseConfigured) return null;

  const [me, org, devices, patients, positions, markers, attention, events, views, protocols, activeRuns] = await Promise.all([
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return null;
      const { data } = await supabase.from('profiles').select('display_name, role, callsign').eq('id', user.id).single();
      return data;
    }),
    supabase.from('organizations').select('name, region').limit(1).single().then(r => r.data),
    supabase.from('devices').select('name, kind, status, lat, lng').then(r => r.data ?? []),
    supabase.from('patients').select('num, tag, triage, status, lat, lng, created_at').then(r => r.data ?? []),
    supabase.from('positions').select('profile_id, lat, lng, at').order('at', { ascending: false }).limit(100).then(r => r.data ?? []),
    supabase.from('markers').select('kind, label, notes, lat, lng, created_at').then(r => r.data ?? []),
    supabase.from('attention_items').select('severity, kind, title, status').neq('status', 'resolved').then(r => r.data ?? []),
    supabase.from('events').select('type, subject, payload, at')
      .in('type', ['field.report', 'patient.entry']).order('at', { ascending: false }).limit(15).then(r => r.data ?? []),
    supabase.from('map_views').select('name, lat, lng').then(r => r.data ?? []),
    supabase.from('protocols').select('name, trigger_kind, description').then(r => r.data ?? []),
    supabase.from('protocol_runs').select('name, status, steps, started_at').eq('status', 'active').then(r => r.data ?? []),
  ]);

  // Latest fresh position per person, with names
  const { data: profiles } = await supabase.from('profiles').select('id, display_name');
  const nameOf = Object.fromEntries((profiles ?? []).map(p => [p.id, p.display_name]));
  const seen = new Set();
  const crew = [];
  for (const p of positions) {
    if (seen.has(p.profile_id) || Date.now() - new Date(p.at) > 15 * 60 * 1000) continue;
    seen.add(p.profile_id);
    crew.push({ name: nameOf[p.profile_id] ?? 'member', lat: p.lat, lng: p.lng, at: p.at });
  }

  const myPos = await quickPosition();

  // Live weather where the user stands (or at the org's first asset)
  let weather = null;
  const wxAt = myPos ?? (devices.find(d => d.lat != null) ?? crew[0] ?? null);
  if (wxAt) {
    try {
      const r = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${wxAt.lat}&longitude=${wxAt.lng}` +
        `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,weather_code&timezone=auto`
      );
      weather = (await r.json()).current ?? null;
    } catch { /* weather optional */ }
  }

  return {
    now: new Date().toISOString(),
    user: me ? { name: me.display_name, role: me.role, position: myPos } : null,
    organization: org,
    devices,
    patients,
    crew_positions: crew,
    markers,
    attention_open: attention,
    recent_field_log: events.map(e => ({ at: e.payload?.at_client ?? e.at, text: e.payload?.text, patient: e.subject ? 'yes' : null })),
    saved_views: views,
    weather_at_user: weather,
    available_protocols: protocols,
    active_protocol_runs: activeRuns.map(r => ({
      name: r.name, started_at: r.started_at,
      progress: `${(r.steps ?? []).filter(s => s.done).length}/${(r.steps ?? []).length} steps`,
    })),
  };
}

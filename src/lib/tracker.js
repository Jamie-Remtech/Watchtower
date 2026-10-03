import { supabase, isSupabaseConfigured } from './supabase';
import { linkSnapshot, reportRequest } from './link';

// Positions that could not be sent are where the signal was lost: keep
// them (bounded) and upload them once back in coverage — dead zones
// belong on the coverage map too.
const GAPS_KEY = 'wt-link-gaps';
const MAX_GAPS = 400;
const readGaps = () => { try { return JSON.parse(localStorage.getItem(GAPS_KEY) ?? '[]'); } catch { return []; } };
const rememberGap = (row) => {
  try {
    const gaps = readGaps();
    const last = gaps.at(-1);
    if (last && Date.parse(row.at) - Date.parse(last.at) < 60000) return; // one per minute is enough
    localStorage.setItem(GAPS_KEY, JSON.stringify([...gaps, row].slice(-MAX_GAPS)));
  } catch { /* storage full or unavailable */ }
};
let flushing = false;
const flushGaps = async () => {
  if (flushing) return;
  const gaps = readGaps();
  if (!gaps.length) return;
  flushing = true;
  const { error } = await supabase.from('positions').insert(gaps.slice(0, 200));
  if (!error) { try { localStorage.setItem(GAPS_KEY, JSON.stringify(gaps.slice(200))); } catch { /* ignore */ } }
  flushing = false;
};

// ============================================
// AUTOMATIC POSITION TRACKING (singleton)
// Operational roles are tracked automatically while the app is open —
// no toggles to remember. One GPS watcher for the whole app, throttled
// inserts into the positions table. Pause is explicit and remembered
// on this device; viewers are never tracked (see App wiring).
// ============================================

const PAUSE_KEY = 'watchtower-track-paused';
const ORG_KEY = 'watchtower-org-id';
const SEND_MIN_MS = 15 * 1000;

let watchId = null;
let lastSentAt = 0;
let lastCoords = null; // { lat, lng, at } — the newest fix this device saw
let state = { active: false, lastFix: null, error: null };

// Newest position this device knows, if not older than maxAgeMs.
export const getLastCoords = (maxAgeMs = 15 * 60 * 1000) =>
  lastCoords && Date.now() - lastCoords.at < maxAgeMs ? lastCoords : null;
const listeners = new Set();
const emit = () => listeners.forEach(fn => fn({ ...state }));

export const subscribeTracker = (fn) => {
  listeners.add(fn);
  fn({ ...state });
  return () => listeners.delete(fn);
};

export const isTrackingPaused = () => {
  try { return localStorage.getItem(PAUSE_KEY) === '1'; } catch { return false; }
};

export async function startTracking() {
  if (!isSupabaseConfigured || watchId != null || !navigator.geolocation) return;
  try { localStorage.removeItem(PAUSE_KEY); } catch { /* storage unavailable */ }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  let orgId = localStorage.getItem(ORG_KEY);
  if (!orgId) {
    const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
    orgId = prof?.org_id;
    if (orgId) localStorage.setItem(ORG_KEY, orgId);
  }
  if (!orgId) return;

  state = { ...state, active: true, error: null };
  emit();

  watchId = navigator.geolocation.watchPosition(
    async (pos) => {
      const now = Date.now();
      lastCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude, at: now };
      if (now - lastSentAt < SEND_MIN_MS) return;
      lastSentAt = now;
      const row = {
        org_id: orgId,
        profile_id: user.id,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        ...linkSnapshot(),
      };
      const t0 = performance.now();
      let error;
      try { ({ error } = await supabase.from('positions').insert(row)); } catch (e) { error = e; }
      reportRequest(performance.now() - t0, !error);
      if (!error) {
        state = { ...state, lastFix: new Date(), error: null };
        emit();
        flushGaps();
      } else {
        rememberGap({ ...row, at: new Date(now).toISOString(), net_quality: 'offline' });
      }
    },
    (err) => {
      state = {
        active: false,
        lastFix: state.lastFix,
        error: err.code === 1 ? 'Location permission denied — allow it in your browser settings' : 'Position unavailable',
      };
      if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
      emit();
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
  );
}

export function pauseTracking() {
  if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  try { localStorage.setItem(PAUSE_KEY, '1'); } catch { /* storage unavailable */ }
  state = { ...state, active: false, error: null };
  emit();
}

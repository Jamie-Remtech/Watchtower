import { supabase, isSupabaseConfigured } from './supabase';

// ============================================
// LINK QUALITY (singleton) — how well this device reaches Watchtower.
// Web apps cannot read signal bars, so we measure what matters: real
// round trips to Watchtower (probes + every position upload), whether
// requests succeed, and the browser's own connection estimate where it
// exists (Chrome/Android: effectiveType, downlink, type).
// ============================================

const PROBE_MS = 30 * 1000;
const SAMPLES = 5;

const conn = () => (typeof navigator !== 'undefined' ? navigator.connection ?? navigator.mozConnection ?? navigator.webkitConnection : null);

let rtts = [];
let failures = 0;
let lastOkAt = null;
let timer = null;
const listeners = new Set();
let state = compute();

const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

// good | fair | poor | offline — from what was actually measured first,
// the browser's estimate only as a tiebreaker
export function qualityOf({ online = true, rtt = null, effective = null, failures: fails = 0 } = {}) {
  if (!online || fails >= 3) return 'offline';
  if (fails >= 1 || (rtt != null && rtt > 2000) || effective === 'slow-2g' || effective === '2g') return 'poor';
  if ((rtt != null && rtt > 700) || effective === '3g') return 'fair';
  return 'good';
}

function compute() {
  const c = conn();
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  const rtt = median(rtts);
  const effective = c?.effectiveType ?? null;
  return {
    online, rtt, effective, failures, lastOkAt,
    type: c?.type ?? null,
    downlink: typeof c?.downlink === 'number' ? c.downlink : null,
    quality: qualityOf({ online, rtt, effective, failures }),
    at: Date.now(),
  };
}

const emit = () => { state = compute(); listeners.forEach(fn => fn(state)); };

// Every timed request to Watchtower feeds the measurement
export function reportRequest(ms, ok) {
  if (ok) {
    rtts = [...rtts, Math.round(ms)].slice(-SAMPLES);
    failures = 0;
    lastOkAt = Date.now();
  } else {
    failures += 1;
  }
  emit();
}

async function probe() {
  if (!isSupabaseConfigured || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
  if (!navigator.onLine) { failures += 1; emit(); return; }
  const t0 = performance.now();
  try {
    const { error } = await supabase.from('system_heartbeats').select('name').limit(1);
    reportRequest(performance.now() - t0, !error);
  } catch {
    reportRequest(performance.now() - t0, false);
  }
}

export function startLinkMonitor() {
  if (timer) return;
  window.addEventListener('online', () => { probe(); emit(); });
  window.addEventListener('offline', () => { failures = Math.max(failures, 3); emit(); });
  conn()?.addEventListener?.('change', emit);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') probe(); });
  probe();
  timer = setInterval(probe, PROBE_MS);
}

export const getLink = () => state;
export const subscribeLink = (fn) => {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
};

// What a position report carries
export const linkSnapshot = () => ({
  net_quality: state.quality,
  net_rtt_ms: state.rtt,
  net_effective: state.effective,
  net_type: state.type,
  net_downlink: state.downlink,
});

// Quality of someone else's link from their latest position report:
// a silent device is itself the signal
export function memberLink(pos, now = Date.now()) {
  if (!pos) return { quality: 'unknown', ageMin: null };
  const ageMin = (now - Date.parse(pos.at)) / 60000;
  if (ageMin > 10) return { quality: 'lost', ageMin, rtt: pos.net_rtt_ms, effective: pos.net_effective, type: pos.net_type };
  return { quality: pos.net_quality ?? 'unknown', ageMin, rtt: pos.net_rtt_ms, effective: pos.net_effective, type: pos.net_type };
}

export const QUALITY_STYLE = {
  good: { dot: '#22c55e', text: 'text-green-300', bg: 'bg-green-500/15 border-green-500/40', bars: 3 },
  fair: { dot: '#eab308', text: 'text-yellow-300', bg: 'bg-yellow-500/15 border-yellow-500/40', bars: 2 },
  poor: { dot: '#f97316', text: 'text-orange-300', bg: 'bg-orange-500/15 border-orange-500/40', bars: 1 },
  offline: { dot: '#ef4444', text: 'text-red-300', bg: 'bg-red-500/15 border-red-500/40', bars: 0 },
  lost: { dot: '#ef4444', text: 'text-red-300', bg: 'bg-red-500/15 border-red-500/40', bars: 0 },
  unknown: { dot: '#64748b', text: 'text-slate-400', bg: 'bg-slate-800/60 border-slate-700', bars: 0 },
};

// ============================================
// NOTIFICATION PREFERENCES — one model for every sender.
// Each push carries a category + severity; each person decides which
// categories reach them, the minimum severity, and their sound.
// Hard rule (mirrored in push-notify and tower-sweep): check-ins and
// critical alerts are never dropped — a muted category only makes a
// critical arrive silently.
// ============================================

export const CATEGORIES = [
  { id: 'hazard', label: 'Hazards', desc: 'Wildfires, earthquakes, cascade warnings' },
  { id: 'weather', label: 'Weather', desc: 'Radar, rain nowcast, forward outlook' },
  { id: 'comms', label: 'Messages', desc: 'Team chat in Comms' },
  { id: 'protocols', label: 'Protocols', desc: 'Playbook runs started for the team' },
  { id: 'briefs', label: 'Daily brief', desc: 'Your morning forecast at your position' },
];

export const LEVELS = [
  { id: 'all', label: 'Everything', desc: 'Info, warnings and criticals' },
  { id: 'warnings', label: 'Warnings and up', desc: 'Skip informational items' },
  { id: 'critical', label: 'Criticals only', desc: 'Only life-safety alerts' },
];

export const SOUNDS = [
  { id: 'standard', label: 'Standard', desc: 'Two-tone alert' },
  { id: 'siren', label: 'Watchtower siren', desc: 'Rising sweep, impossible to miss' },
  { id: 'chime', label: 'Chime', desc: 'Soft three-note bell' },
  { id: 'pulse', label: 'Pulse', desc: 'Short rapid beeps' },
  { id: 'vibrate', label: 'Vibrate only', desc: 'No sound in the app' },
];

// Vibration pattern sent with pushes — the part of "your sound" a
// closed-app web notification can honour on Android today.
export const VIBRATE = {
  standard: [200, 100, 200, 100, 400],
  siren: [600, 150, 600, 150, 600],
  chime: [150, 80, 150],
  pulse: [80, 60, 80, 60, 80, 60, 80],
  vibrate: [300, 120, 300],
};

export const DEFAULT_PREFS = {
  categories: { hazard: true, weather: true, comms: true, protocols: true, briefs: true },
  level: 'all',
  sound: 'standard',
};

export const withDefaults = (prefs) => ({
  ...DEFAULT_PREFS,
  ...(prefs ?? {}),
  categories: { ...DEFAULT_PREFS.categories, ...(prefs?.categories ?? {}) },
});

const RANK = { info: 0, warning: 1, critical: 2 };
const LEVEL_MIN = { all: 0, warnings: 1, critical: 2 };

// → { deliver, silent }
export function shouldDeliver(rawPrefs, category, severity) {
  const prefs = withDefaults(rawPrefs);
  if (category === 'checkin') return { deliver: true, silent: false };
  const enabled = prefs.categories[category] !== false;
  if (severity === 'critical') return { deliver: true, silent: !enabled };
  if (!enabled) return { deliver: false, silent: true };
  if ((RANK[severity] ?? 0) < (LEVEL_MIN[prefs.level] ?? 0)) return { deliver: false, silent: true };
  return { deliver: true, silent: false };
}

// Attention item kind → notification category
export const categoryOfItem = (item) => {
  if (!item) return 'hazard';
  if (item.kind === 'weather') return String(item.dedupe_key ?? '').startsWith('brief:') ? 'briefs' : 'weather';
  return 'hazard';
};

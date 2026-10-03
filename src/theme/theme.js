import { useEffect, useState } from 'react';

// Appearance: a theme (which set of colour variables tailwind.config.js
// defines) plus an accent colour that replaces the orange scale.
// Saved per device; index.html applies it before the app loads so
// there is no flash of the wrong theme.

export const THEMES = [
  { id: 'system', swatch: ['#0f172a', '#f8fafc'] },
  { id: 'dark', swatch: ['#020617', '#1e293b'] },
  { id: 'light', swatch: ['#f8fafc', '#e2e8f0'] },
  { id: 'night', swatch: ['#000000', '#7f1d1d'] },
  { id: 'contrast', swatch: ['#000000', '#ffffff'] },
  { id: 'sunlight', swatch: ['#ffffff', '#000000'] },
];
export const ACCENTS = [
  { id: 'orange', hex: '#f97316' }, { id: 'red', hex: '#ef4444' }, { id: 'amber', hex: '#f59e0b' },
  { id: 'green', hex: '#22c55e' }, { id: 'teal', hex: '#14b8a6' }, { id: 'sky', hex: '#0ea5e9' },
  { id: 'blue', hex: '#3b82f6' }, { id: 'violet', hex: '#8b5cf6' }, { id: 'pink', hex: '#ec4899' },
];
export const DEFAULT_APPEARANCE = { theme: 'dark', accent: 'orange', custom: null };

const KEY = 'wt-theme';
const VARS_KEY = 'wt-theme-vars';
const LIGHT = new Set(['light', 'sunlight']);
const META = { dark: '#0f172a', light: '#f8fafc', night: '#000000', contrast: '#000000', sunlight: '#ffffff' };
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const TINT = { 50: 0.92, 100: 0.84, 200: 0.68, 300: 0.5, 400: 0.26, 500: 0, 600: 0.16, 700: 0.32, 800: 0.46, 900: 0.58, 950: 0.72 };

export const loadAppearance = () => {
  try { return { ...DEFAULT_APPEARANCE, ...(JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? {}) }; }
  catch { return { ...DEFAULT_APPEARANCE }; }
};
export const hasLocalAppearance = () => {
  try { return localStorage.getItem(KEY) != null; } catch { return false; }
};

const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
export const resolveTheme = (theme) => (theme === 'system' ? (systemDark() ? 'dark' : 'light') : theme);

// An 11-step scale around one colour: tints toward white, shades toward black
export function scaleFrom(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const base = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return Object.fromEntries(SHADES.map(s => {
    const t = TINT[s];
    const to = s < 500 ? 255 : 0;
    return [s, base.map(c => Math.round(c + (to - c) * t)).join(' ')];
  }));
}

function accentVars(appearance, resolved) {
  const hex = appearance.custom || ACCENTS.find(a => a.id === appearance.accent)?.hex;
  if (!hex || (!appearance.custom && appearance.accent === 'orange')) return {};
  const scale = scaleFrom(hex);
  const flip = LIGHT.has(resolved);
  return Object.fromEntries(SHADES.map((s, i) => [`--c-orange-${s}`, scale[flip ? SHADES[SHADES.length - 1 - i] : s]]));
}

export function applyAppearance(appearance) {
  const root = document.documentElement;
  const resolved = resolveTheme(appearance.theme);
  root.dataset.theme = resolved;
  for (const s of SHADES) root.style.removeProperty(`--c-orange-${s}`);
  const vars = accentVars(appearance, resolved);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META[resolved] ?? META.dark);
  try { localStorage.setItem(VARS_KEY, JSON.stringify(vars)); } catch { /* storage unavailable */ }
  return resolved;
}

export function saveAppearance(appearance) {
  try { localStorage.setItem(KEY, JSON.stringify(appearance)); } catch { /* storage unavailable */ }
  applyAppearance(appearance);
  window.dispatchEvent(new Event('wt-appearance'));
}

// Current appearance; re-applies when the device switches light/dark
// and the member chose "follow my device".
export function useAppearance() {
  const [appearance, setAppearance] = useState(loadAppearance);
  useEffect(() => {
    const onChange = () => setAppearance(loadAppearance());
    window.addEventListener('wt-appearance', onChange);
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onSystem = () => { const a = loadAppearance(); if (a.theme === 'system') applyAppearance(a); };
    mq?.addEventListener?.('change', onSystem);
    return () => { window.removeEventListener('wt-appearance', onChange); mq?.removeEventListener?.('change', onSystem); };
  }, []);
  return appearance;
}

import colors from 'tailwindcss/colors';
import plugin from 'tailwindcss/plugin';

// Every colour the app uses is a CSS variable, so a theme is just a set
// of values (src/theme/). Dark is the reference; light-family themes
// mirror each scale (900 ↔ 100, text-*-300 ↔ *-700 …) so the same
// classes stay readable on light backgrounds.
const FAMILIES = ['slate', 'orange', 'green', 'red', 'purple', 'sky', 'yellow', 'blue', 'amber', 'cyan', 'rose', 'emerald', 'teal', 'pink', 'indigo', 'violet', 'lime', 'fuchsia', 'gray', 'zinc', 'stone'];
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};
const scaleVars = (invert) => Object.fromEntries(FAMILIES.flatMap(f => SHADES.map((s, i) => [
  `--c-${f}-${s}`, rgb(colors[f][invert ? SHADES[SHADES.length - 1 - i] : s]),
])));
const slate = (map) => Object.fromEntries(Object.entries(map).map(([s, hex]) => [`--c-slate-${s}`, rgb(hex)]));

const themed = Object.fromEntries(FAMILIES.map(f => [f, Object.fromEntries(
  SHADES.map(s => [s, `rgb(var(--c-${f}-${s}) / <alpha-value>)`]),
)]));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    colors: {
      inherit: 'inherit', current: 'currentColor', transparent: 'transparent',
      black: '#000',
      white: 'rgb(var(--c-white) / <alpha-value>)',
      paper: '#fff', // stays white in every theme (QR codes need a light quiet zone)
      ...themed,
    },
    extend: {
      // phones held sideways (and short cab screens): tighten vertical chrome
      screens: { short: { raw: '(max-height: 500px)' } },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      const S = colors.slate;
      addBase({
        ':root, [data-theme="dark"], [data-theme="night"]': { ...scaleVars(false), '--c-white': '255 255 255', 'color-scheme': 'dark' },
        '[data-theme="light"]': { ...scaleVars(true), '--c-white': rgb(S[900]), 'color-scheme': 'light' },
        // high contrast: pure black ground, brighter text and edges
        '[data-theme="contrast"]': {
          ...scaleVars(false), '--c-white': '255 255 255', 'color-scheme': 'dark',
          ...slate({ 950: '#000000', 900: '#0a0d14', 800: '#1c2433', 700: '#64748b', 600: '#94a3b8', 500: '#cbd5e1', 400: '#e2e8f0', 300: '#f1f5f9', 200: '#ffffff', 100: '#ffffff', 50: '#ffffff' }),
        },
        // bright outdoor light: white ground, near-black text, firm borders
        '[data-theme="sunlight"]': {
          ...scaleVars(true), '--c-white': '0 0 0', 'color-scheme': 'light',
          ...slate({ 950: '#ffffff', 900: '#f8fafc', 800: '#eef2f7', 700: '#94a3b8', 600: '#1e293b', 500: '#334155', 400: '#1e293b', 300: '#0f172a', 200: '#020617', 100: '#000000', 50: '#000000' }),
        },
      });
    }),
  ],
}

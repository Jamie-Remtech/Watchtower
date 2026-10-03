// ============================================
// FORECAST LOGIC shared by the Forecasts tab.
// Thresholds mirror tower-sweep's forward outlook exactly, so what a
// coordinator reads here is what the tower will push about.
// ============================================

export const WX = {
  0: ['Clear', '☀️'], 1: ['Mostly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'], 48: ['Icy fog', '🌫️'],
  51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌧️'],
  61: ['Light rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
  66: ['Freezing rain', '🧊'], 67: ['Heavy freezing rain', '🧊'],
  71: ['Light snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '❄️'], 77: ['Snow grains', '🌨️'],
  80: ['Rain showers', '🌦️'], 81: ['Showers', '🌧️'], 82: ['Violent showers', '⛈️'],
  85: ['Snow showers', '🌨️'], 86: ['Heavy snow showers', '❄️'],
  95: ['Thunderstorms', '⛈️'], 96: ['Thunderstorms, hail', '⛈️'], 99: ['Severe storms, hail', '⛈️'],
};
export const wxLabel = (code) => WX[code]?.[0] ?? 'Conditions';
export const wxIcon = (code) => WX[code]?.[1] ?? '🌡️';

// Day-level hazard flags — same numbers as tower-sweep
export function dayFlags(d, k) {
  const gust = d.wind_gusts_10m_max?.[k] ?? 0;
  const rain = d.precipitation_sum?.[k] ?? 0;
  const prob = d.precipitation_probability_max?.[k] ?? 0;
  const tmax = d.temperature_2m_max?.[k];
  const tmin = d.temperature_2m_min?.[k];
  const code = d.weather_code?.[k] ?? 0;
  const f = [];
  if (gust >= 90) f.push({ tag: 'wind', sev: 'critical', text: `Damaging gusts ${Math.round(gust)} km/h` });
  else if (gust >= 70) f.push({ tag: 'wind', sev: 'warning', text: `Strong gusts ${Math.round(gust)} km/h` });
  if (rain >= 50) f.push({ tag: 'rain', sev: 'critical', text: `Flood-level rain ~${Math.round(rain)} mm` });
  else if (rain >= 25) f.push({ tag: 'rain', sev: 'warning', text: `Heavy rain ~${Math.round(rain)} mm` });
  if (tmax != null && tmax >= 38) f.push({ tag: 'heat', sev: 'critical', text: `Extreme heat ${Math.round(tmax)}°C` });
  else if (tmax != null && tmax >= 33) f.push({ tag: 'heat', sev: 'warning', text: `Heat ${Math.round(tmax)}°C` });
  if (tmin != null && tmin <= -30) f.push({ tag: 'cold', sev: 'critical', text: `Extreme cold ${Math.round(tmin)}°C` });
  else if (tmin != null && tmin <= -22) f.push({ tag: 'cold', sev: 'warning', text: `Severe cold ${Math.round(tmin)}°C` });
  if (code >= 95 && prob >= 60) f.push({ tag: 'tstorm', sev: gust >= 80 ? 'critical' : 'warning', text: 'Thunderstorm day' });
  return f;
}

const DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset';

export async function pointForecast(lat, lng) {
  const r = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code,precipitation` +
    `&hourly=temperature_2m,precipitation,precipitation_probability,wind_gusts_10m,weather_code` +
    `&daily=${DAILY}&forecast_days=7&forecast_hours=48&timezone=auto`
  );
  if (!r.ok) throw new Error(`forecast service ${r.status}`);
  return r.json();
}

export async function multiDaily(points) {
  if (!points.length) return [];
  const r = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${points.map(p => p.lat.toFixed(3)).join(',')}` +
    `&longitude=${points.map(p => p.lng.toFixed(3)).join(',')}&daily=${DAILY}&forecast_days=3&timezone=auto`
  );
  if (!r.ok) throw new Error(`forecast service ${r.status}`);
  const j = await r.json();
  return Array.isArray(j) ? j : [j];
}

// ---------- seasonal: ECMWF ensemble vs the 1991–2020 normal ----------
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

async function normalsFor(lat, lng) {
  const key = `wt-normals:${lat.toFixed(1)},${lng.toFixed(1)}`;
  try {
    const hit = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (hit?.v === 1) return hit.months;
  } catch { /* recompute */ }
  const r = await fetch(
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}` +
    `&start_date=1991-01-01&end_date=2020-12-31&daily=temperature_2m_mean,precipitation_sum&timezone=auto`
  );
  if (!r.ok) throw new Error(`climate archive ${r.status}`);
  const d = (await r.json()).daily;
  const acc = Array.from({ length: 12 }, () => ({ t: 0, n: 0, p: 0 }));
  d.time.forEach((day, i) => {
    const m = Number(day.slice(5, 7)) - 1;
    const a = acc.at(m);
    if (d.temperature_2m_mean[i] != null) { a.t += d.temperature_2m_mean[i]; a.n++; }
    if (d.precipitation_sum[i] != null) a.p += d.precipitation_sum[i];
  });
  // mean temperature, and mean monthly precipitation total (30 years)
  const months = acc.map(a => ({ temp: a.n ? a.t / a.n : null, precip: a.p / 30 }));
  try { localStorage.setItem(key, JSON.stringify({ v: 1, months })); } catch { /* storage full */ }
  return months;
}

export async function seasonalOutlook(lat, lng) {
  const [sr, normals] = await Promise.all([
    fetch(`https://seasonal-api.open-meteo.com/v1/seasonal?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}` +
      `&daily=temperature_2m_mean,precipitation_sum&forecast_days=120&timezone=auto`).then(r => r.json()),
    normalsFor(lat, lng),
  ]);
  const d = sr?.daily;
  if (!d?.time) throw new Error(sr?.reason ?? 'seasonal service unavailable');
  const tKeys = Object.keys(d).filter(k => k.startsWith('temperature_2m_mean'));
  const pKeys = Object.keys(d).filter(k => k.startsWith('precipitation_sum'));
  const byMonth = new Map();
  d.time.forEach((day, i) => {
    const ym = day.slice(0, 7);
    const ts = tKeys.map(k => d[k][i]).filter(v => v != null);
    const ps = pKeys.map(k => d[k][i]).filter(v => v != null);
    const cur = byMonth.get(ym) ?? { t: 0, tn: 0, p: 0, days: 0 };
    if (ts.length) { cur.t += ts.reduce((a, b) => a + b, 0) / ts.length; cur.tn++; }
    if (ps.length) cur.p += ps.reduce((a, b) => a + b, 0) / ps.length;
    cur.days++;
    byMonth.set(ym, cur);
  });
  return [...byMonth.entries()]
    .filter(([, v]) => v.days >= 20) // whole-ish months only
    .slice(0, 3)
    .map(([ym, v]) => {
      const m = Number(ym.slice(5, 7)) - 1;
      const n = normals.at(m);
      const daysInMonth = new Date(Number(ym.slice(0, 4)), m + 1, 0).getDate();
      const temp = v.tn ? v.t / v.tn : null;
      const precip = v.p * (daysInMonth / v.days);
      return {
        month: `${MONTH.at(m)} ${ym.slice(0, 4)}`,
        temp, tempNormal: n?.temp ?? null,
        tempAnomaly: temp != null && n?.temp != null ? temp - n.temp : null,
        precip, precipNormal: n?.precip ?? null,
        precipRatio: n?.precip ? precip / n.precip : null,
      };
    });
}

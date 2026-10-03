import { useState, useEffect, useCallback } from 'react';
import { CloudSun, LocateFixed, Loader2, Users, Thermometer, Droplets, Wind, AlertTriangle, Waves, Sunrise, Sunset } from 'lucide-react';
import { ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useTeam } from '../hooks/useTeam';
import { usePositions } from '../hooks/usePositions';
import { pointForecast, multiDaily, seasonalOutlook, dayFlags, wxIcon, wxLabel } from '../lib/forecast';

// ============================================
// FORECASTS — reading time, not just seeing it.
// My day and week at my position · the team's 3-day outlook at each
// member's last known position (same thresholds the tower pushes on) ·
// the season ahead: NOAA's El Niño/La Niña state + the ECMWF seasonal
// ensemble against the 1991–2020 normal for this exact place.
// ============================================

const MY_LOCATION_KEY = 'watchtower-my-location';
const SEV = {
  critical: 'bg-red-500/15 text-red-300 border-red-500/40',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
};
const dayName = (iso, i) => (i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
  : new Date(`${iso}T12:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric' }));
const hhmm = (iso) => iso?.slice(11, 16) ?? '';
const ago = (iso) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} d ago`;
};

const Card = ({ title, icon: Icon, right, children }) => (
  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <h3 className="text-sm font-bold text-white flex items-center gap-2"><Icon className="w-4 h-4 text-orange-400" />{title}</h3>
      {right}
    </div>
    {children}
  </div>
);

export const ForecastsTab = () => {
  const { profile } = useAuth();
  const isViewer = !profile?.role || profile.role === 'viewer';
  const { liveMembers } = useTeam();
  const { latest: positions } = usePositions();

  const [pos, setPos] = useState(() => {
    try { return JSON.parse(localStorage.getItem(MY_LOCATION_KEY) ?? 'null'); } catch { return null; }
  });
  const [place, setPlace] = useState(null);
  const [mine, setMine] = useState(null);
  const [myErr, setMyErr] = useState(null);
  const [locating, setLocating] = useState(false);
  const [team, setTeam] = useState([]);
  const [enso, setEnso] = useState(null);
  const [season, setSeason] = useState(null);
  const [seasonErr, setSeasonErr] = useState(null);

  const locate = useCallback(() => {
    if (!navigator.geolocation) { setMyErr('This device cannot share its location'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(next);
        try { localStorage.setItem(MY_LOCATION_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
        setLocating(false);
      },
      () => { setMyErr('Location permission needed — tap the button and allow it'); setLocating(false); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  useEffect(() => { if (!pos) locate(); }, [pos, locate]);

  // My forecast + the place name
  useEffect(() => {
    if (!pos) return;
    let cancelled = false;
    setMyErr(null);
    pointForecast(pos.lat, pos.lng).then(d => { if (!cancelled) setMine(d); }).catch(e => setMyErr(e.message));
    fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.lat}&longitude=${pos.lng}&localityLanguage=en`)
      .then(r => r.json())
      .then(g => { if (!cancelled) setPlace([g.city || g.locality, g.principalSubdivision].filter(Boolean).join(', ')); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pos]);

  // Season ahead (ENSO from NOAA via the tower; local seasonal from ECMWF)
  useEffect(() => {
    supabase.functions.invoke('world-outlook').then(({ data }) => setEnso(data ?? null)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!pos) return;
    setSeason(null);
    setSeasonErr(null);
    seasonalOutlook(pos.lat, pos.lng).then(setSeason).catch(e => setSeasonErr(e.message));
  }, [pos]);

  // Team outlook at each member's last known position (≤ 48 h)
  useEffect(() => {
    if (isViewer) return;
    const fresh = positions.filter(p => Date.now() - new Date(p.at).getTime() < 48 * 3600e3);
    const people = fresh.map(p => ({
      ...p, name: liveMembers.find(m => m.id === p.profile_id)?.name,
    })).filter(p => p.name);
    if (!people.length) { setTeam([]); return; }
    let cancelled = false;
    multiDaily(people).then(rows => {
      if (cancelled) return;
      setTeam(people.map((p, i) => ({ ...p, daily: rows[i]?.daily })));
    }).catch(() => {});
    return () => { cancelled = true; };
    // positions refresh every 20 s; the outlook only needs the set of people
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewer, liveMembers.length, positions.map(p => p.profile_id).sort().join(',')]);

  const cur = mine?.current;
  const d = mine?.daily;
  const hourly = (mine?.hourly?.time ?? []).map((t, i) => ({
    t: hhmm(t),
    temp: mine.hourly.temperature_2m[i],
    rain: mine.hourly.precipitation[i],
    prob: mine.hourly.precipitation_probability?.[i],
  }));
  const myFlags = d ? d.time.slice(0, 3).flatMap((day, k) => dayFlags(d, k).map(f => ({ ...f, day: dayName(day, k) }))) : [];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <CloudSun className="w-6 h-6 text-orange-400" />Forecasts
        </h2>
        <button
          onClick={locate}
          disabled={locating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/15 border border-sky-500/30 text-sky-300 rounded-lg text-xs font-medium disabled:opacity-50"
        >
          {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
          My location
        </button>
      </div>

      {/* ---------- MY FORECAST ---------- */}
      <Card title={place ? `My forecast · ${place}` : 'My forecast'} icon={Thermometer}
        right={cur && <span className="text-[11px] text-slate-500">updated {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Open-Meteo</span>}>
        {myErr && <p className="text-xs text-red-400">{myErr}</p>}
        {!mine && !myErr && <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Reading the sky at your position…</p>}
        {cur && (
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-5xl leading-none">{wxIcon(cur.weather_code)}</span>
            <div>
              <p className="text-3xl font-bold text-white">{Math.round(cur.temperature_2m)}°C</p>
              <p className="text-xs text-slate-400">{wxLabel(cur.weather_code)} · feels {Math.round(cur.apparent_temperature)}°</p>
            </div>
            <div className="flex gap-4 text-xs text-slate-300 flex-wrap">
              <span className="flex items-center gap-1"><Droplets className="w-3.5 h-3.5 text-sky-400" />{cur.relative_humidity_2m}%</span>
              <span className="flex items-center gap-1"><Wind className="w-3.5 h-3.5 text-slate-400" />{Math.round(cur.wind_speed_10m)} km/h, gusts {Math.round(cur.wind_gusts_10m)}</span>
              {d?.sunrise?.[0] && <span className="flex items-center gap-1"><Sunrise className="w-3.5 h-3.5 text-amber-300" />{hhmm(d.sunrise[0])}</span>}
              {d?.sunset?.[0] && <span className="flex items-center gap-1"><Sunset className="w-3.5 h-3.5 text-orange-300" />{hhmm(d.sunset[0])}</span>}
            </div>
          </div>
        )}

        {myFlags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {myFlags.map((f, i) => (
              <span key={i} className={`px-2 py-1 rounded-lg border text-[11px] flex items-center gap-1 ${SEV[f.sev]}`}>
                <AlertTriangle className="w-3 h-3" />{f.day}: {f.text}
              </span>
            ))}
          </div>
        )}

        {hourly.length > 0 && (
          <div>
            <p className="text-[11px] text-slate-500 mb-1">Next 48 hours — temperature (line, °C) and rain (bars, mm per hour)</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={hourly} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#64748b' }} interval={5} />
                  <YAxis yAxisId="t" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} width={28} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                    formatter={(v, n) => (n === 'temp' ? [`${v} °C`, 'Temperature'] : [`${v} mm`, 'Rain'])}
                  />
                  <Bar yAxisId="r" dataKey="rain" fill="#38bdf8" opacity={0.7} />
                  <Line yAxisId="t" dataKey="temp" stroke="#fb923c" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {d && (
          <div className="grid grid-cols-7 gap-1">
            {d.time.map((day, k) => {
              const flagged = dayFlags(d, k);
              const worst = flagged.some(f => f.sev === 'critical') ? 'critical' : flagged.length ? 'warning' : null;
              return (
                <div key={day} className={`rounded-lg p-1.5 text-center border ${worst ? SEV[worst] : 'border-slate-800 bg-slate-800/40'}`}
                  title={flagged.map(f => f.text).join(' · ') || wxLabel(d.weather_code[k])}>
                  <p className="text-[10px] text-slate-400">{dayName(day, k)}</p>
                  <p className="text-xl leading-tight">{wxIcon(d.weather_code[k])}</p>
                  <p className="text-xs text-white font-semibold">{Math.round(d.temperature_2m_max[k])}°</p>
                  <p className="text-[10px] text-slate-500">{Math.round(d.temperature_2m_min[k])}°</p>
                  <p className="text-[10px] text-sky-300">{d.precipitation_probability_max?.[k] ?? 0}%</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ---------- TEAM OUTLOOK ---------- */}
      {!isViewer && (
        <Card title="Team outlook · next 3 days at each member's last position" icon={Users}>
          {team.length === 0 && <p className="text-xs text-slate-500">No team positions in the last 48 hours.</p>}
          <div className="space-y-1.5">
            {team.map(m => {
              const dd = m.daily;
              const flags = dd ? dd.time.flatMap((day, k) => dayFlags(dd, k).map(f => ({ ...f, day: dayName(day, k) }))) : [];
              return (
                <div key={m.profile_id} className="flex items-center gap-3 px-3 py-2 bg-slate-800/40 rounded-lg flex-wrap">
                  <div className="w-36 min-w-0">
                    <p className="text-xs text-white font-medium truncate">{m.name}</p>
                    <p className="text-[10px] text-slate-500">position {ago(m.at)}</p>
                  </div>
                  <div className="flex gap-2">
                    {dd?.time.map((day, k) => (
                      <span key={day} className="text-center text-[10px] text-slate-400 w-14">
                        {dayName(day, k)}<br />
                        <span className="text-base">{wxIcon(dd.weather_code[k])}</span>{' '}
                        <span className="text-white">{Math.round(dd.temperature_2m_max[k])}°</span>
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1 flex-1 justify-end">
                    {flags.length === 0
                      ? <span className="text-[10px] text-green-400">No hazards flagged</span>
                      : flags.map((f, i) => (
                        <span key={i} className={`px-1.5 py-0.5 rounded border text-[10px] ${SEV[f.sev]}`}>{f.day}: {f.text}</span>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-600">Flags use the same thresholds the tower pushes on — anything red here reaches phones automatically.</p>
        </Card>
      )}

      {/* ---------- SEASON AHEAD ---------- */}
      <Card title="The season ahead" icon={Waves}
        right={<span className="text-[11px] text-slate-500">NOAA CPC · ECMWF SEAS5 via Open-Meteo</span>}>
        {enso?.phase && (
          <div className={`p-3 rounded-lg border ${enso.phase === 'El Niño' ? 'border-orange-500/40 bg-orange-500/10' : enso.phase === 'La Niña' ? 'border-sky-500/40 bg-sky-500/10' : 'border-slate-700 bg-slate-800/40'}`}>
            <p className="text-sm text-white font-semibold">
              {enso.phase}{enso.strength ? ` · ${enso.strength}` : ''}
              {enso.status && <span className="text-xs font-normal text-slate-300"> — NOAA status: {enso.status}</span>}
            </p>
            {enso.synopsis && <p className="text-xs text-slate-300 mt-1">{enso.synopsis}</p>}
            {enso.oni?.length > 0 && (
              <p className="text-[10px] text-slate-500 mt-1.5">
                Oceanic Niño Index (3-month): {enso.oni.slice(-6).map(o => `${o.season} ${o.anomaly > 0 ? '+' : ''}${o.anomaly.toFixed(1)}`).join(' · ')}
                {' · '}<a href={enso.discussion_url} target="_blank" rel="noreferrer" className="text-orange-300 underline">NOAA discussion</a>
              </p>
            )}
          </div>
        )}
        {seasonErr && <p className="text-xs text-red-400">Seasonal outlook unavailable: {seasonErr}</p>}
        {!season && !seasonErr && pos && <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Comparing the 51-member seasonal ensemble with 30 years of climate here…</p>}
        {season && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {season.map(m => {
              const ta = m.tempAnomaly;
              const pr = m.precipRatio;
              const tWord = ta == null ? '—' : ta >= 1.5 ? 'much warmer' : ta >= 0.5 ? 'warmer' : ta <= -1.5 ? 'much colder' : ta <= -0.5 ? 'colder' : 'near normal';
              const pWord = pr == null ? '—' : pr >= 1.3 ? 'much wetter' : pr >= 1.1 ? 'wetter' : pr <= 0.7 ? 'much drier' : pr <= 0.9 ? 'drier' : 'near normal';
              return (
                <div key={m.month} className="p-3 rounded-lg bg-slate-800/40 border border-slate-700">
                  <p className="text-xs text-white font-semibold">{m.month}</p>
                  <p className="text-[11px] text-slate-300 mt-1">
                    <Thermometer className="inline w-3 h-3 text-orange-300" /> {tWord}
                    {ta != null && <span className="text-slate-500"> ({ta > 0 ? '+' : ''}{ta.toFixed(1)}°C vs normal)</span>}
                  </p>
                  <p className="text-[11px] text-slate-300">
                    <Droplets className="inline w-3 h-3 text-sky-300" /> {pWord}
                    {pr != null && <span className="text-slate-500"> ({Math.round(m.precip)} mm vs {Math.round(m.precipNormal)} normal)</span>}
                  </p>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[10px] text-slate-600">
          Seasonal forecasts describe tendencies over weeks, not daily weather — they are for planning staffing and supplies, not for go/no-go calls.
        </p>
      </Card>
    </div>
  );
};

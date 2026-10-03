import { useState, useEffect, useCallback } from 'react';
import { CloudSun, LocateFixed, Loader2, Users, Thermometer, Droplets, Wind, AlertTriangle, Waves, Sunrise, Sunset } from 'lucide-react';
import { ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useTeam } from '../hooks/useTeam';
import { usePositions } from '../hooks/usePositions';
import { pointForecast, multiDaily, seasonalOutlook, dayFlags, wxIcon, wxLabel } from '../lib/forecast';
import { useI18n } from '../i18n/index.jsx';
import { useTranslations } from '../lib/translate';
import { AreaHistory } from '../components/AreaHistory';
import { TrackRecord } from '../components/TrackRecord';

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
const dayNameT = (t, lang, iso, i) => (i === 0 ? t('fc.today') : i === 1 ? t('fc.tomorrow')
  : new Date(`${iso}T12:00:00`).toLocaleDateString(lang, { weekday: 'short', day: 'numeric' }));
const hhmm = (iso) => iso?.slice(11, 16) ?? '';
const agoT = (t, iso) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? t('time.minAgo', { m }) : m < 1440 ? t('time.hAgo', { h: Math.floor(m / 60) }) : t('time.dAgo', { d: Math.floor(m / 1440) });
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
  const { t, lang } = useI18n();
  const dayName = (iso, i) => dayNameT(t, lang, iso, i);
  const ago = (iso) => agoT(t, iso);
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
    if (!navigator.geolocation) { setMyErr(t('fc.noLoc')); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(next);
        try { localStorage.setItem(MY_LOCATION_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
        setLocating(false);
      },
      () => { setMyErr(t('fc.locErr')); setLocating(false); },
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
  // Weather words, hazard flags and NOAA text are English at the source
  const wxTexts = lang === 'en' ? [] : [
    ...(mine?.current ? [wxLabel(mine.current.weather_code)] : []),
    ...(mine?.daily?.weather_code ?? []).map(wxLabel),
    ...(mine?.daily ? mine.daily.time.flatMap((_, k) => dayFlags(mine.daily, k).map(f => f.text)) : []),
    ...team.flatMap(m => (m.daily ? m.daily.time.flatMap((_, k) => dayFlags(m.daily, k).map(f => f.text)) : [])),
    ...(enso?.status ? [enso.status] : []), ...(enso?.synopsis ? [enso.synopsis] : []),
  ];
  const wxTr = useTranslations([...new Set(wxTexts)], lang, wxTexts.length > 0);
  const W = (x) => (x ? wxTr[x] ?? x : x);
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
          <CloudSun className="w-6 h-6 text-orange-400" />{t('fc.title')}
        </h2>
        <button
          onClick={locate}
          disabled={locating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/15 border border-sky-500/30 text-sky-300 rounded-lg text-xs font-medium disabled:opacity-50"
        >
          {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
          {t('fc.myLocation')}
        </button>
      </div>

      {/* ---------- MY FORECAST ---------- */}
      <Card title={place ? t('fc.myAt', { place }) : t('fc.my')} icon={Thermometer}
        right={cur && <span className="text-[11px] text-slate-500">{t('fc.updated', { time: new Date().toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }) })}</span>}>
        {myErr && <p className="text-xs text-red-400">{myErr}</p>}
        {!mine && !myErr && <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('fc.reading')}</p>}
        {cur && (
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-5xl leading-none">{wxIcon(cur.weather_code)}</span>
            <div>
              <p className="text-3xl font-bold text-white">{Math.round(cur.temperature_2m)}°C</p>
              <p className="text-xs text-slate-400">{W(wxLabel(cur.weather_code))} · {t('fc.feels', { t: Math.round(cur.apparent_temperature) })}</p>
            </div>
            <div className="flex gap-4 text-xs text-slate-300 flex-wrap">
              <span className="flex items-center gap-1"><Droplets className="w-3.5 h-3.5 text-sky-400" />{cur.relative_humidity_2m}%</span>
              <span className="flex items-center gap-1"><Wind className="w-3.5 h-3.5 text-slate-400" />{t('fc.gusts', { w: Math.round(cur.wind_speed_10m), g: Math.round(cur.wind_gusts_10m) })}</span>
              {d?.sunrise?.[0] && <span className="flex items-center gap-1"><Sunrise className="w-3.5 h-3.5 text-amber-300" />{hhmm(d.sunrise[0])}</span>}
              {d?.sunset?.[0] && <span className="flex items-center gap-1"><Sunset className="w-3.5 h-3.5 text-orange-300" />{hhmm(d.sunset[0])}</span>}
            </div>
          </div>
        )}

        {myFlags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {myFlags.map((f, i) => (
              <span key={i} className={`px-2 py-1 rounded-lg border text-[11px] flex items-center gap-1 ${SEV[f.sev]}`}>
                <AlertTriangle className="w-3 h-3" />{f.day}: {W(f.text)}
              </span>
            ))}
          </div>
        )}

        {hourly.length > 0 && (
          <div>
            <p className="text-[11px] text-slate-500 mb-1">{t('fc.next48')}</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={hourly} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#64748b' }} interval={5} />
                  <YAxis yAxisId="t" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} width={28} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                    formatter={(v, n) => (n === 'temp' ? [`${v} °C`, t('fc.temperature')] : [`${v} mm`, t('fc.rain')])}
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
                  title={flagged.map(f => W(f.text)).join(' · ') || W(wxLabel(d.weather_code[k]))}>
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
        <Card title={t('fc.team')} icon={Users}>
          {team.length === 0 && <p className="text-xs text-slate-500">{t('fc.noTeam')}</p>}
          <div className="space-y-1.5">
            {team.map(m => {
              const dd = m.daily;
              const flags = dd ? dd.time.flatMap((day, k) => dayFlags(dd, k).map(f => ({ ...f, day: dayName(day, k) }))) : [];
              return (
                <div key={m.profile_id} className="flex items-center gap-3 px-3 py-2 bg-slate-800/40 rounded-lg flex-wrap">
                  <div className="w-36 min-w-0">
                    <p className="text-xs text-white font-medium truncate">{m.name}</p>
                    <p className="text-[10px] text-slate-500">{t('fc.position', { ago: ago(m.at) })}</p>
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
                      ? <span className="text-[10px] text-green-400">{t('fc.noHazards')}</span>
                      : flags.map((f, i) => (
                        <span key={i} className={`px-1.5 py-0.5 rounded border text-[10px] ${SEV[f.sev]}`}>{f.day}: {W(f.text)}</span>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-600">{t('fc.sameThresholds')}</p>
        </Card>
      )}

      {/* ---------- SEASON AHEAD ---------- */}
      <Card title={t('fc.season')} icon={Waves}
        right={<span className="text-[11px] text-slate-500">NOAA CPC · ECMWF SEAS5 via Open-Meteo</span>}>
        {enso?.phase && (
          <div className={`p-3 rounded-lg border ${enso.phase === 'El Niño' ? 'border-orange-500/40 bg-orange-500/10' : enso.phase === 'La Niña' ? 'border-sky-500/40 bg-sky-500/10' : 'border-slate-700 bg-slate-800/40'}`}>
            <p className="text-sm text-white font-semibold">
              {enso.phase}{enso.strength ? ` · ${enso.strength}` : ''}
              {enso.status && <span className="text-xs font-normal text-slate-300"> — {t('fc.noaaStatus', { s: W(enso.status) })}</span>}
            </p>
            {enso.synopsis && <p className="text-xs text-slate-300 mt-1">{W(enso.synopsis)}</p>}
            {enso.oni?.length > 0 && (
              <p className="text-[10px] text-slate-500 mt-1.5">
                {t('fc.oni')}: {enso.oni.slice(-6).map(o => `${o.season} ${o.anomaly > 0 ? '+' : ''}${o.anomaly.toFixed(1)}`).join(' · ')}
                {' · '}<a href={enso.discussion_url} target="_blank" rel="noreferrer" className="text-orange-300 underline">{t('fc.noaaLink')}</a>
              </p>
            )}
          </div>
        )}
        {seasonErr && <p className="text-xs text-red-400">{t('fc.seasonUnavailable', { e: seasonErr })}</p>}
        {!season && !seasonErr && pos && <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('fc.comparing')}</p>}
        {season && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {season.map(m => {
              const ta = m.tempAnomaly;
              const pr = m.precipRatio;
              const tWord = ta == null ? '—' : ta >= 1.5 ? t('fc.muchWarmer') : ta >= 0.5 ? t('fc.warmer') : ta <= -1.5 ? t('fc.muchColder') : ta <= -0.5 ? t('fc.colder') : t('fc.nearNormal');
              const pWord = pr == null ? '—' : pr >= 1.3 ? t('fc.muchWetter') : pr >= 1.1 ? t('fc.wetter') : pr <= 0.7 ? t('fc.muchDrier') : pr <= 0.9 ? t('fc.drier') : t('fc.nearNormal');
              return (
                <div key={m.month} className="p-3 rounded-lg bg-slate-800/40 border border-slate-700">
                  <p className="text-xs text-white font-semibold">{m.month}</p>
                  <p className="text-[11px] text-slate-300 mt-1">
                    <Thermometer className="inline w-3 h-3 text-orange-300" /> {tWord}
                    {ta != null && <span className="text-slate-500"> ({t('fc.vsNormal', { d: `${ta > 0 ? '+' : ''}${ta.toFixed(1)}` })})</span>}
                  </p>
                  <p className="text-[11px] text-slate-300">
                    <Droplets className="inline w-3 h-3 text-sky-300" /> {pWord}
                    {pr != null && <span className="text-slate-500"> ({t('fc.mmVsNormal', { p: Math.round(m.precip), n: Math.round(m.precipNormal) })})</span>}
                  </p>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[10px] text-slate-600">
          {t('fc.seasonNote')}
        </p>
      </Card>

      {/* ---------- REGIONAL MEMORY + PREDICTION LEDGER ---------- */}
      {pos && <AreaHistory pos={pos} heavyRainSoon={myFlags.some(f => f.tag === 'rain')} />}
      {!isViewer && <TrackRecord />}
    </div>
  );
};

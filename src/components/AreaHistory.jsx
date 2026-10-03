import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Flame, MapPin, Plus, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { getOrgId } from '../lib/org';
import { useI18n } from '../i18n/index.jsx';
import { useTranslations } from '../lib/translate';

// ============================================
// AREA HISTORY — the region's memory.
// What has happened around this position: burned areas (CWFIS NBAC),
// NASA EONET events, USGS earthquakes, and what the team itself has
// recorded. Recent burn scars change the risk picture (less fuel to
// re-ignite, more runoff in heavy rain); recurring events mark
// problem areas worth knowing before you're in them.
// ============================================

const KINDS = ['wildfire', 'flood', 'severe_storm', 'earthquake', 'landslide', 'snow_ice', 'heat', 'drought', 'volcano', 'other'];
const ICON = { wildfire: '🔥', flood: '🌊', severe_storm: '⛈️', earthquake: '🌐', landslide: '⛰️', snow_ice: '❄️', heat: '🌡️', drought: '🏜️', volcano: '🌋', other: '📍' };
const R = 6371;
const km = (a, b) => {
  const dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
const kmTo = (p, inc) => {
  const bb = inc.details?.bbox;
  if (!bb) return km(p, inc);
  return km(p, { lng: Math.min(Math.max(p.lng, bb[0]), bb[2]), lat: Math.min(Math.max(p.lat, bb[1]), bb[3]) });
};
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const bearing = (a, b) => {
  const y = Math.sin((b.lng - a.lng) * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180);
  const x = Math.cos(a.lat * Math.PI / 180) * Math.sin(b.lat * Math.PI / 180) - Math.sin(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.cos((b.lng - a.lng) * Math.PI / 180);
  return DIRS[Math.round((((Math.atan2(y, x) * 180) / Math.PI + 360) % 360) / 45) % 8];
};
const yearOf = (i) => Number(i.details?.year ?? String(i.started_at ?? '').slice(0, 4)) || null;

export const AreaHistory = ({ pos, heavyRainSoon }) => {
  const { profile, session } = useAuth();
  const { t, lang } = useI18n();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ kind: 'flood', title: '', date: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!pos) return;
    const { data, error } = await supabase.from('regional_incidents')
      .select('id, source, kind, title, lat, lng, region_key, started_at, magnitude, magnitude_unit, details, org_id, created_by')
      .gte('lat', pos.lat - 0.95).lte('lat', pos.lat + 0.95)
      .gte('lng', pos.lng - 1.3).lte('lng', pos.lng + 1.3)
      .limit(5000);
    if (error) setErr(error.message);
    else setRows((data ?? []).map(r => ({ ...r, km: kmTo(pos, r), year: yearOf(r) })).filter(r => r.km <= 100));
  }, [pos]);
  useEffect(() => { setRows(null); load(); }, [load]);

  const thisYear = new Date().getFullYear();
  const view = useMemo(() => {
    if (!rows) return null;
    const scars = rows.filter(r => r.kind === 'wildfire' && r.km <= 10 && r.year && r.year >= thisYear - 5)
      .sort((a, b) => b.year - a.year || a.km - b.km);
    const recurrence = KINDS.map(k => {
      const radius = k === 'earthquake' ? 100 : 50;
      const near = rows.filter(r => r.kind === k && r.km <= radius && r.year && r.year >= thisYear - 20);
      const years = new Set(near.map(r => r.year));
      const biggest = near.reduce((a, r) => (r.magnitude != null && (a == null || Number(r.magnitude) > Number(a.magnitude)) ? r : a), null);
      const last = near.reduce((a, r) => (!a || (r.started_at ?? '') > (a.started_at ?? '') ? r : a), null);
      return { k, radius, n: near.length, years: years.size, biggest, last };
    }).filter(x => x.n > 0);
    // problem areas: 0.5° cells with the most events, any kind
    const cells = new Map();
    for (const r of rows) {
      const c = cells.get(r.region_key) ?? { key: r.region_key, n: 0, kinds: {}, years: new Set(), last: null };
      c.n++;
      c.kinds[r.kind] = (c.kinds[r.kind] ?? 0) + 1;
      if (r.year) c.years.add(r.year);
      if (!c.last || (r.started_at ?? '') > c.last) c.last = r.started_at;
      cells.set(r.region_key, c);
    }
    const hotspots = [...cells.values()].filter(c => c.years.size >= 2)
      .map(c => {
        const [lat, lng] = c.key.split(',').map(Number);
        return { ...c, d: Math.round(km(pos, { lat, lng })), dir: bearing(pos, { lat, lng }) };
      })
      .sort((a, b) => b.years.size - a.years.size || b.n - a.n).slice(0, 5);
    const recent = rows.filter(r => r.started_at && Date.now() - Date.parse(r.started_at) < 365 * 86400e3)
      .sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 8);
    const local = rows.filter(r => r.source === 'manual').sort((a, b) => (b.started_at ?? '').localeCompare(a.started_at ?? ''));
    return { scars, recurrence, hotspots, recent, local };
  }, [rows, pos, thisYear]);

  const titles = lang === 'en' || !view ? [] : [...new Set([...view.recent, ...view.local].map(r => r.title).filter(Boolean))];
  const tr = useTranslations(titles, lang, titles.length > 0);
  const T = (s) => (s ? tr[s] ?? s : s);

  const save = async () => {
    if (!draft.title.trim() || !pos) return;
    setBusy(true);
    const org = await getOrgId();
    const { error } = await supabase.from('regional_incidents').insert({
      org_id: org, source: 'manual', external_id: crypto.randomUUID(), kind: draft.kind,
      title: draft.title.trim().slice(0, 300), lat: pos.lat, lng: pos.lng,
      region_key: `${(Math.round(pos.lat * 2) / 2).toFixed(1)},${(Math.round(pos.lng * 2) / 2).toFixed(1)}`,
      started_at: new Date(`${draft.date}T12:00:00`).toISOString(), created_by: session?.user?.id,
      details: { by: profile?.display_name ?? null },
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setAdding(false);
    setDraft(d => ({ ...d, title: '' }));
    load();
  };

  const input = 'px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-orange-500';

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><History className="w-4 h-4 text-orange-400" />{t('ah.title')}</h3>
        <span className="text-[11px] text-slate-500">CWFIS · NASA EONET · USGS</span>
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      {!view && !err && <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />…</p>}

      {view && (
        <>
          {view.scars.length > 0 && (
            <div className={`p-3 rounded-lg border ${heavyRainSoon ? 'border-amber-500/50 bg-amber-500/10' : 'border-orange-500/30 bg-orange-500/5'}`}>
              <p className="text-xs text-white font-semibold flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                {t('ah.scar', { year: view.scars[0].year, ha: view.scars[0].magnitude ? Math.round(view.scars[0].magnitude).toLocaleString(lang) : '?', km: view.scars[0].km.toFixed(1) })}
                {view.scars.length > 1 && <span className="font-normal text-slate-400"> {t('ah.moreScars', { n: view.scars.length - 1 })}</span>}
              </p>
              <p className="text-[11px] text-slate-300 mt-1">{t('ah.scarMeaning')}</p>
              {heavyRainSoon && (
                <p className="text-[11px] text-amber-300 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{t('ah.scarRain')}</p>
              )}
            </div>
          )}

          {view.recurrence.length === 0 && view.local.length === 0 && <p className="text-xs text-slate-500">{t('ah.quiet')}</p>}
          {view.recurrence.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {view.recurrence.map(x => (
                <div key={x.k} className="px-2.5 py-2 rounded-lg bg-slate-800/40 border border-slate-700">
                  <p className="text-xs text-white">{ICON[x.k]} {t(`kind.${x.k}`)}</p>
                  <p className="text-[11px] text-slate-400">
                    {t('ah.recur', { years: x.years, n: x.n, r: x.radius })}
                    {x.biggest?.magnitude != null && ` · ${t('ah.largest', { m: `${Number(x.biggest.magnitude).toLocaleString(lang, { maximumFractionDigits: 1 })}${x.biggest.magnitude_unit ? ` ${x.biggest.magnitude_unit}` : ''}`, y: x.biggest.year })}`}
                    {x.last?.year && ` · ${t('ah.last', { y: x.last.year })}`}
                  </p>
                </div>
              ))}
            </div>
          )}

          {view.hotspots.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><MapPin className="w-3 h-3" />{t('ah.problemAreas')}</p>
              {view.hotspots.map(h => (
                <div key={h.key} className="flex items-center gap-2 text-[11px] px-2.5 py-1.5 bg-slate-800/40 rounded-lg">
                  <span className="text-slate-200 w-24 shrink-0">{h.d < 20 ? t('ah.here') : `${h.d} km ${h.dir}`}</span>
                  <span className="text-slate-400 flex-1">
                    {Object.entries(h.kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${ICON[k]} ${n}`).join('  ')}
                  </span>
                  <span className="text-slate-500">{t('ah.inYears', { n: h.years.size })}</span>
                </div>
              ))}
            </div>
          )}

          {view.recent.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">{t('ah.recent')}</p>
              {view.recent.map(r => (
                <p key={r.id} className="text-[11px] text-slate-300">
                  {ICON[r.kind]} {T(r.title)} <span className="text-slate-500">· {Math.round(r.km)} km · {new Date(r.started_at).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </p>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">{t('ah.local')}</p>
              {pos && profile?.role !== 'viewer' && (
                <button onClick={() => setAdding(v => !v)} className="text-[11px] text-orange-300 hover:text-orange-200 flex items-center gap-1">
                  <Plus className="w-3 h-3" />{t('ah.add')}
                </button>
              )}
            </div>
            {adding && (
              <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <select className={input} value={draft.kind} onChange={e => setDraft(d => ({ ...d, kind: e.target.value }))}>
                    {KINDS.map(k => <option key={k} value={k}>{ICON[k]} {t(`kind.${k}`)}</option>)}
                  </select>
                  <input type="date" className={input} value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} />
                </div>
                <input className={`${input} w-full`} placeholder={t('ah.addPlaceholder')} value={draft.title} maxLength={300}
                  onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
                <div className="flex items-center gap-2">
                  <button onClick={save} disabled={busy || !draft.title.trim()}
                    className="px-3 py-1.5 bg-orange-500 rounded-lg text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5">
                    {busy && <Loader2 className="w-3 h-3 animate-spin" />}{t('ah.save')}
                  </button>
                  <span className="text-[10px] text-slate-500">{t('ah.atPosition')}</span>
                </div>
              </div>
            )}
            {view.local.length === 0 && !adding && <p className="text-[11px] text-slate-600">{t('ah.noLocal')}</p>}
            {view.local.map(r => (
              <p key={r.id} className="text-[11px] text-slate-300">
                {ICON[r.kind]} {T(r.title)} <span className="text-slate-500">· {Math.round(r.km)} km · {r.started_at?.slice(0, 10)}{r.details?.by ? ` · ${r.details.by}` : ''}</span>
              </p>
            ))}
          </div>
          <p className="text-[10px] text-slate-600">{t('ah.note')}</p>
        </>
      )}
    </div>
  );
};

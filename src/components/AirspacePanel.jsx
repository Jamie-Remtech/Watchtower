import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { Plane, ChevronDown, Box, Loader2, PlaneLanding, PlaneTakeoff, AlertTriangle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/index.jsx';
import { getLastCoords } from '../lib/tracker';
import {
  fetchPublicAir, fetchOwnAir, mergeTracks, findConflicts, groundElevation, declareFlight, endFlight,
  distanceKm, bearingTo, metres, feet, KIND_ICON, KIND_COLOR,
} from '../lib/airspace';

// ============================================
// AIRSPACE on the World globe: every aircraft and drone at its height.
// 2D: labelled tags. 3D: tilted globe with terrain, each aircraft on a
// stem at its height above ground, drone flights as columns up to their
// ceiling. Conflicts (2-minute projection) highlighted; the server
// (airspace-watch) raises the alerts and pushes.
// ============================================

const ON_KEY = 'wt-air-on';
const SRC = 'air-3d';
const LAYER = 'air-columns';
const POLL_MS = 10000;
const AIR_MIN_ZOOM = 6;     // below this (continent view), public aircraft are not drawn
const LABEL_MIN_ZOOM = 7;   // below this, aircraft are icons only (names on hover / tap)
const MAX_LABELS = 60;

const square = (lat, lng, half) => {
  const dLat = half / 110540, dLng = half / (111320 * Math.cos(lat * Math.PI / 180));
  return [[[lng - dLng, lat - dLat], [lng + dLng, lat - dLat], [lng + dLng, lat + dLat], [lng - dLng, lat + dLat], [lng - dLng, lat - dLat]]];
};
const circle = (lat, lng, r, n = 40) => {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    pts.push([lng + (r * Math.sin(a)) / (111320 * Math.cos(lat * Math.PI / 180)), lat + (r * Math.cos(a)) / 110540]);
  }
  return [pts];
};

export const AirspacePanel = ({ getMap, ready }) => {
  const { t } = useI18n();
  const { profile, session } = useAuth();
  const myId = session?.user?.id;
  const [on, setOn] = useState(() => { try { return localStorage.getItem(ON_KEY) === '1'; } catch { return false; } });
  const [open, setOpen] = useState(true);
  const [threeD, setThreeD] = useState(false);
  const [publicAir, setPublicAir] = useState([]);
  const [ownAir, setOwnAir] = useState([]);
  const [loading, setLoading] = useState(false);
  const [groundRef, setGroundRef] = useState(0);
  const [selected, setSelected] = useState(null);
  const [declaring, setDeclaring] = useState(false);
  const [form, setForm] = useState({ label: '', ceiling: 120, radius: 500 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const markersRef = useRef(new Map());
  const zoomRef = useRef(8);
  const [viewTick, setViewTick] = useState(0);   // map moved → re-declutter the tags
  const [coverKm, setCoverKm] = useState(null);  // radius of public data around the centre
  const [tooWide, setTooWide] = useState(false); // zoomed out too far for public aircraft

  const toggleOn = () => setOn(v => { try { localStorage.setItem(ON_KEY, v ? '0' : '1'); } catch { /* private mode */ } return !v; });

  // ---------- data ----------
  const loadPublic = useCallback(async () => {
    const map = getMap();
    if (!map) return;
    // Public data covers a circle around the map centre (max ~460 km). Zoomed
    // out to a continent that circle is a few pixels wide and every plane in it
    // piles up in one spot — so below AIR_MIN_ZOOM only our own feeds show.
    if (map.getZoom() < AIR_MIN_ZOOM) { setTooWide(true); setCoverKm(null); setPublicAir([]); return; }
    setTooWide(false);
    const c = map.getCenter();
    const b = map.getBounds();
    const radius = Math.min(460, Math.max(20, distanceKm({ lat: c.lat, lng: c.lng }, { lat: b.getNorth(), lng: b.getEast() })));
    setCoverKm(Math.round(radius));
    setPublicAir(await fetchPublicAir(c.lat, c.lng, radius));
    const g = await groundElevation(c.lat, c.lng);
    if (g != null) setGroundRef(g);
  }, [getMap]);
  const loadOwn = useCallback(async () => setOwnAir(await fetchOwnAir()), []);

  useEffect(() => {
    if (!on || !ready) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([loadPublic(), loadOwn()]).finally(() => { if (!cancelled) setLoading(false); });
    const id = setInterval(() => { loadPublic(); loadOwn(); }, POLL_MS);
    const ch = supabase.channel(`air-tracks-${Math.random().toString(36).slice(2, 10)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'air_tracks' }, () => loadOwn())
      .subscribe();
    const map = getMap();
    const onMove = () => { zoomRef.current = map.getZoom(); setViewTick(v => v + 1); loadPublic(); };
    map?.on('moveend', onMove);
    return () => { cancelled = true; clearInterval(id); supabase.removeChannel(ch); map?.off('moveend', onMove); };
  }, [on, ready, loadPublic, loadOwn, getMap]);

  const tracks = useMemo(() => mergeTracks(publicAir, ownAir), [publicAir, ownAir]);
  const conflicts = useMemo(() => findConflicts(tracks), [tracks]);
  const conflictIds = useMemo(() => new Set(conflicts.flatMap(c => [c.drone.id, c.other.id])), [conflicts]);
  const myFlights = ownAir.filter(a => a.source === 'declared' && a.declared_by === myId && a.status === 'active');

  const nameOf = (a) => a.callsign || a.label || a.registration || a.model || (a.id ?? '').replace(/^(icao|rid|tel|decl):/, '').slice(0, 8);
  const kindName = (k) => t(`air.kind.${k}`);

  // ---------- map: 3D columns ----------
  useEffect(() => {
    const map = getMap();
    if (!map || !ready) return;
    const remove = () => {
      try { if (map.getLayer(LAYER)) map.removeLayer(LAYER); if (map.getSource(SRC)) map.removeSource(SRC); } catch { /* map gone */ }
    };
    // altitude columns only mean something in the tilted 3D view (drone areas always show)
    if (!on) { remove(); return; }
    const zoom = map.getZoom();
    const features = [];
    for (const a of tracks) {
      const mpp = 156543.03 * Math.cos(a.lat * Math.PI / 180) / 2 ** zoom;
      const half = Math.max(8, mpp * 2.5);
      const color = conflictIds.has(a.id) ? '#ef4444' : KIND_COLOR[a.kind] ?? KIND_COLOR.other;
      if (a.source === 'declared' && a.radius_m) {
        features.push({ type: 'Feature', properties: { color, base: 0, top: a.ceiling_m ?? a.alt_agl_m ?? 120, opacity: 0.25 }, geometry: { type: 'Polygon', coordinates: circle(a.lat, a.lng, a.radius_m) } });
        continue;
      }
      if (!threeD) continue; // flat map: the plane icons say it all
      const agl = a.alt_agl_m ?? (a.alt_msl_m != null ? Math.max(15, a.alt_msl_m - groundRef) : 300);
      features.push({ type: 'Feature', properties: { color, base: 0, top: agl }, geometry: { type: 'Polygon', coordinates: square(a.lat, a.lng, half * 0.35) } });
      features.push({ type: 'Feature', properties: { color, base: Math.max(0, agl - half * 2), top: agl + half * 2 }, geometry: { type: 'Polygon', coordinates: square(a.lat, a.lng, half * 1.6) } });
    }
    const fc = { type: 'FeatureCollection', features };
    try {
      if (map.getSource(SRC)) map.getSource(SRC).setData(fc);
      else {
        map.addSource(SRC, { type: 'geojson', data: fc });
        map.addLayer({
          id: LAYER, type: 'fill-extrusion', source: SRC,
          paint: {
            'fill-extrusion-color': ['get', 'color'],
            'fill-extrusion-base': ['get', 'base'],
            'fill-extrusion-height': ['get', 'top'],
            'fill-extrusion-opacity': 0.75,
          },
        });
      }
    } catch { /* style not ready yet — next update retries */ }
  }, [on, ready, tracks, conflictIds, groundRef, getMap, threeD]);
  useEffect(() => () => {
    const map = getMap();
    try { if (map?.getLayer(LAYER)) map.removeLayer(LAYER); if (map?.getSource(SRC)) map.removeSource(SRC); } catch { /* map gone */ }
  }, [getMap]);

  // ---------- map: dots + decluttered name tags ----------
  // Every aircraft gets a dot. A name tag is shown only when zoomed in enough
  // and only where it does not cover another tag; conflicts and drones win.
  useEffect(() => {
    const map = getMap();
    const markers = markersRef.current;
    if (!map || !ready || !on) { markers.forEach(m => m.remove()); markers.clear(); return; }
    const zoom = map.getZoom();
    const rank = (a) => (conflictIds.has(a.id) ? 0 : a.kind === 'drone' ? 1 : a.kind === 'helicopter' ? 2 : 3) * 1e6 + (a.alt_msl_m ?? 0);
    const placed = [];
    const seen = new Set();
    for (const a of [...tracks].sort((x, y) => rank(x) - rank(y))) {
      seen.add(a.id);
      const danger = conflictIds.has(a.id);
      const color = danger ? '#ef4444' : KIND_COLOR[a.kind] ?? '#94a3b8';
      const name = nameOf(a).replace(/[<>&]/g, '');
      const alt = a.source === 'declared' ? `≤${Math.round(a.ceiling_m ?? 0)} m` : metres(a.alt_msl_m);
      // name tag only if zoomed in (or in conflict) and there is room for it
      let label = (zoom >= LABEL_MIN_ZOOM || (danger && zoom >= 4)) && placed.length < MAX_LABELS;
      if (label) {
        const p = map.project([a.lng, a.lat]);
        const box = { x: p.x + 6, y: p.y - 22, w: 34 + (name.length + alt.length) * 6.2, h: 18 };
        label = !placed.some(b => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y);
        if (label) placed.push(box);
      }
      let m = markers.get(a.id);
      if (!m) {
        const el = document.createElement('button');
        el.type = 'button';
        // style once, before MapLibre takes the element: it positions markers
        // through the inline transform, so the style must never be rewritten later
        el.style.cssText = 'display:flex;gap:4px;align-items:center;cursor:pointer;white-space:nowrap;font:11px system-ui;color:#fff;background:transparent;border:0;padding:0';
        el.addEventListener('click', (e) => { e.stopPropagation(); setSelected(a.id); });
        m = new maplibregl.Marker({ element: el, anchor: 'left', offset: [-9, 0] }).setLngLat([a.lng, a.lat]).addTo(map);
        markers.set(a.id, m);
      } else {
        m.setLngLat([a.lng, a.lat]);
      }
      const el = m.getElement();
      // hover: who it is — callsign, registration, type, height, speed
      el.title = [
        [a.callsign, a.registration && `${t('air.reg')} ${a.registration}`, a.model].filter(Boolean).join(' · ') || name,
        [alt, a.speed_kmh != null && `${Math.round(a.speed_kmh)} km/h`, a.heading != null && `${Math.round(a.heading)}°`].filter(Boolean).join(' · '),
        t(`air.kind.${a.kind}`),
      ].filter(Boolean).join('\n');
      // aircraft and helicopters: a small plane pointing where it flies; drones and others: a dot
      const icon = ['aircraft', 'helicopter'].includes(a.kind)
        ? `<svg viewBox="0 0 24 24" width="18" height="18" style="flex:none;transform:rotate(${Math.round(a.heading ?? 0)}deg);filter:drop-shadow(0 0 1px #020617)${danger ? ' drop-shadow(0 0 4px #ef4444)' : ''}"><path d="M12 1.5c.8 0 1.4.9 1.4 2.2v5.6l8.1 4.6v2.2l-8.1-2.4v4.6l2.3 1.7v1.8L12 20.6l-3.7 1.2V20l2.3-1.7v-4.6l-8.1 2.4v-2.2l8.1-4.6V3.7c0-1.3.6-2.2 1.4-2.2z" fill="${color}" stroke="#020617" stroke-width="0.8"/></svg>`
        : `<span style="width:10px;height:10px;border-radius:50%;background:${color};border:1.5px solid #020617;flex:none${danger ? ';box-shadow:0 0 0 3px rgba(239,68,68,.45)' : ''}"></span>`;
      el.innerHTML = icon
        + (label ? `<span style="display:flex;gap:4px;align-items:center;padding:1px 6px;border-radius:9px;background:rgba(2,6,23,.85);border:1.5px solid ${color}"><span style="font-weight:600">${name}</span><span style="opacity:.8">${alt}</span></span>` : '');
    }
    for (const [id, m] of markers) if (!seen.has(id)) { m.remove(); markers.delete(id); }
  }, [on, ready, tracks, conflictIds, getMap, viewTick, t]);
  useEffect(() => () => { markersRef.current.forEach(m => m.remove()); markersRef.current.clear(); }, []);

  // ---------- 3D view ----------
  const toggle3D = () => {
    const map = getMap();
    if (!map) return;
    const next = !threeD;
    setThreeD(next);
    try {
      if (next) {
        map.setMaxPitch?.(75);
        try { if (map.getSource('dem')) map.setTerrain({ source: 'dem', exaggeration: 1 }); } catch { /* terrain unsupported here */ }
        map.easeTo({ pitch: 65, bearing: map.getBearing() || -15, zoom: Math.max(map.getZoom(), 9), duration: 900 });
      } else {
        try { map.setTerrain(null); } catch { /* none */ }
        map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
      }
    } catch { /* map busy */ }
  };

  // ---------- declare a flight ----------
  const startDeclare = () => {
    setForm({ label: `${t('air.droneOf')} ${profile?.callsign || profile?.display_name || ''}`.trim(), ceiling: 120, radius: 500 });
    setErr(null);
    setDeclaring(true);
  };
  const submitDeclare = async () => {
    setBusy(true); setErr(null);
    try {
      let pos = getLastCoords();
      if (!pos) {
        pos = await new Promise((res) => navigator.geolocation
          ? navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { timeout: 8000, maximumAge: 60000 })
          : res(null));
      }
      if (!pos) { const c = getMap()?.getCenter(); if (c) pos = { lat: c.lat, lng: c.lng }; }
      if (!pos) throw new Error(t('air.noPosition'));
      await declareFlight({ label: form.label.trim() || t('air.kind.drone'), ceilingM: Math.max(10, Math.min(1500, +form.ceiling || 120)), radiusM: Math.max(50, Math.min(20000, +form.radius || 500)), lat: pos.lat, lng: pos.lng, userId: myId });
      if (!on) toggleOn();
      setDeclaring(false);
      loadOwn();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const land = async (id) => { try { await endFlight(id); loadOwn(); } catch (e) { setErr(e.message); } };

  const center = getMap()?.getCenter?.();
  const sorted = [...tracks].sort((a, b) => (a.alt_msl_m ?? 1e9) - (b.alt_msl_m ?? 1e9));
  const sel = tracks.find(a => a.id === selected);
  const input = 'w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-orange-500';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <Plane className="w-3.5 h-3.5 text-sky-400" />
          <h3 className="text-xs font-bold text-white">{t('air.title')}</h3>
          {on && <span className="text-[9px] text-slate-500">{t('air.count', { n: tracks.length })}</span>}
          {loading && <Loader2 className="w-3 h-3 animate-spin text-slate-500" />}
        </button>
        <button onClick={toggleOn} className={`px-2 py-0.5 rounded text-[10px] font-semibold ${on ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400'}`}>{on ? t('air.on') : t('air.off')}</button>
        <ChevronDown onClick={() => setOpen(o => !o)} className={`w-3.5 h-3.5 text-slate-500 cursor-pointer transition-transform ${open ? '' : '-rotate-90'}`} />
      </div>

      {open && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-1.5">
            <button onClick={toggle3D} disabled={!on} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-40 ${threeD ? 'bg-sky-500/20 border-sky-500/50 text-sky-200' : 'bg-slate-800/60 border-slate-700 text-slate-300'}`}>
              <Box className="w-3.5 h-3.5" />{threeD ? t('air.view2d') : t('air.view3d')}
            </button>
            <button onClick={startDeclare} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold bg-orange-500/20 border border-orange-500/50 text-orange-200">
              <PlaneTakeoff className="w-3.5 h-3.5" />{t('air.droneUp')}
            </button>
          </div>

          {declaring && (
            <div className="p-2.5 rounded-lg bg-slate-800/60 border border-orange-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-white">{t('air.declareTitle')}</p>
                <button onClick={() => setDeclaring(false)} className="p-1 text-slate-400"><X className="w-3.5 h-3.5" /></button>
              </div>
              <label className="block text-[10px] text-slate-400">{t('air.droneName')}
                <input className={input} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} maxLength={60} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[10px] text-slate-400">{t('air.ceiling')}
                  <input className={input} type="number" min="10" max="1500" value={form.ceiling} onChange={e => setForm(f => ({ ...f, ceiling: e.target.value }))} />
                </label>
                <label className="block text-[10px] text-slate-400">{t('air.radius')}
                  <input className={input} type="number" min="50" max="20000" step="50" value={form.radius} onChange={e => setForm(f => ({ ...f, radius: e.target.value }))} />
                </label>
              </div>
              <p className="text-[10px] text-slate-500">{t('air.declareNote')}</p>
              <button onClick={submitDeclare} disabled={busy} className="w-full py-2 rounded-lg bg-orange-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlaneTakeoff className="w-3.5 h-3.5" />}{t('air.declareGo')}
              </button>
            </div>
          )}

          {myFlights.map(f => (
            <div key={f.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-orange-500/10 border border-orange-500/40">
              <span aria-hidden="true">🛸</span>
              <span className="text-xs text-white flex-1 min-w-0 truncate">{f.label} · ≤{Math.round(f.ceiling_m ?? 0)} m · {Math.round(f.radius_m ?? 0)} m</span>
              <button onClick={() => land(f.id)} className="px-2 py-1 rounded bg-slate-800 border border-slate-600 text-[11px] text-white flex items-center gap-1"><PlaneLanding className="w-3 h-3" />{t('air.droneDown')}</button>
            </div>
          ))}
          {err && <p className="text-[11px] text-red-400">{err}</p>}

          {on && conflicts.length > 0 && (
            <div className="space-y-1">
              {conflicts.slice(0, 4).map((c, i) => (
                <div key={i} className={`px-2.5 py-2 rounded-lg border text-[11px] ${c.severity === 'critical' ? 'bg-red-600/20 border-red-500/60 text-red-100' : 'bg-amber-500/10 border-amber-500/40 text-amber-100'}`}>
                  <p className="font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3" />
                    {c.overlap ? t('air.overlap', { a: nameOf(c.drone), b: nameOf(c.other) })
                      : c.severity === 'critical' ? t('air.landNow', { who: nameOf(c.other) }) : t('air.approaching', { who: nameOf(c.other) })}
                  </p>
                  {!c.overlap && (
                    <p className="opacity-90">{t('air.conflictLine', {
                      kind: kindName(c.other.kind), alt: metres(c.other.alt_msl_m), km: (c.now / 1000).toFixed(1),
                      dir: bearingTo(c.drone, c.other), drone: nameOf(c.drone), cpa: (c.dist / 1000).toFixed(1), s: c.t,
                    })}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {on && (
            <div className="space-y-1 max-h-64 overflow-y-auto pr-0.5">
              {sorted.length === 0 && !loading && <p className="text-[11px] text-slate-500">{t('air.empty')}</p>}
              {sorted.map(a => (
                <button key={a.id} onClick={() => { setSelected(a.id === selected ? null : a.id); getMap()?.easeTo({ center: [a.lng, a.lat], duration: 600 }); }}
                  className={`w-full text-left px-2 py-1.5 rounded-lg border ${conflictIds.has(a.id) ? 'bg-red-500/10 border-red-500/50' : a.id === selected ? 'bg-slate-800 border-slate-600' : 'bg-slate-800/40 border-transparent'}`}>
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <span aria-hidden="true">{KIND_ICON[a.kind]}</span>
                    <span className="text-white font-medium truncate flex-1 min-w-0">{nameOf(a)}</span>
                    <span className="text-slate-200 tabular-nums">{a.source === 'declared' ? `≤${metres(a.ceiling_m)}` : metres(a.alt_msl_m)}</span>
                    <span className="text-[9px] px-1 rounded bg-slate-700 text-slate-300">{t(`air.src.${a.source}`)}</span>
                  </span>
                  {a.id === selected && sel && (
                    <span className="block mt-1 text-[10px] text-slate-400 space-y-0.5">
                      <span className="block">{kindName(sel.kind)}{sel.model ? ` · ${sel.model}` : ''}{sel.registration ? ` · ${sel.registration}` : ''}</span>
                      <span className="block">{t('air.detailAlt', { m: metres(sel.alt_msl_m), ft: feet(sel.alt_msl_m), src: sel.alt_source ? t(`air.altsrc.${sel.alt_source}`) : '—' })}</span>
                      {sel.speed_kmh != null && <span className="block">{t('air.detailSpeed', { v: sel.speed_kmh, h: Math.round(sel.heading ?? 0) })}</span>}
                      {center && <span className="block">{t('air.detailDist', { km: distanceKm({ lat: center.lat, lng: center.lng }, sel).toFixed(1), dir: bearingTo({ lat: center.lat, lng: center.lng }, sel) })}</span>}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {on && tooWide && <p className="text-[11px] text-amber-300 leading-snug">{t('air.zoomIn')}</p>}
          {coverKm != null && !tooWide && (
            <p className="text-[10px] text-slate-400 leading-snug">
              {t('air.coverage', { km: coverKm })}{(getMap()?.getZoom?.() ?? 8) < LABEL_MIN_ZOOM && ` ${t('air.zoomForNames')}`}
            </p>
          )}
          <p className="text-[9px] text-slate-600 leading-snug">{t('air.note')}</p>
        </div>
      )}
    </div>
  );
};

import { useState, useEffect, useRef } from 'react';
import { Map, Crosshair, Plus, Star, RefreshCw, X, Check, ExternalLink, CloudRain, PenTool, Layers, Upload, Download, Undo2, Hexagon, Circle, Spline } from 'lucide-react';
import TacticalMap from '../components/TacticalMap';
import { useDevices } from '../hooks/useDevices';
import { usePositions } from '../hooks/usePositions';
import { useTeam } from '../hooks/useTeam';
import { useMarkers, markerMeta, markerKindLabel } from '../hooks/useMarkers';
import { useMapViews } from '../hooks/useMapViews';
import { usePatients } from '../hooks/usePatients';
import { useMapShapes, categoryFitsKind, shapeCategoryLabel, shapeCategoryMeta } from '../hooks/useMapShapes';
import { useMapConfig } from '../hooks/useMapConfig';
import { useAuth } from '../auth/AuthContext';
import { hasAtLeast } from '../auth/roles';
import { TRIAGE_META } from '../lib/fieldCommands';
import { supabase } from '../lib/supabase';
import { getOrgId, cachedOrgId } from '../lib/org';
import { memberLink } from '../lib/link';
import { logEvent } from '../lib/eventLog';
import { distanceM, parseMapFile, toGeoJSON } from '../lib/geo';
import { RadioTower } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';

// ============================================
// TACTICAL MAP — the shared operational picture.
// Real devices, live crew positions, and shared markers only.
// ============================================

const KIND_ICON = { drone: '🚁', ptz_camera: '📹', camera: '📷', sensor: '📡', edge_box: '🖥️' };
const KIND_TYPE = { drone: 'drone', ptz_camera: 'camera', camera: 'camera', sensor: 'sensor', edge_box: 'sensor' };
const FRESH_MS = 10 * 60 * 1000; // crew fixes older than 10 min are stale

// Translate a key built from data; show the raw value when no text exists for it.
const tOr = (t, key, fallback) => { const v = t(key); return v === key ? fallback : v; };

// Layer visibility, remembered per viewer on this device
const LAYERS_KEY = 'wt-tac-layers';
const BASE_LAYERS = ['crew', 'devices', 'patients', 'markers', 'zones', 'routes'];
function loadLayers() {
  const d = { crew: true, devices: true, patients: true, markers: true, zones: true, routes: true, ov: {} };
  try {
    const s = JSON.parse(localStorage.getItem(LAYERS_KEY) || 'null');
    if (s && typeof s === 'object') return { ...d, ...s, ov: { ...(s.ov ?? {}) } };
  } catch { /* storage unavailable or corrupt */ }
  return d;
}
function saveLayers(v) {
  try { localStorage.setItem(LAYERS_KEY, JSON.stringify(v)); } catch { /* storage unavailable */ }
}

const IMPORT_MAX_SHAPES = 300;
const IMPORT_MAX_POINTS = 150;
const KIND_ICONS = { zone: Hexagon, circle: Circle, route: Spline };

export const TacticalMapTab = () => {
  const { t } = useI18n();
  const { profile, session } = useAuth() ?? {};
  const myId = session?.user?.id ?? profile?.id;
  const role = profile?.role;
  const canDraw = hasAtLeast(role, 'field');
  const { devices } = useDevices();
  const { latest: teamPositions } = usePositions();
  const { liveMembers } = useTeam();
  const { markers: liveMarkers, createMarker, createMarkers, updateMarker, removeMarker } = useMarkers();
  const { patients, counts: triageCounts } = usePatients();
  const { shapes, error: shapesError, createShape, createShapes, updateShape, removeShape } = useMapShapes();
  const { config: mapConfig, loaded: configLoaded, markerKinds, shapeCategories } = useMapConfig();
  const [myPos, setMyPos] = useState(null);
  const [zeroKey, setZeroKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [mapMode, setMapModeRaw] = useState('satellite');
  const modeTouched = useRef(false);
  const setMapMode = (m) => { modeTouched.current = true; setMapModeRaw(m); };
  // the company's default map type, unless this viewer already picked one
  useEffect(() => {
    if (configLoaded && !modeTouched.current) setMapModeRaw(mapConfig.default_mode);
  }, [configLoaded, mapConfig.default_mode]);

  // ---------- layers ----------
  const [layers, setLayers] = useState(loadLayers);
  const [layersOpen, setLayersOpen] = useState(false);
  const toggleLayer = (k) => setLayers(l => { const n = { ...l, [k]: !l[k] }; saveLayers(n); return n; });
  const overlayOn = (o) => layers.ov?.[o.id] ?? o.on_by_default;
  const toggleOverlay = (o) => setLayers(l => { const n = { ...l, ov: { ...l.ov, [o.id]: !overlayOn(o) } }; saveLayers(n); return n; });
  const visibleOverlays = mapConfig.overlays.filter(overlayOn);

  // ---------- drawing ----------
  const [drawOpen, setDrawOpen] = useState(false);
  const [drawKind, setDrawKind] = useState('zone');
  const [draft, setDraft] = useState(null); // { kind, category, color, alert, points, center, radius }
  const [drawBusy, setDrawBusy] = useState(false);
  const [shapeError, setShapeError] = useState(null);
  const [editingShapeId, setEditingShapeId] = useState(null);
  const [openShape, setOpenShape] = useState(null);
  const customCats = mapConfig.custom_shape_categories;
  const categoryLabel = (id) => shapeCategoryLabel(t, id, customCats);

  // ---------- import ----------
  const fileRef = useRef(null);
  const [imp, setImp] = useState(null); // { name, result, zoneCat, routeCat, busy, error }
  const [showWeather, setShowWeather] = useState(() => localStorage.getItem('wt-tac-radar') === '1');
  const toggleWeather = () => setShowWeather(v => {
    localStorage.setItem('wt-tac-radar', v ? '0' : '1');
    return !v;
  });
  // Comms coverage layer: recorded link samples over the last N hours
  const [showSignal, setShowSignal] = useState(() => localStorage.getItem('wt-tac-signal') === '1');
  const [signalHours, setSignalHours] = useState(() => Number(localStorage.getItem('wt-tac-signal-h') ?? 6));
  const [coverage, setCoverage] = useState(null);
  const toggleSignal = () => setShowSignal(v => { localStorage.setItem('wt-tac-signal', v ? '0' : '1'); return !v; });
  useEffect(() => {
    if (!showSignal) { setCoverage(null); return; }
    let cancelled = false;
    const load = async () => {
      const org = await getOrgId();
      const { data } = await supabase.from('positions').select('lat, lng, net_quality, at')
        .eq('org_id', org).not('net_quality', 'is', null)
        .gte('at', new Date(Date.now() - signalHours * 3600e3).toISOString())
        .order('at', { ascending: false }).limit(3000);
      if (!cancelled) setCoverage((data ?? []).map(d => ({ lat: d.lat, lng: d.lng, quality: d.net_quality })));
    };
    load();
    const id = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, [showSignal, signalHours]);
  const coverageCounts = (coverage ?? []).reduce((a, c) => { a[c.quality] = (a[c.quality] ?? 0) + 1; return a; }, {});
  const [markerPanelOpen, setMarkerPanelOpen] = useState(false);
  const [markerBusy, setMarkerBusy] = useState(false);
  const [markerError, setMarkerError] = useState(null);
  const [drag, setDrag] = useState({ kind: null, x: 0, y: 0 }); // palette drag ghost
  const cameraRef = useRef(null);      // { center, zoom } of the current view
  const mapWrapRef = useRef(null);     // map container, for drop hit-testing

  // Saved views ("fronts"): freeze the camera, jump between areas
  const { views, createView, updateView, removeView } = useMapViews();
  const [viewCam, setViewCam] = useState(null);       // { lat, lng, zoom } override
  const viewCamRef = useRef(null);
  const [activeViewId, setActiveViewId] = useState(null);
  const [savingView, setSavingView] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameText, setRenameText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [viewsError, setViewsError] = useState(null);
  const isPopped = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('pop') === 'tactical';

  // Open the map on the user's own area right away — rescuers need
  // their surroundings even before anything is registered.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setMyPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        // don't yank the camera if the operator already jumped to a saved view
        if (!viewCamRef.current) setZeroKey(k => k + 1);
      },
      () => { /* denied — map falls back to fleet/world view */ },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  const placed = devices.filter(d => d.lat != null && d.lng != null);
  const nameOf = Object.fromEntries(liveMembers.map(m => [m.id, m.name]));
  const unitOf = Object.fromEntries(liveMembers.filter(m => m.radioCallsign && m.radioCallsign !== '—').map(m => [m.id, m.radioCallsign]));

  const teamMarkers = teamPositions
    .filter(p => Date.now() - new Date(p.at) < FRESH_MS)
    .map(p => ({
      id: `pos-${p.profile_id}`,
      name: `${unitOf[p.profile_id] ? `${unitOf[p.profile_id]} · ` : ''}${nameOf[p.profile_id] ?? t('veh.someone')} (${new Date(p.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})${p.net_quality ? ` · 📶 ${tOr(t, `sig.q.${memberLink(p).quality}`, memberLink(p).quality)}${p.net_rtt_ms != null ? ` ${p.net_rtt_ms} ms` : ''}` : ''}`,
      type: 'person',
      status: 'live',
      position: { lat: p.lat, lng: p.lng },
      icon: '🧍',
    }));

  const tacticalMarkers = liveMarkers.map(m => {
    const meta = markerMeta(m.kind);
    const kindLabel = markerKindLabel(t, m.kind);
    return {
      id: m.id,
      name: m.label || kindLabel,
      rawLabel: m.label,
      kindLabel,
      icon: meta.icon,
      position: { lat: m.lat, lng: m.lng },
      notes: m.notes,
      meta: `${nameOf[m.created_by] ?? t('tac.team')} · ${new Date(m.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`,
    };
  });

  // Casualties on the board, colored by SALT triage category
  const patientMarkers = patients
    .filter(p => p.status === 'active' && p.lat != null && p.lng != null)
    .map(p => ({
      id: `pat-${p.id}`,
      name: `${p.tag ? t('tac.tag', { tag: p.tag }) : `P${p.num}`} · ${TRIAGE_META[p.triage] ? t(`tac.triage.${p.triage}`) : p.triage}`,
      type: 'person',
      status: p.triage,
      position: { lat: p.lat, lng: p.lng },
      icon: '🧑',
      color: TRIAGE_META[p.triage]?.dot,
    }));

  const mapDevices = [
    ...(layers.devices ? placed.map(d => ({
      id: d.id,
      name: d.name,
      type: KIND_TYPE[d.kind] ?? 'sensor',
      status: d.status,
      position: { lat: d.lat, lng: d.lng },
      icon: KIND_ICON[d.kind] ?? '📍',
    })) : []),
    ...(layers.crew ? teamMarkers : []),
    ...(layers.patients ? patientMarkers : []),
    ...(myPos ? [{ id: 'me', name: t('tac.myPosition'), type: 'person', status: 'here', position: myPos, icon: '📍' }] : []),
  ];

  // Drawn shapes, filtered by layer (the one being reshaped always stays)
  const mapShapes = shapes.filter(s =>
    s.id === editingShapeId || (s.kind === 'route' ? layers.routes : layers.zones));
  const canEditShape = (s) => s.created_by === myId || hasAtLeast(role, 'operator');
  const describeShape = (s) =>
    `${nameOf[s.created_by] ?? t('tac.team')} · ${new Date(s.updated_at ?? s.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`;
  const tableMissing = (msg) => /does not exist|schema cache/i.test(msg ?? '');

  // ---------- drawing ----------
  const startDraw = (kind, cat) => {
    setEditingShapeId(null);
    setShapeError(null);
    setDraft({ kind, category: cat.id, color: cat.color, alert: kind === 'route' ? 'none' : cat.alert, points: [], center: null, radius: 0 });
  };
  const onDrawClick = (pos) => setDraft(d => {
    if (!d) return d;
    if (d.kind === 'circle') {
      if (!d.center) return { ...d, center: pos };
      return { ...d, radius: Math.max(1, Math.round(distanceM(d.center, pos))) };
    }
    return { ...d, points: [...d.points, pos] };
  });
  const undoPoint = () => setDraft(d => {
    if (!d) return d;
    if (d.kind === 'circle') return d.radius ? { ...d, radius: 0 } : { ...d, center: null };
    return { ...d, points: d.points.slice(0, -1) };
  });
  const draftReady = draft && (draft.kind === 'zone' ? draft.points.length >= 3
    : draft.kind === 'route' ? draft.points.length >= 2
    : Boolean(draft.center) && draft.radius > 0);
  const finishDraw = async () => {
    if (!draftReady || drawBusy) return;
    setDrawBusy(true);
    setShapeError(null);
    try {
      const geometry = draft.kind === 'circle'
        ? { center: draft.center, radius: draft.radius }
        : { path: draft.points };
      const s = await createShape({ kind: draft.kind, category: draft.category, color: draft.color, alert: draft.alert, label: '', geometry });
      setDraft(null);
      setDrawOpen(false);
      if (s?.id) setOpenShape({ id: s.id, n: Date.now() }); // name it right away
    } catch (err) {
      setShapeError(tableMissing(err.message) ? t('map.tableMissing') : (err.message ?? t('map.saveFailed')));
    }
    setDrawBusy(false);
  };
  const draftHint = !draft ? ''
    : draft.kind === 'circle'
      ? (!draft.center ? t('map.draw.hintCenter') : t('map.draw.hintRadius'))
      : draft.kind === 'route' ? t('map.draw.hintRoute') : t('map.draw.hintZone');

  const finishReshape = () => {
    if (editingShapeId) logEvent('shape.reshaped', {}, editingShapeId);
    setEditingShapeId(null);
  };

  // ---------- import / export ----------
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setImp({ name: file.name, error: t('map.import.tooBig') }); return; }
    try {
      const text = await file.text();
      const result = parseMapFile(file.name, text);
      const firstZone = shapeCategories.find(c => categoryFitsKind(c, 'zone'));
      const firstRoute = shapeCategories.find(c => categoryFitsKind(c, 'route'));
      setImp({ name: file.name, result, zoneCat: firstZone?.id ?? '', routeCat: firstRoute?.id ?? '' });
    } catch (err) {
      setImp({ name: file.name, error: t('map.import.unreadable', { msg: err.message ?? '' }) });
    }
  };
  const runImport = async () => {
    if (!imp?.result) return;
    setImp(i => ({ ...i, busy: true, error: null }));
    try {
      const { zones, routes, points } = imp.result;
      const zc = shapeCategoryMeta(imp.zoneCat, customCats);
      const rc = shapeCategoryMeta(imp.routeCat, customCats);
      const rows = [
        ...zones.map(z => ({ kind: 'zone', category: imp.zoneCat, color: zc?.color ?? '#38bdf8', alert: zc?.alert ?? 'none', label: z.label, notes: z.notes, geometry: { path: z.path } })),
        ...routes.map(r => ({ kind: 'route', category: imp.routeCat, color: rc?.color ?? '#38bdf8', alert: 'none', label: r.label, notes: r.notes, geometry: { path: r.path } })),
      ].slice(0, IMPORT_MAX_SHAPES);
      if (rows.length) await createShapes(rows);
      const pts = points.slice(0, IMPORT_MAX_POINTS).map(p => ({ kind: 'poi', label: p.label, notes: p.notes, lat: p.lat, lng: p.lng }));
      if (pts.length) await createMarkers(pts);
      setImp(null);
    } catch (err) {
      setImp(i => ({ ...i, busy: false, error: tableMissing(err.message) ? t('map.tableMissing') : err.message }));
    }
  };
  const exportGeoJSON = () => {
    const org = cachedOrgId();
    const fc = toGeoJSON({
      shapes,
      markers: liveMarkers.filter(m => !org || m.org_id === org), // never hand out a linked company's points
      labels: { category: categoryLabel, markerKind: (k) => markerKindLabel(t, k) },
      name: t('tac.title'),
    });
    const blob = new Blob([JSON.stringify(fc, null, 1)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watchtower-map-${new Date().toISOString().slice(0, 10)}.geojson`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    logEvent('map.exported', { features: fc.features.length });
  };

  const anchors = [...placed.map(d => ({ lat: d.lat, lng: d.lng })), ...teamMarkers.map(t => t.position)];
  const baseCenter = myPos ?? (anchors.length
    ? {
        lat: anchors.reduce((a, p) => a + p.lat, 0) / anchors.length,
        lng: anchors.reduce((a, p) => a + p.lng, 0) / anchors.length,
      }
    : { lat: 20, lng: 0 });
  const center = viewCam ? { lat: viewCam.lat, lng: viewCam.lng } : baseCenter;
  const zoom = viewCam ? viewCam.zoom : myPos ? 14 : anchors.length ? 11 : 2;

  // ---------- saved views ----------
  const currentCam = () => {
    const cam = cameraRef.current;
    return cam?.center && Number.isFinite(cam.zoom)
      ? { lat: cam.center.lat, lng: cam.center.lng, zoom: cam.zoom }
      : { ...center, zoom };
  };

  const applyView = (v) => {
    setMapMode(v.map_mode || 'satellite');
    const camNext = { lat: v.lat, lng: v.lng, zoom: v.zoom };
    setViewCam(camNext);
    viewCamRef.current = camNext;
    setActiveViewId(v.id);
    setZeroKey(k => k + 1);
  };

  const saveCurrentView = async () => {
    const name = saveName.trim() || `Front ${views.length + 1}`;
    setViewsError(null);
    try {
      const v = await createView({ name, ...currentCam(), map_mode: mapMode });
      setActiveViewId(v.id);
      setSavingView(false);
      setSaveName('');
    } catch (err) {
      setViewsError(/does not exist/i.test(err.message ?? '')
        ? t('tac.viewsTableMissing')
        : (err.message ?? t('tac.viewSaveFailed')));
    }
  };

  const refreezeView = (id) => {
    setViewsError(null);
    updateView(id, { ...currentCam(), map_mode: mapMode }).catch(e => setViewsError(e.message));
  };

  const commitRename = (id) => {
    const name = renameText.trim();
    setRenamingId(null);
    if (name) updateView(id, { name }).catch(e => setViewsError(e.message));
  };

  const dropAt = async (kindId, pos) => {
    setMarkerBusy(true);
    setMarkerError(null);
    try {
      await createMarker({ kind: kindId, label: '', lat: pos.lat, lng: pos.lng });
      setMarkerPanelOpen(false);
    } catch (err) {
      // Never fail silently — a missing table or refused permission must be visible
      setMarkerError(
        /does not exist/i.test(err.message ?? '')
          ? t('tac.markersTableMissing')
          : (err.message ?? t('tac.markerCreateFailed'))
      );
    }
    setMarkerBusy(false);
  };

  // Convert a screen point inside the map container to lat/lng using the
  // current camera (web-mercator math; the Google map is flat).
  const pixelToLatLng = (x, y, rect) => {
    const cam = cameraRef.current ?? { center: myPos ?? center, zoom };
    if (!cam.center || !Number.isFinite(cam.zoom)) return null;
    const world = 256 * Math.pow(2, cam.zoom);
    const dx = x - (rect.left + rect.width / 2);
    const dy = y - (rect.top + rect.height / 2);
    const lng = ((cam.center.lng + (dx * 360) / world + 540) % 360) - 180;
    const y0 = Math.log(Math.tan(Math.PI / 4 + (cam.center.lat * Math.PI) / 360));
    const y1 = y0 - dy * ((2 * Math.PI) / world);
    const lat = ((2 * Math.atan(Math.exp(y1)) - Math.PI / 2) * 180) / Math.PI;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat: Math.max(-85, Math.min(85, lat)), lng };
  };

  // Press a palette type and DRAG it onto the map (works with mouse and
  // touch); a plain tap still drops at the center of the view.
  const startDrag = (e, kindId) => {
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    let moved = false;
    setDrag({ kind: kindId, x: startX, y: startY });
    const onMove = (ev) => {
      if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 6) moved = true;
      setDrag(d => (d.kind ? { ...d, x: ev.clientX, y: ev.clientY } : d));
    };
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setDrag({ kind: null, x: 0, y: 0 });
      if (ev.type === 'pointercancel') return;
      const rect = mapWrapRef.current?.getBoundingClientRect();
      if (!moved) {
        const c = cameraRef.current?.center ?? myPos ?? center;
        dropAt(kindId, c);
        return;
      }
      if (rect && ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom) {
        const pos = pixelToLatLng(ev.clientX, ev.clientY, rect);
        if (pos) dropAt(kindId, pos);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const zeroIn = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    setViewCam(null);
    viewCamRef.current = null;
    setActiveViewId(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setMyPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setZeroKey(k => k + 1);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      <div className="flex items-center justify-between flex-shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-bold text-white">{t('tac.title')}</h2>
          <span className="text-xs text-slate-500">
            {t(placed.length === 1 ? 'tac.device1' : 'tac.deviceN', { n: placed.length })} · {t('tac.liveCrew', { n: teamMarkers.length })}
          </span>
          {/* Triage board: live casualty counts by SALT category */}
          {Object.keys(triageCounts).length > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/70 border border-slate-700 rounded-lg">
              {['red', 'yellow', 'green', 'gray', 'black', 'unknown'].map(c =>
                triageCounts[c] ? (
                  <span key={c} className="flex items-center gap-1 text-[10px] font-bold text-white" title={t(`tac.triage.${c}`)}>
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: TRIAGE_META[c].dot }} />
                    {triageCounts[c]}
                  </span>
                ) : null
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setMarkerPanelOpen(o => !o); setDrawOpen(false); setDraft(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
              markerPanelOpen ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            {t('tac.marker')}
          </button>
          {canDraw && (
            <button
              onClick={() => { setDrawOpen(o => !o); setDraft(null); setMarkerPanelOpen(false); setEditingShapeId(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                drawOpen || draft ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title={t('map.drawTitle')}
            >
              <PenTool className="w-3.5 h-3.5" />
              {t('map.draw')}
            </button>
          )}
          <button
            onClick={() => setLayersOpen(o => !o)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
              layersOpen ? 'bg-sky-500/20 border-sky-500/40 text-sky-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title={t('map.layersTitle')}
          >
            <Layers className="w-3.5 h-3.5" />
            {t('map.layers')}
          </button>
          {canDraw && (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-700"
              title={t('map.importTitle')}
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('map.import')}</span>
            </button>
          )}
          <button
            onClick={exportGeoJSON}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-700"
            title={t('map.exportTitle')}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('map.export')}</span>
          </button>
          <input ref={fileRef} type="file" accept=".geojson,.json,.kml,application/geo+json,application/vnd.google-earth.kml+xml" onChange={onFile} className="hidden" />
          <button
            onClick={zeroIn}
            disabled={locating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/15 border border-sky-500/30 text-sky-300 rounded-lg text-xs font-medium hover:bg-sky-500/25 disabled:opacity-50"
          >
            <Crosshair className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
            {t('tac.myArea')}
          </button>
          {!isPopped && (
            <button
              onClick={() => window.open(`${window.location.origin}/?pop=tactical`, '_blank', 'width=1280,height=850,popup=yes')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-700"
              title={t('tac.popOutTitle')}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t('tac.popOut')}
            </button>
          )}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            {['satellite', 'roadmap', 'terrain', 'hybrid'].map(m => (
              <button
                key={m}
                onClick={() => setMapMode(m)}
                className={`px-2 py-1 rounded text-xs capitalize ${mapMode === m ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {t(`tac.mode.${m}`)}
              </button>
            ))}
            <button
              onClick={toggleWeather}
              title={t('tac.radarTitle')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${showWeather ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <CloudRain className="w-3.5 h-3.5" />
              {t('tac.radar')}
            </button>
            <button
              onClick={toggleSignal}
              title={t('tac.signalTitle')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${showSignal ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <RadioTower className="w-3.5 h-3.5" />
              {t('tac.signal')}
            </button>
          </div>
        </div>
      </div>

      {/* Saved views: freeze camera positions as named quick references */}
      <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
        {views.map(v => (
          <div
            key={v.id}
            className={`flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg border text-xs ${
              activeViewId === v.id
                ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {renamingId === v.id ? (
              <input
                autoFocus
                value={renameText}
                onChange={e => setRenameText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(v.id); if (e.key === 'Escape') setRenamingId(null); }}
                onBlur={() => commitRename(v.id)}
                className="w-24 bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-xs text-white focus:outline-none"
              />
            ) : (
              <button
                onClick={() => applyView(v)}
                onDoubleClick={() => { setRenamingId(v.id); setRenameText(v.name); }}
                title={t('tac.viewJumpTitle')}
                className="font-medium"
              >
                {v.name}
              </button>
            )}
            {activeViewId === v.id && (
              <button
                onClick={() => refreezeView(v.id)}
                className="p-0.5 text-slate-400 hover:text-orange-300"
                title={t('tac.refreezeTitle')}
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
            {confirmDeleteId === v.id ? (
              <button
                onClick={() => { removeView(v.id).catch(e => setViewsError(e.message)); setConfirmDeleteId(null); if (activeViewId === v.id) setActiveViewId(null); }}
                className="px-1 py-0.5 text-[10px] font-bold text-red-400"
                title={t('tac.confirmDelete')}
              >
                {t('tac.sure')}
              </button>
            ) : (
              <button
                onClick={() => { setConfirmDeleteId(v.id); setTimeout(() => setConfirmDeleteId(c => (c === v.id ? null : c)), 2500); }}
                className="p-0.5 text-slate-500 hover:text-red-400"
                title={t('tac.deleteView')}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}

        {savingView ? (
          <div className="flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg border border-orange-500/40 bg-orange-500/10">
            <Star className="w-3 h-3 text-orange-400" />
            <input
              autoFocus
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveCurrentView(); if (e.key === 'Escape') { setSavingView(false); setSaveName(''); } }}
              placeholder={`Front ${views.length + 1}`}
              className="w-28 bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <button onClick={saveCurrentView} className="p-0.5 text-green-400 hover:text-green-300" title={t('veh.save')}>
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSavingView(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-slate-600 text-xs text-slate-400 hover:border-orange-500/40 hover:text-orange-300"
            title={t('tac.saveViewTitle')}
          >
            <Star className="w-3 h-3" />
            {t('tac.saveView')}
          </button>
        )}
        {viewsError && <span className="text-[10px] text-red-400">{viewsError}</span>}
      </div>

      {/* Marker creation: tap a type -> it drops at the center of your view */}
      {markerPanelOpen && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex-shrink-0 space-y-1.5">
          <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-10 gap-1">
            {markerKinds.map(k => (
              <button
                key={k.id}
                onPointerDown={(e) => !markerBusy && startDrag(e, k.id)}
                disabled={markerBusy}
                style={{ touchAction: 'none' }}
                className="flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg border text-[9px] bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-orange-500/15 hover:border-orange-500/40 hover:text-orange-300 disabled:opacity-50 cursor-grab active:cursor-grabbing select-none"
              >
                <span className="text-base leading-none pointer-events-none">{k.icon}</span>
                <span className="pointer-events-none text-center leading-tight">{k.custom ? k.label : t(`marker.${k.id}`)}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500">
            <b className="text-slate-400">{t('tac.drag')}</b> {t('tac.dragHelp')}
          </p>
          {markerError && <p className="text-[10px] text-red-400">{markerError}</p>}
        </div>
      )}

      {/* Layers: what this viewer sees (remembered on this device) */}
      {layersOpen && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex-shrink-0 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {BASE_LAYERS.map(k => (
              <button key={k} onClick={() => toggleLayer(k)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs ${layers[k] ? 'bg-sky-500/15 border-sky-500/40 text-sky-200' : 'bg-slate-800/50 border-slate-700 text-slate-500 line-through'}`}>
                {layers[k] && <Check className="w-3 h-3" />}{t(`map.layer.${k}`)}
              </button>
            ))}
          </div>
          {mapConfig.overlays.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">{t('map.overlays')}</p>
              <div className="flex flex-wrap gap-1.5">
                {mapConfig.overlays.map(o => (
                  <button key={o.id} onClick={() => toggleOverlay(o)} title={o.attribution || o.name}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs ${overlayOn(o) ? 'bg-sky-500/15 border-sky-500/40 text-sky-200' : 'bg-slate-800/50 border-slate-700 text-slate-500'}`}>
                    {overlayOn(o) && <Check className="w-3 h-3" />}{o.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="text-[10px] text-slate-500">{t('map.layersHelp')}</p>
        </div>
      )}

      {/* Draw: pick a kind and a category, then tap the map */}
      {drawOpen && !draft && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex-shrink-0 space-y-2">
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 w-fit">
            {['zone', 'circle', 'route'].map(k => {
              const Icon = KIND_ICONS[k];
              return (
                <button key={k} onClick={() => setDrawKind(k)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs ${drawKind === k ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                  <Icon className="w-3.5 h-3.5" />{t(`map.kind.${k}`)}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {shapeCategories.filter(c => categoryFitsKind(c, drawKind)).map(c => (
              <button key={c.id} onClick={() => startDraw(drawKind, c)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-xs text-slate-200 hover:border-orange-500/40 hover:bg-orange-500/10">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: c.color }} />
                {categoryLabel(c.id)}
                {drawKind !== 'route' && c.alert !== 'none' && <span className="text-[9px] text-amber-300">🔔</span>}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500">{t('map.drawHelp')}</p>
          {shapeError && <p className="text-[10px] text-red-400">{shapeError}</p>}
        </div>
      )}

      {/* Import preview */}
      {imp && (
        <div className="bg-slate-900 border border-sky-500/40 rounded-xl p-3 flex-shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-white truncate">{t('map.import.title', { name: imp.name })}</p>
            <button onClick={() => setImp(null)} className="p-1 text-slate-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>
          </div>
          {imp.result && (
            <>
              <p className="text-xs text-slate-300">
                {t('map.import.counts', { zones: imp.result.zones.length, routes: imp.result.routes.length, points: imp.result.points.length })}
                {imp.result.skipped > 0 && <span className="text-slate-500"> · {t('map.import.skipped', { n: imp.result.skipped })}</span>}
              </p>
              {(imp.result.zones.length + imp.result.routes.length > IMPORT_MAX_SHAPES || imp.result.points.length > IMPORT_MAX_POINTS) && (
                <p className="text-[10px] text-amber-300">{t('map.import.capped', { shapes: IMPORT_MAX_SHAPES, points: IMPORT_MAX_POINTS })}</p>
              )}
              <div className="flex flex-wrap gap-3">
                {imp.result.zones.length > 0 && (
                  <label className="text-[10px] text-slate-400">{t('map.import.zonesAs')}
                    <select value={imp.zoneCat} onChange={e => setImp(i => ({ ...i, zoneCat: e.target.value }))}
                      className="block mt-0.5 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white">
                      {shapeCategories.filter(c => categoryFitsKind(c, 'zone')).map(c => <option key={c.id} value={c.id}>{categoryLabel(c.id)}</option>)}
                    </select>
                  </label>
                )}
                {imp.result.routes.length > 0 && (
                  <label className="text-[10px] text-slate-400">{t('map.import.routesAs')}
                    <select value={imp.routeCat} onChange={e => setImp(i => ({ ...i, routeCat: e.target.value }))}
                      className="block mt-0.5 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white">
                      {shapeCategories.filter(c => categoryFitsKind(c, 'route')).map(c => <option key={c.id} value={c.id}>{categoryLabel(c.id)}</option>)}
                    </select>
                  </label>
                )}
                {imp.result.points.length > 0 && <p className="text-[10px] text-slate-400 self-end">{t('map.import.pointsAs')}</p>}
              </div>
              <button onClick={runImport}
                disabled={imp.busy || imp.result.zones.length + imp.result.routes.length + imp.result.points.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 rounded-lg text-xs font-semibold text-white disabled:opacity-50">
                <Upload className="w-3.5 h-3.5" />{imp.busy ? t('map.import.busy') : t('map.import.go')}
              </button>
            </>
          )}
          {imp.error && <p className="text-[10px] text-red-400">{imp.error}</p>}
        </div>
      )}
      {shapesError && tableMissing(shapesError) && (
        <p className="text-[10px] text-amber-300 flex-shrink-0">{t('map.tableMissing')}</p>
      )}

      <div
        ref={mapWrapRef}
        className={`flex-1 min-h-[260px] short:min-h-[200px] rounded-xl overflow-hidden border relative ${drag.kind ? 'border-orange-500 ring-2 ring-orange-500/40' : 'border-slate-800'}`}
      >
        <TacticalMap
          key={zeroKey}
          mapMode={mapMode}
          showWeather={showWeather}
          coverage={showSignal ? coverage : null}
          devices={mapDevices}
          center={center}
          zoom={zoom}
          alerts={[]}
          markers={tacticalMarkers}
          showMarkers={layers.markers}
          onMarkerMove={(id, pos) => updateMarker(id, pos).catch(() => {})}
          onMarkerEdit={(id, patch) => updateMarker(id, patch).catch(() => {})}
          onMarkerDelete={(id) => removeMarker(id).catch(() => {})}
          onCameraChanged={(cam) => { if (cam?.center) cameraRef.current = cam; }}
          onMapClick={draft ? onDrawClick : undefined}
          draft={draft}
          shapes={mapShapes}
          shapeCategories={shapeCategories}
          categoryLabel={categoryLabel}
          describeShape={describeShape}
          canEditShape={canEditShape}
          onShapeSave={(id, patch) => updateShape(id, patch).catch(e => setShapeError(e.message))}
          onShapeDelete={(id) => { if (editingShapeId === id) setEditingShapeId(null); removeShape(id).catch(e => setShapeError(e.message)); }}
          editingShapeId={editingShapeId}
          onShapeEditToggle={(id) => (id ? setEditingShapeId(id) : finishReshape())}
          onShapeGeometry={(id, geometry) => updateShape(id, { geometry }, { quiet: true }).catch(e => setShapeError(e.message))}
          openShape={openShape}
          overlays={visibleOverlays}
        />
        {/* Drawing toolbar */}
        {draft && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[min(94%,440px)] bg-slate-900/95 border border-orange-500/50 rounded-xl px-3 py-2 space-y-1.5 shadow-xl">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm inline-block flex-shrink-0" style={{ background: draft.color }} />
              <span className="text-xs font-semibold text-white truncate">{categoryLabel(draft.category)} · {t(`map.kind.${draft.kind}`)}</span>
              <span className="ml-auto text-[10px] text-slate-400 whitespace-nowrap">
                {draft.kind === 'circle'
                  ? (draft.radius ? t('map.draw.radiusM', { m: draft.radius }) : '')
                  : t('map.draw.points', { n: draft.points.length })}
              </span>
            </div>
            <p className="text-[10px] text-slate-300">{draftHint}</p>
            {draft.kind === 'circle' && draft.center && (
              <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
                {t('map.draw.radius')}
                <input type="number" min="1" step="10" value={draft.radius || ''} placeholder="500"
                  onChange={e => { const v = Math.round(Number(e.target.value)); setDraft(d => ({ ...d, radius: Number.isFinite(v) && v > 0 ? v : 0 })); }}
                  className="w-24 px-2 py-0.5 bg-slate-800 border border-slate-600 rounded text-xs text-white" />
                m
              </label>
            )}
            <div className="flex items-center gap-1.5">
              <button onClick={undoPoint}
                disabled={draft.kind === 'circle' ? !draft.center : draft.points.length === 0}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 disabled:opacity-40">
                <Undo2 className="w-3.5 h-3.5" />{t('map.draw.undo')}
              </button>
              <button onClick={finishDraw} disabled={!draftReady || drawBusy}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500 text-xs font-semibold text-white disabled:opacity-40">
                <Check className="w-3.5 h-3.5" />{t('map.draw.finish')}
              </button>
              <button onClick={() => setDraft(null)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300">
                <X className="w-3.5 h-3.5" />{t('map.draw.cancel')}
              </button>
            </div>
            {shapeError && <p className="text-[10px] text-red-400">{shapeError}</p>}
          </div>
        )}
        {/* Reshaping bar */}
        {editingShapeId && !draft && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[min(94%,440px)] bg-slate-900/95 border border-sky-500/50 rounded-xl px-3 py-2 flex items-center gap-2 shadow-xl">
            <p className="text-[11px] text-slate-200 flex-1">{t('map.reshapeHelp')}</p>
            <button onClick={finishReshape} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600 text-xs font-semibold text-white">
              <Check className="w-3.5 h-3.5" />{t('map.reshapeDone')}
            </button>
          </div>
        )}
        {!draft && !editingShapeId && shapeError && (
          <p className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-red-300 bg-slate-900/90 border border-red-500/40 rounded-lg px-2 py-1">{shapeError}</p>
        )}
        {/* Credit for company overlays */}
        {visibleOverlays.some(o => o.attribution) && (
          <p className="absolute bottom-0.5 left-1/2 -translate-x-1/2 max-w-[60%] truncate text-[9px] text-slate-200 bg-slate-900/70 px-1.5 rounded pointer-events-none">
            {visibleOverlays.filter(o => o.attribution).map(o => o.attribution).join(' · ')}
          </p>
        )}
        {showSignal && (
          <div className="absolute left-2 bottom-8 bg-slate-900/90 border border-slate-700 rounded-lg px-2.5 py-2 space-y-1.5 text-[10px]">
            <div className="flex items-center gap-1">
              <RadioTower className="w-3 h-3 text-green-400" />
              <span className="text-slate-200 font-semibold">{t('tac.coverage')}</span>
              {[1, 6, 24].map(h => (
                <button key={h} onClick={() => { setSignalHours(h); localStorage.setItem('wt-tac-signal-h', String(h)); }}
                  className={`px-1.5 py-0.5 rounded ${signalHours === h ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white'}`}>{t('tac.hours', { h })}</button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {[['good', '#22c55e', 'Good'], ['fair', '#eab308', 'Fair'], ['poor', '#f97316', 'Weak'], ['offline', '#ef4444', 'No signal']].map(([q, c]) => (
                <span key={q} className="flex items-center gap-1 text-slate-300">
                  <span className="w-2 h-2 rounded-full" style={{ background: c }} />{t(`sig.q.${q}`)} {coverageCounts[q] ?? 0}
                </span>
              ))}
            </div>
            {coverage && coverage.length === 0 && <p className="text-slate-500">{t('tac.noSamples')}</p>}
          </div>
        )}
        {placed.length === 0 && teamMarkers.length === 0 && tacticalMarkers.length === 0 && shapes.length === 0 && !draft && !editingShapeId && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900/85 border border-slate-700 rounded-lg px-3 py-1.5 pointer-events-none">
            <p className="text-[10px] text-slate-300">
              {t('tac.empty')}
            </p>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-600 flex items-center gap-1.5 flex-shrink-0">
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
        {t('tac.footer')}
      </p>

      {/* Ghost icon that follows the pointer while dragging from the palette */}
      {drag.kind && (
        <div
          style={{ position: 'fixed', left: drag.x - 17, top: drag.y - 17, zIndex: 9999, pointerEvents: 'none' }}
          className="w-[34px] h-[34px] rounded-full bg-slate-900/90 border-2 border-orange-500 flex items-center justify-center shadow-xl"
        >
          <span style={{ fontSize: 17 }}>{markerMeta(drag.kind).icon}</span>
        </div>
      )}
    </div>
  );
};

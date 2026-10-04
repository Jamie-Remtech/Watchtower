import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import { Flame, Camera, Radio, Wind, Video } from 'lucide-react';
import DeviceFeedViewer from './DeviceFeedViewer';
import { useI18n } from '../i18n/index.jsx';
import { overlayTileUrl, shapeAnchor, pathLengthM, polygonAreaM2, isLatLng } from '../lib/geo';

// Translate a key built from data; show the raw value when no text exists for it.
const tOr = (t, key, fallback) => { const v = t(key); return v === key ? fallback : v; };

// Live precipitation radar (RainViewer) over the tactical map.
// RainViewer's native tiles stop at zoom 7, so beyond that each Google
// tile shows the right crop of the z7 tile scaled up — blocky at street
// level but the radar data itself is ~1 km resolution anyway.
const RADAR_MAX_NATIVE_Z = 7;
const makeRadarMapType = (host, path) => ({
  tileSize: new window.google.maps.Size(256, 256),
  name: 'watchtower-radar',
  getTile(coord, zoom, doc) {
    const div = doc.createElement('div');
    div.style.cssText = 'width:256px;height:256px;position:relative;overflow:hidden';
    const worldTiles = 1 << zoom;
    let x = coord.x % worldTiles;
    if (x < 0) x += worldTiles;
    const y = coord.y;
    if (y < 0 || y >= worldTiles) return div;
    const z = Math.min(zoom, RADAR_MAX_NATIVE_Z);
    const scale = 1 << (zoom - z);
    const img = doc.createElement('img');
    img.src = `${host}${path}/256/${z}/${Math.floor(x / scale)}/${Math.floor(y / scale)}/4/1_1.png`;
    img.style.cssText =
      `position:absolute;width:${256 * scale}px;height:${256 * scale}px;` +
      `left:${-(x % scale) * 256}px;top:${-(y % scale) * 256}px;opacity:0.65;pointer-events:none`;
    div.appendChild(img);
    return div;
  },
  releaseTile() {},
});

// Communications coverage: one dot per recorded link sample, coloured by
// quality (green good → red no signal). Drawn as map circles so they
// scale with the ground, not the screen.
const COVERAGE_COLOR = { good: '#22c55e', fair: '#eab308', poor: '#f97316', offline: '#ef4444' };
const CoverageOverlay = ({ samples }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || !samples?.length || !window.google?.maps) return;
    const circles = samples
      .filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng) && COVERAGE_COLOR[s.quality])
      .map(s => new window.google.maps.Circle({
        map, center: { lat: s.lat, lng: s.lng }, radius: 45,
        strokeWeight: 0, fillColor: COVERAGE_COLOR[s.quality], fillOpacity: 0.55, clickable: false,
      }));
    return () => circles.forEach(c => c.setMap(null));
  }, [map, samples]);
  return null;
};

const RadarOverlay = ({ visible }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || !visible || !window.google?.maps) return;
    let cancelled = false;
    let current = null;
    const removeOverlay = (o) => {
      const arr = map.overlayMapTypes;
      for (let i = arr.getLength() - 1; i >= 0; i--) {
        if (arr.getAt(i) === o) arr.removeAt(i);
      }
    };
    const apply = async () => {
      try {
        const j = await fetch('https://api.rainviewer.com/public/weather-maps.json').then(r => r.json());
        const frame = j?.radar?.past?.at(-1);
        if (!frame || cancelled) return;
        const next = makeRadarMapType(j.host, frame.path);
        map.overlayMapTypes.push(next);
        if (current) removeOverlay(current);
        current = next;
      } catch { /* radar feed unreachable — map stays clean */ }
    };
    apply();
    const t = setInterval(apply, 5 * 60 * 1000); // newest frame every 5 min
    return () => { cancelled = true; clearInterval(t); if (current) removeOverlay(current); };
  }, [map, visible]);
  return null;
};

// ---------- drawn shapes (zones, circles, routes) ----------
// Core Maps API objects only (the Drawing Library is gone). Objects are
// kept per shape id and updated in place, so an edit in progress is never
// torn down by a realtime refresh.
function round7(n) { return Math.round(n * 1e7) / 1e7; }
function shapeStyle(s, editing) {
  const g = window.google.maps;
  const color = s.color || '#38bdf8';
  const on = s.active !== false;
  if (s.kind === 'route') {
    const arrows = s.category !== 'fire_line'
      ? [{ icon: { path: g.SymbolPath.FORWARD_OPEN_ARROW, scale: 2.5, strokeColor: color, strokeOpacity: on ? 1 : 0.4 }, offset: '60px', repeat: '160px' }]
      : [];
    return { strokeColor: color, strokeOpacity: on ? 0.95 : 0.35, strokeWeight: editing ? 6 : 4, icons: arrows };
  }
  return {
    strokeColor: color, strokeOpacity: on ? 0.95 : 0.4, strokeWeight: editing ? 3 : 2,
    fillColor: color, fillOpacity: on ? (s.alert && s.alert !== 'none' ? 0.22 : 0.15) : 0.05,
  };
}
function readGeometry(rec) {
  if (rec.kind === 'circle') {
    const c = rec.obj.getCenter();
    return { center: { lat: round7(c.lat()), lng: round7(c.lng()) }, radius: Math.max(1, Math.round(rec.obj.getRadius())) };
  }
  return { path: rec.obj.getPath().getArray().map(ll => ({ lat: round7(ll.lat()), lng: round7(ll.lng()) })) };
}
function applyGeometry(rec, s) {
  const geo = s.geometry ?? {};
  if (rec.kind === 'circle') {
    if (isLatLng(geo.center)) rec.obj.setCenter(geo.center);
    rec.obj.setRadius(Number(geo.radius) || 1);
  } else {
    rec.obj.setPath((geo.path ?? []).filter(isLatLng));
  }
}
function makeShapeObject(s, map) {
  const g = window.google.maps;
  const geo = s.geometry ?? {};
  if (s.kind === 'circle') {
    return new g.Circle({ map, center: isLatLng(geo.center) ? geo.center : { lat: 0, lng: 0 }, radius: Number(geo.radius) || 1, ...shapeStyle(s) });
  }
  const path = (geo.path ?? []).filter(isLatLng);
  if (s.kind === 'route') return new g.Polyline({ map, path, ...shapeStyle(s) });
  return new g.Polygon({ map, paths: path, ...shapeStyle(s) });
}

const ShapesLayer = ({ shapes, interactive, editingId, onSelect, onGeometryChange }) => {
  const map = useMap();
  const recs = useRef(new globalThis.Map()); // id → { obj, kind, sig, click }
  const cbs = useRef({});
  cbs.current = { onSelect, onGeometryChange };

  useEffect(() => () => {
    for (const r of recs.current.values()) { r.click?.remove(); r.obj.setMap(null); }
    recs.current.clear();
  }, []);

  useEffect(() => {
    if (!map || !window.google?.maps) return;
    const seen = new Set();
    for (const s of shapes) {
      seen.add(s.id);
      const sig = JSON.stringify([s.geometry, s.color, s.active, s.alert, s.category]);
      let rec = recs.current.get(s.id);
      if (rec && rec.kind !== s.kind) { rec.click?.remove(); rec.obj.setMap(null); rec = null; }
      if (!rec) {
        const obj = makeShapeObject(s, map);
        rec = { obj, kind: s.kind, sig };
        rec.click = obj.addListener('click', (e) => {
          const ll = e?.latLng;
          cbs.current.onSelect?.(s.id, ll ? { lat: ll.lat(), lng: ll.lng() } : null);
        });
        recs.current.set(s.id, rec);
      } else if (rec.sig !== sig && s.id !== editingId) {
        applyGeometry(rec, s);
        rec.sig = sig;
      }
      rec.obj.setOptions({ ...shapeStyle(s, s.id === editingId), clickable: interactive, editable: s.id === editingId });
    }
    for (const [id, r] of recs.current) {
      if (!seen.has(id)) { r.click?.remove(); r.obj.setMap(null); recs.current.delete(id); }
    }
  }, [map, shapes, interactive, editingId]);

  // While a shape is editable, save its geometry shortly after each change.
  useEffect(() => {
    if (!editingId || !map) return;
    const rec = recs.current.get(editingId);
    if (!rec) return;
    const listeners = [];
    let timer = null;
    const flush = () => { timer = null; cbs.current.onGeometryChange?.(editingId, readGeometry(rec)); };
    const changed = () => { clearTimeout(timer); timer = setTimeout(flush, 700); };
    if (rec.kind === 'circle') {
      listeners.push(rec.obj.addListener('radius_changed', changed), rec.obj.addListener('center_changed', changed));
    } else {
      const path = rec.obj.getPath();
      for (const ev of ['set_at', 'insert_at', 'remove_at']) listeners.push(path.addListener(ev, changed));
    }
    return () => {
      listeners.forEach(l => l.remove());
      if (timer) { clearTimeout(timer); flush(); } // never lose the last drag
    };
  }, [editingId, map]);

  return null;
};

// Preview of the shape being drawn.
const DraftLayer = ({ draft }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || !draft || !window.google?.maps) return;
    const g = window.google.maps;
    const color = draft.color || '#f97316';
    const objs = [];
    const pts = draft.points ?? [];
    if (draft.kind === 'circle') {
      if (draft.center && draft.radius > 0) {
        objs.push(new g.Circle({ map, center: draft.center, radius: draft.radius, strokeColor: color, strokeWeight: 2, fillColor: color, fillOpacity: 0.2, clickable: false }));
      }
    } else if (draft.kind === 'zone' && pts.length >= 3) {
      objs.push(new g.Polygon({ map, paths: pts, strokeColor: color, strokeWeight: 2, fillColor: color, fillOpacity: 0.2, clickable: false }));
    } else if (pts.length >= 2) {
      objs.push(new g.Polyline({ map, path: pts, strokeColor: color, strokeWeight: draft.kind === 'route' ? 4 : 2, strokeOpacity: 0.9, clickable: false }));
    }
    return () => objs.forEach(o => o.setMap(null));
  }, [map, draft]);
  if (!draft) return null;
  const dots = draft.kind === 'circle' ? (draft.center ? [draft.center] : []) : (draft.points ?? []);
  return dots.map((p, i) => (
    <AdvancedMarker key={`d${i}`} position={p} zIndex={1000} clickable={false}>
      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff', border: `3px solid ${draft.color || '#f97316'}`, transform: 'translateY(6px)', pointerEvents: 'none' }} />
    </AdvancedMarker>
  ));
};

// Company map overlays (XYZ tile templates or WMS), as Google ImageMapTypes.
const OverlaysLayer = ({ overlays }) => {
  const map = useMap();
  const sig = JSON.stringify(overlays ?? []);
  useEffect(() => {
    const list = JSON.parse(sig);
    if (!map || !list.length || !window.google?.maps) return;
    const g = window.google.maps;
    const types = list.map(o => new g.ImageMapType({
      name: o.name, opacity: o.opacity ?? 0.7, tileSize: new g.Size(256, 256), maxZoom: 22,
      getTileUrl: (coord, zoom) => overlayTileUrl(o, coord.x, coord.y, zoom),
    }));
    types.forEach(tp => map.overlayMapTypes.push(tp));
    return () => {
      const arr = map.overlayMapTypes;
      for (let i = arr.getLength() - 1; i >= 0; i--) if (types.includes(arr.getAt(i))) arr.removeAt(i);
    };
  }, [map, sig]);
  return null;
};

const SWATCHES = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#38bdf8', '#a855f7', '#ffffff'];
function fmtDistance(m) { return m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${Math.round(m)} m`; }
function fmtArea(m2) { return m2 >= 1e6 ? `${(m2 / 1e6).toFixed(2)} km²` : `${(m2 / 1e4).toFixed(2)} ha`; }

// Popup editor for a drawn shape. Read-only for people without rights.
const ShapeEditor = ({ shape, categories, categoryLabel, meta, canEdit, editingGeometry, onSave, onDelete, onToggleGeometry }) => {
  const { t } = useI18n();
  const [form, setForm] = useState(() => ({
    label: shape.label ?? '', notes: shape.notes ?? '', category: shape.category ?? '',
    alert: shape.alert ?? 'none', color: shape.color ?? '#38bdf8', active: shape.active !== false,
  }));
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const options = useMemo(() => {
    const fits = categories.filter(c => (shape.kind === 'route' ? c.kind === 'route' : c.kind !== 'route'));
    return fits.some(c => c.id === form.category) || !form.category ? fits : [...fits, { id: form.category, kind: shape.kind }];
  }, [categories, shape.kind, form.category]);
  const geo = shape.geometry ?? {};
  const size = shape.kind === 'circle'
    ? t('map.ed.radius', { v: fmtDistance(Number(geo.radius) || 0) })
    : shape.kind === 'route'
      ? t('map.ed.length', { v: fmtDistance(pathLengthM(geo.path ?? [])) })
      : t('map.ed.area', { v: fmtArea(polygonAreaM2(geo.path ?? [])) });
  const field = 'w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-900';
  const pickCategory = (id) => {
    const c = categories.find(x => x.id === id);
    setForm(f => ({ ...f, category: id, ...(c ? { color: c.color, alert: shape.kind === 'route' ? 'none' : c.alert } : {}) }));
  };

  if (!canEdit) {
    return (
      <div style={{ minWidth: 200, maxWidth: 260 }}>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: shape.color }} />
          <span className="text-xs font-semibold text-slate-900">{shape.label || categoryLabel(shape.category)}</span>
        </div>
        <p className="text-[11px] text-slate-600">{categoryLabel(shape.category)} · {t(`map.kind.${shape.kind}`)} · {size}</p>
        {shape.kind !== 'route' && shape.alert !== 'none' && <p className="text-[11px] text-slate-600">{t(`map.alert.${shape.alert}`)}</p>}
        {shape.active === false && <p className="text-[11px] text-slate-500">{t('map.ed.inactive')}</p>}
        {shape.notes && <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">{shape.notes}</p>}
        {meta && <p className="text-[10px] text-slate-500 mt-1">{meta}</p>}
      </div>
    );
  }

  return (
    <div style={{ minWidth: 220, maxWidth: 270 }} className="space-y-1.5">
      <p className="text-[11px] font-semibold text-slate-900">{t(`map.kind.${shape.kind}`)} · <span className="font-normal text-slate-500">{size}</span></p>
      <input value={form.label} onChange={e => set('label', e.target.value)} placeholder={t('map.ed.labelPh')} maxLength={200} className={field} />
      <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={t('map.ed.notesPh')} rows={2} className={field} />
      <label className="block text-[10px] text-slate-500">{t('map.ed.category')}
        <select value={form.category} onChange={e => pickCategory(e.target.value)} className={field}>
          {!form.category && <option value="">—</option>}
          {options.map(c => <option key={c.id} value={c.id}>{categoryLabel(c.id)}</option>)}
        </select>
      </label>
      {shape.kind !== 'route' && (
        <label className="block text-[10px] text-slate-500">{t('map.ed.alert')}
          <select value={form.alert} onChange={e => set('alert', e.target.value)} className={field}>
            {['none', 'enter', 'exit', 'both'].map(a => <option key={a} value={a}>{t(`map.alert.${a}`)}</option>)}
          </select>
        </label>
      )}
      <div className="flex items-center gap-1">
        {SWATCHES.map(c => (
          <button key={c} type="button" onClick={() => set('color', c)} title={c}
            style={{ background: c, width: 18, height: 18, borderRadius: 4, border: form.color === c ? '2px solid #0f172a' : '1px solid #cbd5e1' }} />
        ))}
        <input type="color" value={form.color} onChange={e => set('color', e.target.value)} style={{ width: 24, height: 20, padding: 0, border: 0 }} title={t('map.ed.color')} />
      </div>
      <label className="flex items-center gap-1.5 text-xs text-slate-700">
        <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} />
        {t('map.ed.active')}
      </label>
      {meta && <p className="text-[10px] text-slate-500">{meta}</p>}
      <div className="flex flex-wrap gap-1.5 pt-1">
        <button onClick={() => onSave({
          label: form.label.trim(), notes: form.notes.trim() || null, category: form.category,
          alert: shape.kind === 'route' ? 'none' : form.alert, color: form.color, active: form.active,
        })} className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded">{t('veh.save')}</button>
        <button onClick={onToggleGeometry} className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs rounded">
          {editingGeometry ? t('map.ed.reshapeDone') : t('map.ed.reshape')}
        </button>
        {confirmDel
          ? <button onClick={onDelete} className="px-3 py-1 bg-red-600 text-white text-xs rounded font-bold">{t('map.ed.confirmDelete')}</button>
          : <button onClick={() => setConfirmDel(true)} className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded">{t('tac.remove')}</button>}
      </div>
    </div>
  );
};

// Inline editor shown in a tactical marker's popup: label + notes,
// saved for the whole team. Position changes by dragging the marker.
const MarkerEditor = ({ marker, onSave, onDelete }) => {
  const { t } = useI18n();
  const [label, setLabel] = useState(marker.rawLabel ?? '');
  const [notes, setNotes] = useState(marker.notes ?? '');
  return (
    <div style={{ minWidth: 200 }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span style={{ fontSize: 16 }}>{marker.icon}</span>
        <span className="text-xs font-semibold text-slate-900">{marker.kindLabel ?? marker.name}</span>
      </div>
      {onSave ? (
        <>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder={t('tac.labelPh')}
            className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 mb-1"
          />
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={t('tac.notesPh')}
            rows={2}
            className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-900"
          />
        </>
      ) : (
        <>
          {marker.rawLabel && <p className="text-xs text-slate-700">{marker.rawLabel}</p>}
          {marker.notes && <p className="text-xs text-slate-600">{marker.notes}</p>}
        </>
      )}
      {marker.meta && <p className="text-[10px] text-slate-500 mt-1">{marker.meta}</p>}
      <p className="text-[10px] text-slate-400 mt-0.5">{t('tac.dragToMoveHint')}</p>
      <div className="flex gap-1.5 mt-2">
        {onSave && (
          <button
            onClick={() => onSave({ label: label.trim(), notes: notes.trim() || null })}
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
          >
            {t('veh.save')}
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-colors">
            {t('tac.remove')}
          </button>
        )}
      </div>
    </div>
  );
};

const TacticalMap = ({
  mapMode = 'satellite',
  showDevices = true,
  showGeofences = true,
  showAlerts = true,
  showFlightPaths = true,
  showMarkers = true,
  showWeather = false,   // live precipitation radar overlay (RainViewer)
  center = { lat: 43.2141, lng: 2.3522 },
  zoom = 14,
  onMapInteraction,
  devices = [],
  alerts = [],
  markers = [],
  onMapClick,        // (pos {lat,lng}) => void — placement mode
  onMarkerDelete,    // (id) => void — shows Remove in the marker popup
  onMarkerMove,      // (id, pos) => void — makes markers draggable
  onMarkerEdit,      // (id, {label, notes}) => void — editable popup
  onCameraChanged,   // (center {lat,lng}) => void — track current view
  coverage = null,   // [{lat, lng, quality}] — comms coverage samples
  // drawn shapes (map_shapes rows) and their editing
  shapes = [],
  shapeCategories = [],          // offered categories [{id, kind, color, alert}] (built-in + custom)
  categoryLabel = (id) => id,    // (categoryId) => display text
  describeShape,                 // (shape) => "who · when" line
  canEditShape = () => false,    // (shape) => boolean
  onShapeSave,                   // (id, patch) => void
  onShapeDelete,                 // (id) => void
  editingShapeId = null,         // id of the shape whose geometry is editable
  onShapeEditToggle,             // (id | null) => void
  onShapeGeometry,               // (id, geometry) => void — debounced while editing
  openShape = null,              // { id, n } — open this shape's popup (e.g. right after drawing it)
  draft = null,                  // shape being drawn: { kind, color, points, center, radius }
  overlays = [],                 // company overlays to show [{id, type, url, layers, opacity}]
}) => {
  const { t } = useI18n();
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [selectedShape, setSelectedShape] = useState(null); // { id, position }
  const [activeFeed, setActiveFeed] = useState(null);
  const shapeById = useMemo(() => Object.fromEntries((shapes ?? []).map(s => [s.id, s])), [shapes]);
  const openedRef = useRef(null);
  useEffect(() => {
    if (!openShape?.id || openedRef.current === openShape.n) return;
    const s = shapeById[openShape.id];
    if (!s) return; // not loaded yet — try again when shapes arrive
    openedRef.current = openShape.n;
    setSelectedMarker(null);
    setSelectedShape({ id: s.id, position: shapeAnchor(s) });
  }, [openShape, shapeById]);
  const shownShape = selectedShape ? shapeById[selectedShape.id] : null;
  const drawing = Boolean(draft);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const mapTypeId = {
    'satellite': 'satellite',
    'roadmap': 'roadmap',
    'terrain': 'terrain',
    'hybrid': 'hybrid'
  }[mapMode] || 'satellite';

  // Render exactly what we're given — no fake fallback devices.
  const activeDevices = devices;

  const getMarkerColor = (type) => {
    switch(type) {
      case 'drone': return '#a855f7';
      case 'camera': return '#3b82f6';
      case 'sensor': return '#f97316';
      case 'alert': return '#ef4444';
      default: return '#6b7280';
    }
  };

  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    return (
      <div className="w-full h-full bg-slate-900 flex items-center justify-center">
        <div className="text-center p-8 bg-slate-800 rounded-lg border border-slate-700 max-w-lg">
          <div className="text-yellow-500 text-5xl mb-4">⚠️</div>
          <h3 className="text-white text-xl font-semibold mb-3">{t('tac.apiKey.title')}</h3>
          <p className="text-slate-300 mb-4">
            {t('tac.apiKey.intro')}
          </p>
          <div className="bg-slate-950 p-3 rounded border border-slate-700 text-left text-sm font-mono text-green-400 mb-4">
            VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
          </div>
          <div className="text-slate-400 text-sm space-y-2">
            <p>{t('tac.apiKey.step1')} <a href="https://console.cloud.google.com/google/maps-apis" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google Cloud Console</a></p>
            <p>{t('tac.apiKey.step2')}</p>
            <p>{t('tac.apiKey.step3')}</p>
            <p>{t('tac.apiKey.step4')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        mapId="watchtower-tactical-map"
        defaultCenter={center}
        defaultZoom={zoom}
        mapTypeId={mapTypeId}
        gestureHandling="greedy"
        clickableIcons={!onMapClick}
        disableDefaultUI={false}
        style={{ width: '100%', height: '100%', cursor: onMapClick ? 'crosshair' : undefined }}
        onClick={(e) => {
          if (onMapClick && e.detail?.latLng) {
            onMapClick({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng });
          } else {
            setSelectedMarker(null);
            setSelectedShape(null);
          }
        }}
        onCameraChanged={(e) => onCameraChanged?.({ center: e.detail?.center, zoom: e.detail?.zoom })}
      >
        <OverlaysLayer overlays={overlays} />
        <RadarOverlay visible={showWeather} />
        {coverage && <CoverageOverlay samples={coverage} />}
        {showGeofences && (
          <ShapesLayer
            shapes={shapes}
            interactive={!drawing}
            editingId={editingShapeId}
            onSelect={(id, pos) => { setSelectedMarker(null); setSelectedShape({ id, position: pos }); }}
            onGeometryChange={onShapeGeometry}
          />
        )}
        {/* shape names on the map; also an easy tap target for thin routes */}
        {showGeofences && !drawing && (shapes ?? []).filter(s => s.label).map(s => {
          const pos = shapeAnchor(s);
          return pos ? (
            <AdvancedMarker key={`lbl-${s.id}`} position={pos} zIndex={1} onClick={() => { setSelectedMarker(null); setSelectedShape({ id: s.id, position: pos }); }}>
              <div style={{
                padding: '1px 6px', borderRadius: 6, background: '#0f172acc', border: `1px solid ${s.color || '#38bdf8'}`,
                color: '#fff', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', opacity: s.active === false ? 0.55 : 1,
                transform: s.kind === 'route' ? undefined : 'translateY(50%)', cursor: 'pointer',
              }}>{s.label}</div>
            </AdvancedMarker>
          ) : null;
        })}
        <DraftLayer draft={draft} />
        {showDevices && activeDevices.map((device) => (
          <AdvancedMarker
            key={device.id}
            position={device.position}
            onClick={() => {
              if (device.type === 'drone' || device.type === 'camera') {
                setActiveFeed(device);
              } else {
                setSelectedShape(null);
                setSelectedMarker(device);
              }
            }}
          >
            <div
              className="relative cursor-pointer group"
              style={{
                width: device.type === 'drone' ? '40px' : '32px',
                height: device.type === 'drone' ? '40px' : '32px',
                backgroundColor: `${device.color ?? getMarkerColor(device.type)}30`,
                borderRadius: '50%',
                border: `2px solid ${device.color ?? getMarkerColor(device.type)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: device.type === 'drone' ? 'pulse 2s ease-in-out infinite' : 'none'
              }}
              title={t('tac.clickToViewFeed', { name: device.name })}
            >
              <span style={{ fontSize: device.type === 'drone' ? '20px' : '16px' }}>
                {device.icon}
              </span>
            </div>
          </AdvancedMarker>
        ))}

        {/* Tactical markers / points of interest — draggable to reposition */}
        {showMarkers && markers.map((m) => (
          <AdvancedMarker
            key={m.id}
            position={m.position}
            draggable={Boolean(onMarkerMove)}
            onDragEnd={(e) => {
              const ll = e.latLng;
              if (ll && onMarkerMove) onMarkerMove(m.id, { lat: ll.lat(), lng: ll.lng() });
            }}
            onClick={() => { setSelectedShape(null); setSelectedMarker({ ...m, isTacticalMarker: true }); }}
          >
            <div
              className="cursor-pointer"
              style={{
                width: '34px', height: '34px',
                backgroundColor: '#0f172acc',
                borderRadius: '50%',
                border: '2px solid #f97316',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title={t('tac.dragToMove', { name: m.name })}
            >
              <span style={{ fontSize: '17px' }}>{m.icon}</span>
            </div>
          </AdvancedMarker>
        ))}

        {showAlerts && alerts.map((alert) => (
          <AdvancedMarker
            key={alert.id}
            position={alert.position}
            onClick={() => setSelectedMarker(alert)}
          >
            <div
              className="relative cursor-pointer"
              style={{
                width: '36px',
                height: '36px',
                backgroundColor: '#ef444430',
                borderRadius: '50%',
                border: '2px solid #ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'pulse 1s ease-in-out infinite'
              }}
            >
              <Flame className="w-5 h-5 text-red-500" />
            </div>
          </AdvancedMarker>
        ))}

        {selectedMarker && (
          <InfoWindow
            position={selectedMarker.position}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div className="p-2">
              {selectedMarker.isTacticalMarker ? (
                <MarkerEditor
                  marker={selectedMarker}
                  onSave={onMarkerEdit ? (patch) => { onMarkerEdit(selectedMarker.id, patch); setSelectedMarker(null); } : null}
                  onDelete={onMarkerDelete ? () => { onMarkerDelete(selectedMarker.id); setSelectedMarker(null); } : null}
                />
              ) : (
                <>
                  <h3 className="font-semibold text-sm text-slate-900">{selectedMarker.name}</h3>
                  <p className="text-xs text-slate-600 mt-1">{t('tac.typeLine', { v: tOr(t, `tac.type.${selectedMarker.type}`, selectedMarker.type) })}</p>
                  {selectedMarker.status && (
                    <p className="text-xs text-slate-600">{t('tac.statusLine', { v: tOr(t, `tac.status.${selectedMarker.status}`, selectedMarker.status) })}</p>
                  )}
                </>
              )}
              {(selectedMarker.type === 'drone' || selectedMarker.type === 'camera') && (
                <button
                  onClick={() => setActiveFeed(selectedMarker)}
                  className="mt-2 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded flex items-center gap-1.5 transition-colors"
                >
                  <Video className="w-3 h-3" />
                  {t('tac.viewFeed')}
                </button>
              )}
            </div>
          </InfoWindow>
        )}

        {shownShape && !drawing && (selectedShape.position || shapeAnchor(shownShape)) && (
          <InfoWindow
            key={shownShape.id}
            position={selectedShape.position || shapeAnchor(shownShape)}
            onCloseClick={() => setSelectedShape(null)}
          >
            <div className="p-1">
              <ShapeEditor
                key={shownShape.id}
                shape={shownShape}
                categories={shapeCategories}
                categoryLabel={categoryLabel}
                meta={describeShape?.(shownShape)}
                canEdit={Boolean(onShapeSave) && canEditShape(shownShape)}
                editingGeometry={editingShapeId === shownShape.id}
                onSave={(patch) => { onShapeSave?.(shownShape.id, patch); setSelectedShape(null); }}
                onDelete={() => { onShapeDelete?.(shownShape.id); setSelectedShape(null); }}
                onToggleGeometry={() => {
                  onShapeEditToggle?.(editingShapeId === shownShape.id ? null : shownShape.id);
                  setSelectedShape(null);
                }}
              />
            </div>
          </InfoWindow>
        )}
      </Map>

      {activeFeed && (
        <DeviceFeedViewer
          device={activeFeed}
          onClose={() => setActiveFeed(null)}
        />
      )}
    </APIProvider>
  );
};

export default TacticalMap;

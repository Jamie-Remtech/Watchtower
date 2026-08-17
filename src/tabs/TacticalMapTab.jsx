import { useState, useEffect, useRef } from 'react';
import { Map, Crosshair, Plus, Star, RefreshCw, X, Check, ExternalLink } from 'lucide-react';
import TacticalMap from '../components/TacticalMap';
import { useDevices } from '../hooks/useDevices';
import { usePositions } from '../hooks/usePositions';
import { useTeam } from '../hooks/useTeam';
import { useMarkers, MARKER_KINDS, markerMeta } from '../hooks/useMarkers';
import { useMapViews } from '../hooks/useMapViews';
import { usePatients } from '../hooks/usePatients';
import { TRIAGE_META } from '../lib/fieldCommands';

// ============================================
// TACTICAL MAP — the shared operational picture.
// Real devices, live crew positions, and shared markers only.
// ============================================

const KIND_ICON = { drone: '🚁', ptz_camera: '📹', camera: '📷', sensor: '📡', edge_box: '🖥️' };
const KIND_TYPE = { drone: 'drone', ptz_camera: 'camera', camera: 'camera', sensor: 'sensor', edge_box: 'sensor' };
const FRESH_MS = 10 * 60 * 1000; // crew fixes older than 10 min are stale

export const TacticalMapTab = () => {
  const { devices } = useDevices();
  const { latest: teamPositions } = usePositions();
  const { liveMembers } = useTeam();
  const { markers: liveMarkers, createMarker, updateMarker, removeMarker } = useMarkers();
  const { patients, counts: triageCounts } = usePatients();
  const [myPos, setMyPos] = useState(null);
  const [zeroKey, setZeroKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [mapMode, setMapMode] = useState('satellite');
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

  const teamMarkers = teamPositions
    .filter(p => Date.now() - new Date(p.at) < FRESH_MS)
    .map(p => ({
      id: `pos-${p.profile_id}`,
      name: `${nameOf[p.profile_id] ?? 'Team member'} (${new Date(p.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
      type: 'person',
      status: 'live',
      position: { lat: p.lat, lng: p.lng },
      icon: '🧍',
    }));

  const tacticalMarkers = liveMarkers.map(m => {
    const meta = markerMeta(m.kind);
    return {
      id: m.id,
      name: m.label || meta.label,
      rawLabel: m.label,
      kindLabel: meta.label,
      icon: meta.icon,
      position: { lat: m.lat, lng: m.lng },
      notes: m.notes,
      meta: `${nameOf[m.created_by] ?? 'Team'} · ${new Date(m.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`,
    };
  });

  // Casualties on the board, colored by SALT triage category
  const patientMarkers = patients
    .filter(p => p.status === 'active' && p.lat != null && p.lng != null)
    .map(p => ({
      id: `pat-${p.id}`,
      name: `${p.tag ? `Tag ${p.tag}` : `P${p.num}`} · ${TRIAGE_META[p.triage]?.label ?? p.triage}`,
      type: 'person',
      status: p.triage,
      position: { lat: p.lat, lng: p.lng },
      icon: '🧑',
      color: TRIAGE_META[p.triage]?.dot,
    }));

  const mapDevices = [
    ...placed.map(d => ({
      id: d.id,
      name: d.name,
      type: KIND_TYPE[d.kind] ?? 'sensor',
      status: d.status,
      position: { lat: d.lat, lng: d.lng },
      icon: KIND_ICON[d.kind] ?? '📍',
    })),
    ...teamMarkers,
    ...patientMarkers,
    ...(myPos ? [{ id: 'me', name: 'My position', type: 'person', status: 'here', position: myPos, icon: '📍' }] : []),
  ];

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
        ? 'The map_views table is missing — run migration 0008 in the Supabase SQL Editor.'
        : (err.message ?? 'Could not save the view'));
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
          ? 'The markers table is missing — run migration 0006/0007 in the Supabase SQL Editor.'
          : (err.message ?? 'Could not create the marker')
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
          <h2 className="text-sm font-bold text-white">Tactical Map</h2>
          <span className="text-xs text-slate-500">
            {placed.length} device{placed.length === 1 ? '' : 's'} · {teamMarkers.length} live crew
          </span>
          {/* Triage board: live casualty counts by SALT category */}
          {Object.keys(triageCounts).length > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/70 border border-slate-700 rounded-lg">
              {['red', 'yellow', 'green', 'gray', 'black', 'unknown'].map(c =>
                triageCounts[c] ? (
                  <span key={c} className="flex items-center gap-1 text-[10px] font-bold text-white" title={TRIAGE_META[c].label}>
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: TRIAGE_META[c].dot }} />
                    {triageCounts[c]}
                  </span>
                ) : null
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMarkerPanelOpen(o => !o)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
              markerPanelOpen ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Marker
          </button>
          <button
            onClick={zeroIn}
            disabled={locating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/15 border border-sky-500/30 text-sky-300 rounded-lg text-xs font-medium hover:bg-sky-500/25 disabled:opacity-50"
          >
            <Crosshair className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
            My area
          </button>
          {!isPopped && (
            <button
              onClick={() => window.open(`${window.location.origin}/?pop=tactical`, '_blank', 'width=1280,height=850,popup=yes')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-700"
              title="Open the tactical map in its own window (stays live-synced)"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Pop out
            </button>
          )}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            {['satellite', 'roadmap', 'terrain', 'hybrid'].map(m => (
              <button
                key={m}
                onClick={() => setMapMode(m)}
                className={`px-2 py-1 rounded text-xs capitalize ${mapMode === m ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {m}
              </button>
            ))}
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
                title="Click to jump · double-click to rename"
                className="font-medium"
              >
                {v.name}
              </button>
            )}
            {activeViewId === v.id && (
              <button
                onClick={() => refreezeView(v.id)}
                className="p-0.5 text-slate-400 hover:text-orange-300"
                title="Re-freeze this view to what's on screen now"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
            {confirmDeleteId === v.id ? (
              <button
                onClick={() => { removeView(v.id).catch(e => setViewsError(e.message)); setConfirmDeleteId(null); if (activeViewId === v.id) setActiveViewId(null); }}
                className="px-1 py-0.5 text-[10px] font-bold text-red-400"
                title="Confirm delete"
              >
                sure?
              </button>
            ) : (
              <button
                onClick={() => { setConfirmDeleteId(v.id); setTimeout(() => setConfirmDeleteId(c => (c === v.id ? null : c)), 2500); }}
                className="p-0.5 text-slate-500 hover:text-red-400"
                title="Delete view"
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
            <button onClick={saveCurrentView} className="p-0.5 text-green-400 hover:text-green-300" title="Save">
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSavingView(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-slate-600 text-xs text-slate-400 hover:border-orange-500/40 hover:text-orange-300"
            title="Freeze the current view as a named quick reference"
          >
            <Star className="w-3 h-3" />
            Save view
          </button>
        )}
        {viewsError && <span className="text-[10px] text-red-400">{viewsError}</span>}
      </div>

      {/* Marker creation: tap a type -> it drops at the center of your view */}
      {markerPanelOpen && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex-shrink-0 space-y-1.5">
          <div className="grid grid-cols-3 sm:grid-cols-9 gap-1">
            {MARKER_KINDS.map(k => (
              <button
                key={k.id}
                onPointerDown={(e) => !markerBusy && startDrag(e, k.id)}
                disabled={markerBusy}
                style={{ touchAction: 'none' }}
                className="flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg border text-[9px] bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-orange-500/15 hover:border-orange-500/40 hover:text-orange-300 disabled:opacity-50 cursor-grab active:cursor-grabbing select-none"
              >
                <span className="text-base leading-none pointer-events-none">{k.icon}</span>
                <span className="pointer-events-none">{k.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500">
            <b className="text-slate-400">Drag</b> a type onto the map to place it exactly — or tap it to drop at the center. Then drag the marker to adjust, tap it for label &amp; notes. Everyone sees changes live.
          </p>
          {markerError && <p className="text-[10px] text-red-400">{markerError}</p>}
        </div>
      )}

      <div
        ref={mapWrapRef}
        className={`flex-1 min-h-[400px] rounded-xl overflow-hidden border relative ${drag.kind ? 'border-orange-500 ring-2 ring-orange-500/40' : 'border-slate-800'}`}
      >
        <TacticalMap
          key={zeroKey}
          mapMode={mapMode}
          devices={mapDevices}
          center={center}
          zoom={zoom}
          geofences={[]}
          alerts={[]}
          markers={tacticalMarkers}
          onMarkerMove={(id, pos) => updateMarker(id, pos).catch(() => {})}
          onMarkerEdit={(id, patch) => updateMarker(id, patch).catch(() => {})}
          onMarkerDelete={(id) => removeMarker(id).catch(() => {})}
          onCameraChanged={(cam) => { if (cam?.center) cameraRef.current = cam; }}
        />
        {placed.length === 0 && teamMarkers.length === 0 && tacticalMarkers.length === 0 && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900/85 border border-slate-700 rounded-lg px-3 py-1.5 pointer-events-none">
            <p className="text-[10px] text-slate-300">
              Nothing on the map yet — drop a marker, register devices, or share your position from the Field Log
            </p>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-600 flex items-center gap-1.5 flex-shrink-0">
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
        Connected to Supabase · devices, live crew positions, and shared markers
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

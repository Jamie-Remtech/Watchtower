import { useState, useEffect, useRef } from 'react';
import { Map, Crosshair, Plus } from 'lucide-react';
import TacticalMap from '../components/TacticalMap';
import { useDevices } from '../hooks/useDevices';
import { usePositions } from '../hooks/usePositions';
import { useTeam } from '../hooks/useTeam';
import { useMarkers, MARKER_KINDS, markerMeta } from '../hooks/useMarkers';

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
  const [myPos, setMyPos] = useState(null);
  const [zeroKey, setZeroKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [mapMode, setMapMode] = useState('satellite');
  const [markerPanelOpen, setMarkerPanelOpen] = useState(false);
  const [markerBusy, setMarkerBusy] = useState(false);
  const [markerError, setMarkerError] = useState(null);
  const cameraCenterRef = useRef(null);

  // Open the map on the user's own area right away — rescuers need
  // their surroundings even before anything is registered.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setMyPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setZeroKey(k => k + 1);
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
    ...(myPos ? [{ id: 'me', name: 'My position', type: 'person', status: 'here', position: myPos, icon: '📍' }] : []),
  ];

  const anchors = [...placed.map(d => ({ lat: d.lat, lng: d.lng })), ...teamMarkers.map(t => t.position)];
  const center = myPos ?? (anchors.length
    ? {
        lat: anchors.reduce((a, p) => a + p.lat, 0) / anchors.length,
        lng: anchors.reduce((a, p) => a + p.lng, 0) / anchors.length,
      }
    : { lat: 20, lng: 0 });
  const zoom = myPos ? 14 : anchors.length ? 11 : 2;

  // Tap a type -> drop instantly at the middle of the current view,
  // then drag into place and tap to fill in details.
  const quickDrop = async (kindId) => {
    const c = cameraCenterRef.current ?? myPos ?? center;
    setMarkerBusy(true);
    setMarkerError(null);
    try {
      await createMarker({ kind: kindId, label: '', lat: c.lat, lng: c.lng });
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

  const zeroIn = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
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

      {/* Marker creation: tap a type -> it drops at the center of your view */}
      {markerPanelOpen && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex-shrink-0 space-y-1.5">
          <div className="grid grid-cols-3 sm:grid-cols-9 gap-1">
            {MARKER_KINDS.map(k => (
              <button
                key={k.id}
                onClick={() => quickDrop(k.id)}
                disabled={markerBusy}
                className="flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg border text-[9px] bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-orange-500/15 hover:border-orange-500/40 hover:text-orange-300 disabled:opacity-50"
              >
                <span className="text-base leading-none">{k.icon}</span>
                {k.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500">
            Tap a type — it drops at the center of your view. <b className="text-slate-400">Drag</b> it into position, <b className="text-slate-400">tap</b> it to add label &amp; notes. Everyone sees changes live.
          </p>
          {markerError && <p className="text-[10px] text-red-400">{markerError}</p>}
        </div>
      )}

      <div className="flex-1 min-h-[400px] rounded-xl overflow-hidden border border-slate-800 relative">
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
          onCameraChanged={(c) => { if (c) cameraCenterRef.current = c; }}
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
    </div>
  );
};

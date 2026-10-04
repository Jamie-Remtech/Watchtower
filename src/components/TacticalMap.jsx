import React, { useState, useCallback, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import { Flame, Camera, Radio, Wind, Video } from 'lucide-react';
import DeviceFeedViewer from './DeviceFeedViewer';
import { useI18n } from '../i18n/index.jsx';

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
  geofences = [],
  alerts = [],
  markers = [],
  onMapClick,        // (pos {lat,lng}) => void — placement mode
  onMarkerDelete,    // (id) => void — shows Remove in the marker popup
  onMarkerMove,      // (id, pos) => void — makes markers draggable
  onMarkerEdit,      // (id, {label, notes}) => void — editable popup
  onCameraChanged,   // (center {lat,lng}) => void — track current view
  coverage = null,   // [{lat, lng, quality}] — comms coverage samples
}) => {
  const { t } = useI18n();
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [activeFeed, setActiveFeed] = useState(null);
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
        disableDefaultUI={false}
        style={{ width: '100%', height: '100%', cursor: onMapClick ? 'crosshair' : undefined }}
        onClick={(e) => {
          if (onMapClick && e.detail?.latLng) {
            onMapClick({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng });
          } else {
            setSelectedMarker(null);
          }
        }}
        onCameraChanged={(e) => onCameraChanged?.({ center: e.detail?.center, zoom: e.detail?.zoom })}
      >
        <RadarOverlay visible={showWeather} />
        {coverage && <CoverageOverlay samples={coverage} />}
        {showDevices && activeDevices.map((device) => (
          <AdvancedMarker
            key={device.id}
            position={device.position}
            onClick={() => {
              if (device.type === 'drone' || device.type === 'camera') {
                setActiveFeed(device);
              } else {
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

        {showGeofences && geofences.map((geofence) => (
          <React.Fragment key={geofence.id}>
          </React.Fragment>
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
            onClick={() => setSelectedMarker({ ...m, isTacticalMarker: true })}
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

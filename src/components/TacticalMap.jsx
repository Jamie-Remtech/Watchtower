import React, { useState, useCallback } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps';
import { Flame, Camera, Radio, Wind, Video } from 'lucide-react';
import DeviceFeedViewer from './DeviceFeedViewer';

// Inline editor shown in a tactical marker's popup: label + notes,
// saved for the whole team. Position changes by dragging the marker.
const MarkerEditor = ({ marker, onSave, onDelete }) => {
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
            placeholder="Label — e.g. Hydrant behind school"
            className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 mb-1"
          />
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
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
      <p className="text-[10px] text-slate-400 mt-0.5">Drag the marker on the map to move it</p>
      <div className="flex gap-1.5 mt-2">
        {onSave && (
          <button
            onClick={() => onSave({ label: label.trim(), notes: notes.trim() || null })}
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
          >
            Save
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-colors">
            Remove
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
}) => {
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
          <h3 className="text-white text-xl font-semibold mb-3">Google Maps API Key Required</h3>
          <p className="text-slate-300 mb-4">
            To use the tactical map with Google Maps, you need to add your API key to the .env file:
          </p>
          <div className="bg-slate-950 p-3 rounded border border-slate-700 text-left text-sm font-mono text-green-400 mb-4">
            VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
          </div>
          <div className="text-slate-400 text-sm space-y-2">
            <p>1. Get your API key from <a href="https://console.cloud.google.com/google/maps-apis" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google Cloud Console</a></p>
            <p>2. Enable Maps JavaScript API</p>
            <p>3. Add the key to your .env file</p>
            <p>4. Restart the dev server</p>
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
        onCameraChanged={(e) => onCameraChanged?.(e.detail?.center)}
      >
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
                backgroundColor: `${getMarkerColor(device.type)}30`,
                borderRadius: '50%',
                border: `2px solid ${getMarkerColor(device.type)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: device.type === 'drone' ? 'pulse 2s ease-in-out infinite' : 'none'
              }}
              title={`${device.name} - Click to view feed`}
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
              title={`${m.name} — drag to move`}
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
                  <p className="text-xs text-slate-600 mt-1">Type: {selectedMarker.type}</p>
                  {selectedMarker.status && (
                    <p className="text-xs text-slate-600">Status: {selectedMarker.status}</p>
                  )}
                </>
              )}
              {(selectedMarker.type === 'drone' || selectedMarker.type === 'camera') && (
                <button
                  onClick={() => setActiveFeed(selectedMarker)}
                  className="mt-2 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded flex items-center gap-1.5 transition-colors"
                >
                  <Video className="w-3 h-3" />
                  View Feed
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

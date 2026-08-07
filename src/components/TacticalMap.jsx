import React, { useState, useCallback } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps';
import { Flame, Camera, Radio, Wind, Video } from 'lucide-react';
import DeviceFeedViewer from './DeviceFeedViewer';

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
  markers = []
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
        style={{ width: '100%', height: '100%' }}
        onClick={() => setSelectedMarker(null)}
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
              <h3 className="font-semibold text-sm text-slate-900">{selectedMarker.name}</h3>
              <p className="text-xs text-slate-600 mt-1">Type: {selectedMarker.type}</p>
              {selectedMarker.status && (
                <p className="text-xs text-slate-600">Status: {selectedMarker.status}</p>
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

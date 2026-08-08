import { useState, useEffect, useRef, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Globe, Layers, CloudRain, Flame, Wind, Droplets, Thermometer,
  Activity, AlertTriangle, RefreshCw, ChevronDown, ChevronRight, Info,
  LocateFixed, Loader2
} from 'lucide-react';

// ============================================
// WORLD TAB — the World Engine's first surface
// A 3D globe with toggleable live layers from
// verifiable sources (NASA, USGS, RainViewer,
// Open-Meteo) and a Cascade Watch panel that
// flags how one disaster can trigger another.
// ============================================

// GIBS daily products lag ~1 day; use yesterday (UTC) for reliable tiles.
const gibsDate = () => {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
};

const GIBS = (layer, level, ext, time) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${time}/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.${ext}`;

// Toggleable overlay layers. Every entry names its source — verifiability is the point.
const OVERLAYS = [
  {
    id: 'radar', name: 'Precipitation radar', icon: CloudRain, defaultOn: true,
    source: 'RainViewer (global radar composite, ~10 min refresh)',
    desc: 'Live rain & snow radar',
  },
  {
    id: 'events', name: 'Natural events', icon: Flame, defaultOn: true,
    source: 'NASA EONET (curated; every event links to its source)',
    desc: 'Live wildfires, volcanoes, severe storms',
  },
  {
    id: 'aerosol', name: 'Aerosol / dust', icon: Wind, defaultOn: false,
    source: 'NASA MODIS Terra Aerosol Optical Depth, daily',
    desc: 'Sandstorms, smoke plumes, haze',
    gibs: { layer: 'MODIS_Terra_Aerosol', level: 6, ext: 'png' },
  },
  {
    id: 'chlorophyll', name: 'Ocean chlorophyll', icon: Droplets, defaultOn: false,
    source: 'NASA MODIS Aqua Chlorophyll-a, daily',
    desc: 'Algae blooms & ocean productivity',
    gibs: { layer: 'MODIS_Aqua_L2_Chlorophyll_A', level: 7, ext: 'png' },
  },
  {
    id: 'lst', name: 'Surface temperature', icon: Thermometer, defaultOn: false,
    source: 'NASA MODIS Terra Land Surface Temp (day), daily',
    desc: 'Heat map of the land surface',
    gibs: { layer: 'MODIS_Terra_Land_Surface_Temp_Day', level: 7, ext: 'png' },
  },
  {
    id: 'quakes', name: 'Earthquakes (24h)', icon: Activity, defaultOn: true,
    source: 'USGS real-time feed (M2.5+, past day)',
    desc: 'Live seismic events, sized by magnitude',
  },
];

// Known cascade chains — one disaster's after-effects seed the next.
// These guide what to watch; the events log will let us learn more over time.
const CASCADE_CHAINS = [
  { trigger: 'Undersea earthquake', effect: 'Tsunami', watch: 'Quakes M6.5+, shallow depth, offshore — USGS flags official tsunami signals' },
  { trigger: 'Desert sandstorm', effect: 'Ocean algae bloom', watch: 'Toggle Aerosol + Chlorophyll: dust fertilizes water; currents carry the bloom' },
  { trigger: 'Wildfire', effect: 'Smoke → air quality & visibility crisis downwind', watch: 'Fires layer + Aerosol layer downwind' },
  { trigger: 'Heavy rainfall on burn scar', effect: 'Flash floods & landslides', watch: 'Radar over recently burned terrain' },
  { trigger: 'Marine heatwave', effect: 'Mass bloom / fishery collapse', watch: 'Surface temperature + Chlorophyll anomalies' },
];

const WEATHER_EMOJI = (code) => {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  return '⛈️';
};

const MY_LOCATION_KEY = 'watchtower-my-location';

const WEATHER_CODES = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Heavy freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Heavy showers', 82: 'Violent showers',
  85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm + hail', 99: 'Severe thunderstorm + hail',
};

export const WorldTab = () => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(
    Object.fromEntries(OVERLAYS.map(o => [o.id, o.defaultOn]))
  );
  const [quakeFlags, setQuakeFlags] = useState([]);
  const [quakeCount, setQuakeCount] = useState(0);
  const [chainsOpen, setChainsOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [myWx, setMyWx] = useState(null);       // { pos, place, current, daily, at }
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(null);
  const myMarkerRef = useRef(null);

  // ---------- my-location weather ----------
  const showMyMarker = useCallback((pos) => {
    const map = mapRef.current;
    if (!map) return;
    if (!myMarkerRef.current) {
      const el = document.createElement('div');
      el.style.cssText =
        'width:16px;height:16px;border-radius:50%;background:#38bdf8;border:3px solid #fff;box-shadow:0 0 12px rgba(56,189,248,.9)';
      myMarkerRef.current = new maplibregl.Marker({ element: el });
    }
    myMarkerRef.current.setLngLat([pos.lng, pos.lat]).addTo(map);
  }, []);

  const loadMyWeather = useCallback(async (pos, { fly = false } = {}) => {
    showMyMarker(pos);
    if (fly) mapRef.current?.flyTo({ center: [pos.lng, pos.lat], zoom: 9 });
    // Weather: current + 7-day daily forecast, in the location's own timezone
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${pos.lat.toFixed(4)}&longitude=${pos.lng.toFixed(4)}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max` +
      `&forecast_days=7&timezone=auto`
    );
    const data = await r.json();
    // Best-effort place name (no key, graceful fallback to coordinates)
    let place = `${pos.lat.toFixed(3)}, ${pos.lng.toFixed(3)}`;
    try {
      const g = await (await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.lat}&longitude=${pos.lng}&localityLanguage=en`
      )).json();
      const town = g.city || g.locality;
      const region = g.principalSubdivision || g.countryName;
      if (town || region) place = [town, region].filter(Boolean).join(', ');
    } catch { /* keep coordinates */ }
    setMyWx({ pos, place, current: data.current, daily: data.daily, at: new Date() });
    localStorage.setItem(MY_LOCATION_KEY, JSON.stringify(pos));
  }, [showMyMarker]);

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) { setLocError('Geolocation is not supported here'); return; }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          await loadMyWeather({ lat: p.coords.latitude, lng: p.coords.longitude }, { fly: true });
        } catch { setLocError('Weather source unreachable — try again'); }
        setLocating(false);
      },
      (err) => {
        setLocError(
          err.code === 1 ? 'Location permission denied — allow it in your browser' :
          err.code === 2 ? 'Position unavailable' : 'Location request timed out'
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [loadMyWeather]);

  // ---------- live data fetchers ----------
  const loadQuakes = useCallback(async (map) => {
    try {
      const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
      const geojson = await res.json();
      const src = map.getSource('quakes');
      if (src) src.setData(geojson);
      setQuakeCount(geojson.features.length);

      // Cascade Watch: flag quakes that can seed a second disaster
      const flags = geojson.features
        .filter(f => f.properties.tsunami === 1 || f.properties.mag >= 6)
        .sort((a, b) => b.properties.mag - a.properties.mag)
        .slice(0, 6)
        .map(f => ({
          id: f.id,
          mag: f.properties.mag,
          place: f.properties.place,
          time: f.properties.time,
          tsunami: f.properties.tsunami === 1,
          depth: f.geometry.coordinates[2],
          coords: [f.geometry.coordinates[0], f.geometry.coordinates[1]],
          url: f.properties.url,
        }));
      setQuakeFlags(flags);
      setLastRefresh(new Date());
    } catch { /* feed unreachable — keep last data */ }
  }, []);

  const EVENT_COLORS = { wildfires: '#f97316', volcanoes: '#ef4444', severeStorms: '#38bdf8', seaLakeIce: '#a5f3fc', floods: '#3b82f6' };

  const loadEvents = useCallback(async (map) => {
    try {
      const res = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=1000');
      const data = await res.json();
      const features = data.events.map((e) => {
        const g = e.geometry?.at(-1);
        if (!g) return null;
        const coords = g.type === 'Point' ? g.coordinates : g.coordinates?.[0]?.[0];
        if (!Array.isArray(coords)) return null;
        const cat = e.categories?.[0]?.id ?? 'other';
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: coords.slice(0, 2) },
          properties: {
            title: e.title, cat,
            color: EVENT_COLORS[cat] ?? '#facc15',
            date: g.date, link: e.sources?.[0]?.url ?? e.link,
          },
        };
      }).filter(Boolean);
      const src = map.getSource('eonet');
      if (src) src.setData({ type: 'FeatureCollection', features });
    } catch { /* keep last data */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRadar = useCallback(async (map) => {
    try {
      const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      const data = await res.json();
      const frame = data?.radar?.past?.at(-1);
      if (!frame) return;
      const tiles = [`${data.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`];
      if (map.getLayer('radar')) map.removeLayer('radar');
      if (map.getSource('radar')) map.removeSource('radar');
      // RainViewer's composite only exists to z7 — deeper requests return
      // literal "Zoom Level Not Supported" tiles. Cap the source so MapLibre
      // upscales real z7 data at street zooms instead.
      map.addSource('radar', { type: 'raster', tiles, tileSize: 256, maxzoom: 7, attribution: 'RainViewer' });
      map.addLayer({
        id: 'radar', type: 'raster', source: 'radar',
        layout: { visibility: enabled.radar ? 'visible' : 'none' },
        paint: { 'raster-opacity': 0.75 },
      }, 'quake-circles');
    } catch { /* keep previous frame */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- map init ----------
  useEffect(() => {
    const time = gibsDate();
    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [2.35, 43.2], // demo org region; the world is one drag away
      zoom: 2.2,
      minZoom: 1,
      maxZoom: 18,
      attributionControl: { compact: true },
      style: {
        version: 8,
        sources: {
          basemap: {
            type: 'raster', tileSize: 256, maxzoom: 9,
            tiles: [GIBS('MODIS_Terra_CorrectedReflectance_TrueColor', 9, 'jpg', time)],
            attribution: 'NASA GIBS/EOSDIS · USGS · Open-Meteo',
          },
          streets: {
            // Street-level detail: NASA imagery resolves to ~250 m/px, so
            // past zoom ~9 a dark street basemap takes over for close zooms.
            type: 'raster', tileSize: 256,
            tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
            attribution: '© CARTO © OpenStreetMap contributors',
          },
          labels: {
            type: 'raster', tileSize: 256,
            tiles: ['https://basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png'],
            attribution: '© CARTO © OpenStreetMap contributors',
          },
        },
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#020617' } },
          { id: 'basemap', type: 'raster', source: 'basemap' },
          {
            id: 'streets', type: 'raster', source: 'streets', minzoom: 8,
            paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0, 10, 1] },
          },
          { id: 'labels', type: 'raster', source: 'labels', paint: { 'raster-opacity': 0.9 } },
        ],
      },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    map.on('style.load', () => {
      map.setProjection({ type: 'globe' });

      // GIBS overlays
      for (const o of OVERLAYS) {
        if (!o.gibs) continue;
        map.addSource(o.id, {
          type: 'raster', tileSize: 256, maxzoom: o.gibs.level,
          tiles: [GIBS(o.gibs.layer, o.gibs.level, o.gibs.ext, time)],
        });
        map.addLayer({
          id: o.id, type: 'raster', source: o.id,
          layout: { visibility: enabled[o.id] ? 'visible' : 'none' },
          paint: { 'raster-opacity': 0.8 },
        });
      }

      // EONET natural events (fires, volcanoes, storms)
      map.addSource('eonet', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'eonet-circles', type: 'circle', source: 'eonet',
        layout: { visibility: enabled.events ? 'visible' : 'none' },
        paint: {
          'circle-radius': 3.5,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.7,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#0f172a',
        },
      });
      map.on('click', 'eonet-circles', (e) => {
        const f = e.features[0];
        new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
          .setLngLat(f.geometry.coordinates)
          .setHTML(
            `<div style="font-family:inherit;font-size:12px;color:#0f172a">
              <strong>${f.properties.title}</strong><br/>
              ${f.properties.cat} · ${new Date(f.properties.date).toLocaleDateString()}<br/>
              <a href="${f.properties.link}" target="_blank" rel="noreferrer" style="color:#ea580c">Verify source ↗</a>
            </div>`
          )
          .addTo(map);
      });
      map.on('mouseenter', 'eonet-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'eonet-circles', () => { map.getCanvas().style.cursor = ''; });

      // Earthquakes
      map.addSource('quakes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'quake-circles', type: 'circle', source: 'quakes',
        layout: { visibility: enabled.quakes ? 'visible' : 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 2.5, 3, 5, 8, 7, 16, 9, 28],
          'circle-color': ['case', ['==', ['get', 'tsunami'], 1], '#f43f5e', '#f97316'],
          'circle-opacity': 0.55,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': ['case', ['==', ['get', 'tsunami'], 1], '#fb7185', '#fdba74'],
        },
      });

      map.on('click', 'quake-circles', (e) => {
        const f = e.features[0];
        const [lng, lat, depth] = f.geometry.coordinates;
        new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
          .setLngLat([lng, lat])
          .setHTML(
            `<div style="font-family:inherit;font-size:12px;color:#0f172a">
              <strong>M${f.properties.mag} — ${f.properties.place ?? 'unknown'}</strong><br/>
              Depth ${Math.round(depth)} km · ${new Date(f.properties.time).toLocaleTimeString()}<br/>
              ${f.properties.tsunami === 1 ? '<span style="color:#e11d48;font-weight:700">⚠ TSUNAMI SIGNAL</span><br/>' : ''}
              <a href="${f.properties.url}" target="_blank" rel="noreferrer" style="color:#ea580c">Verify at USGS ↗</a>
            </div>`
          )
          .addTo(map);
      });
      map.on('mouseenter', 'quake-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'quake-circles', () => { map.getCanvas().style.cursor = ''; });

      // Click anywhere -> live point weather from Open-Meteo
      map.on('click', async (e) => {
        if (map.queryRenderedFeatures(e.point, { layers: ['quake-circles', 'eonet-circles'] }).length) return;
        const { lng, lat } = e.lngLat;
        const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '260px' })
          .setLngLat(e.lngLat)
          .setHTML('<div style="font-size:12px;color:#334155">Fetching live weather…</div>')
          .addTo(map);
        try {
          const r = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}` +
            `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,weather_code`
          );
          const w = (await r.json()).current;
          popup.setHTML(
            `<div style="font-family:inherit;font-size:12px;color:#0f172a">
              <strong>${WEATHER_CODES[w.weather_code] ?? 'Conditions'}</strong><br/>
              🌡 ${w.temperature_2m}°C · 💧 ${w.relative_humidity_2m}%<br/>
              💨 ${w.wind_speed_10m} km/h @ ${w.wind_direction_10m}°<br/>
              ☔ ${w.precipitation} mm<br/>
              <span style="color:#64748b">${lat.toFixed(2)}, ${lng.toFixed(2)} · Source: Open-Meteo</span>
            </div>`
          );
        } catch {
          popup.setHTML('<div style="font-size:12px;color:#991b1b">Weather source unreachable</div>');
        }
      });

      loadQuakes(map);
      loadRadar(map);
      loadEvents(map);
      setReady(true);
    });

    const quakeTimer = setInterval(() => loadQuakes(map), 5 * 60 * 1000);
    const radarTimer = setInterval(() => loadRadar(map), 10 * 60 * 1000);
    const eventTimer = setInterval(() => loadEvents(map), 10 * 60 * 1000);
    return () => { clearInterval(quakeTimer); clearInterval(radarTimer); clearInterval(eventTimer); map.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore last known position immediately on mount — weather must not
  // wait for the globe (map tiles can stall on slow connections).
  useEffect(() => {
    const stored = localStorage.getItem(MY_LOCATION_KEY);
    if (stored) {
      try { loadMyWeather(JSON.parse(stored)).catch(() => {}); } catch { /* corrupt entry — ignore */ }
    }
  }, [loadMyWeather]);

  // Keep the "you are here" marker in sync once the globe is ready
  useEffect(() => {
    if (ready && myWx) showMyMarker(myWx.pos);
  }, [ready, myWx, showMyMarker]);

  // ---------- layer toggling ----------
  const toggle = (id) => {
    setEnabled(prev => {
      const next = { ...prev, [id]: !prev[id] };
      const map = mapRef.current;
      const layerId = { quakes: 'quake-circles', events: 'eonet-circles' }[id] ?? id;
      if (map?.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', next[id] ? 'visible' : 'none');
      }
      return next;
    });
  };

  const flyTo = (coords) => mapRef.current?.flyTo({ center: coords, zoom: 5.5 });

  return (
    <div className="h-full flex flex-col lg:flex-row gap-2 min-h-0">
      {/* Globe */}
      <div className="flex-1 min-h-[300px] relative rounded-xl overflow-hidden border border-slate-800">
        <div ref={containerRef} className="absolute inset-0" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
            <Globe className="w-8 h-8 text-orange-500 animate-pulse" />
          </div>
        )}
        <div className="absolute top-2 left-2 bg-slate-900/85 border border-slate-700 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-xs font-semibold text-white">World Engine</span>
          <span className="text-[10px] text-slate-400">live · click anywhere for weather</span>
        </div>
      </div>

      {/* Side panel */}
      <div className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-2 min-h-0 overflow-y-auto">
        {/* My Weather */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <LocateFixed className="w-3.5 h-3.5 text-sky-400" />
              <h3 className="text-xs font-bold text-white">My Weather</h3>
            </div>
            <button
              onClick={locateMe}
              disabled={locating}
              className="flex items-center gap-1.5 px-2 py-1 bg-sky-500/15 border border-sky-500/30 text-sky-300 rounded-lg text-[10px] font-medium hover:bg-sky-500/25 disabled:opacity-50"
            >
              {locating ? <Loader2 className="w-3 h-3 animate-spin" /> : <LocateFixed className="w-3 h-3" />}
              {myWx ? 'Update' : 'Use my GPS'}
            </button>
          </div>

          {locError && <p className="text-[10px] text-red-400 mb-1">{locError}</p>}

          {!myWx ? (
            <p className="text-[10px] text-slate-500">
              Tap “Use my GPS” to see live conditions and the 7-day forecast wherever you are.
            </p>
          ) : (
            <>
              <p className="text-[10px] text-slate-400 truncate">{myWx.place}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-3xl">{WEATHER_EMOJI(myWx.current.weather_code)}</span>
                <div>
                  <p className="text-xl font-bold text-white leading-none">
                    {Math.round(myWx.current.temperature_2m)}°C
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {WEATHER_CODES[myWx.current.weather_code] ?? 'Conditions'} · feels {Math.round(myWx.current.apparent_temperature)}°
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                <span>💧 {myWx.current.relative_humidity_2m}%</span>
                <span>💨 {Math.round(myWx.current.wind_speed_10m)} km/h</span>
                <span>☔ {myWx.current.precipitation} mm</span>
              </div>

              {/* 7-day forecast */}
              <div className="mt-2.5 space-y-0.5">
                {myWx.daily.time.map((day, i) => (
                  <div key={day} className="flex items-center gap-2 text-[11px] py-0.5">
                    <span className="w-8 text-slate-400">
                      {i === 0 ? 'Today' : new Date(day + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' })}
                    </span>
                    <span className="w-5 text-center">{WEATHER_EMOJI(myWx.daily.weather_code[i])}</span>
                    <span className="w-8 text-sky-400 text-[10px]">
                      {myWx.daily.precipitation_probability_max?.[i] != null ? `${myWx.daily.precipitation_probability_max[i]}%` : ''}
                    </span>
                    <span className="flex-1 text-right text-slate-500">{Math.round(myWx.daily.temperature_2m_min[i])}°</span>
                    <span className="w-7 text-right font-semibold text-white">{Math.round(myWx.daily.temperature_2m_max[i])}°</span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-slate-600 mt-1.5">
                Updated {myWx.at.toLocaleTimeString()} · Source: Open-Meteo (national weather services)
              </p>
            </>
          )}
        </div>

        {/* Layers */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-3.5 h-3.5 text-orange-400" />
            <h3 className="text-xs font-bold text-white">Layers</h3>
          </div>
          <div className="space-y-1">
            {OVERLAYS.map(o => (
              <button
                key={o.id}
                onClick={() => toggle(o.id)}
                className={`w-full flex items-start gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                  enabled[o.id] ? 'bg-orange-500/15 border border-orange-500/30' : 'bg-slate-800/40 border border-transparent hover:bg-slate-800'
                }`}
              >
                <o.icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${enabled[o.id] ? 'text-orange-400' : 'text-slate-500'}`} />
                <span className="min-w-0">
                  <span className={`block text-xs font-medium ${enabled[o.id] ? 'text-orange-300' : 'text-slate-300'}`}>
                    {o.name}{o.id === 'quakes' && quakeCount > 0 && ` (${quakeCount})`}
                  </span>
                  <span className="block text-[10px] text-slate-500 leading-tight">{o.desc}</span>
                  <span className="block text-[9px] text-slate-600 leading-tight">{o.source}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Cascade Watch */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex-1 min-h-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
              <h3 className="text-xs font-bold text-white">Cascade Watch</h3>
            </div>
            {lastRefresh && (
              <span className="text-[9px] text-slate-500 flex items-center gap-1">
                <RefreshCw className="w-2.5 h-2.5" />{lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </div>

          {quakeFlags.length === 0 ? (
            <p className="text-[10px] text-slate-500">No cascade-capable seismic events in the last 24h.</p>
          ) : (
            <div className="space-y-1.5">
              {quakeFlags.map(q => (
                <button
                  key={q.id}
                  onClick={() => flyTo(q.coords)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg border ${
                    q.tsunami ? 'bg-rose-500/10 border-rose-500/40' : 'bg-slate-800/50 border-slate-700'
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">M{q.mag?.toFixed(1)}</span>
                    {q.tsunami && <span className="text-[9px] font-bold text-rose-400">TSUNAMI SIGNAL</span>}
                  </span>
                  <span className="block text-[10px] text-slate-400 truncate">{q.place}</span>
                  <span className="block text-[9px] text-slate-500">
                    depth {Math.round(q.depth)} km · {new Date(q.time).toLocaleTimeString()} · tap to view
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Known chains */}
          <button
            onClick={() => setChainsOpen(!chainsOpen)}
            className="mt-3 w-full flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 hover:text-orange-400"
          >
            {chainsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Known cascade chains
          </button>
          {chainsOpen && (
            <div className="mt-1.5 space-y-1.5">
              {CASCADE_CHAINS.map((c, i) => (
                <div key={i} className="px-2 py-1.5 bg-slate-800/40 rounded-lg">
                  <p className="text-[10px] text-slate-300">
                    <span className="font-semibold text-orange-300">{c.trigger}</span>
                    <span className="text-slate-500"> → </span>
                    <span className="font-semibold text-slate-200">{c.effect}</span>
                  </p>
                  <p className="text-[9px] text-slate-500 flex items-start gap-1 mt-0.5">
                    <Info className="w-2.5 h-2.5 mt-px flex-shrink-0" />{c.watch}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

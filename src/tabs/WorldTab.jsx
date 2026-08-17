import { useState, useEffect, useRef, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Globe, Layers, CloudRain, Flame, Wind, Droplets, Thermometer,
  Activity, AlertTriangle, RefreshCw, ChevronDown, ChevronRight, Info,
  LocateFixed, Loader2, Navigation2, Play, Pause, Calendar, Leaf, Mountain, Cloud, Clock
} from 'lucide-react';

// ============================================
// WORLD TAB — the World Engine's first surface
// A 3D globe with toggleable live layers from
// verifiable sources (NASA, USGS, RainViewer,
// Open-Meteo) and a Cascade Watch panel that
// flags how one disaster can trigger another.
// ============================================

// GIBS daily products lag ~1 day; daysBack=1 (yesterday, UTC) is the
// latest reliable date. Larger values step into satellite history.
const gibsDate = (daysBack = 1) => {
  const d = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
};

// Native max zoom per raster source (beyond these the providers have no data)
const RASTER_MAXZOOM = { radar: 7, basemap: 9, aerosol: 6, chlorophyll: 7, lst: 7 };

// Wind arrows as VECTOR LINE GEOMETRY (shaft + arrowhead per sample).
// Sprite icons on symbol layers proved unreliable on the globe
// projection across devices; line layers render everywhere.
const WIND_COLORS = ['#7dd3fc', '#38bdf8', '#fb923c', '#ef4444'];
const windBucket = (speed) => (speed < 10 ? 0 : speed < 25 ? 1 : speed < 45 ? 2 : 3);

// Build a MultiLineString arrow at (lat,lng) pointing dirTo (deg, 0=N),
// sized in degrees so it scales with the current view span.
const windArrowGeom = (lat, lng, dirTo, len) => {
  const rad = (dirTo * Math.PI) / 180;
  const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const vec = (angle, l) => [ (Math.sin(angle) * l) / cosLat, Math.cos(angle) * l ];
  const [dx, dy] = vec(rad, len);
  const tip = [lng + dx, lat + dy];
  const tail = [lng - dx * 0.6, lat - dy * 0.6];
  const [h1x, h1y] = vec(rad + Math.PI * 0.82, len * 0.45);
  const [h2x, h2y] = vec(rad - Math.PI * 0.82, len * 0.45);
  return {
    type: 'MultiLineString',
    coordinates: [
      [tail, tip],
      [tip, [tip[0] + h1x, tip[1] + h1y]],
      [tip, [tip[0] + h2x, tip[1] + h2y]],
    ],
  };
};

const POLLEN_SPECIES = [
  ['alder_pollen', 'Alder'], ['birch_pollen', 'Birch'], ['grass_pollen', 'Grass'],
  ['mugwort_pollen', 'Mugwort'], ['olive_pollen', 'Olive'], ['ragweed_pollen', 'Ragweed'],
];
const pollenColor = (v) => (v < 10 ? 'text-green-400' : v < 30 ? 'text-yellow-400' : v < 70 ? 'text-orange-400' : 'text-red-400');
const pmColor = (v) => (v < 15 ? 'text-green-400' : v < 35 ? 'text-yellow-400' : v < 75 ? 'text-orange-400' : 'text-red-400');

const GIBS = (layer, level, ext, time) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${time}/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.${ext}`;

// Toggleable overlay layers. Every entry names its source — verifiability is the point.
const OVERLAYS = [
  {
    id: 'radar', name: 'Precipitation radar', icon: CloudRain, defaultOn: true,
    source: 'RainViewer (global radar composite, ~10 min refresh)',
    desc: 'Live rain & snow radar — scrub the loop below the globe',
  },
  {
    id: 'wind', name: 'Wind field', icon: Navigation2, defaultOn: false,
    source: 'Open-Meteo grid sampling (national weather services)',
    desc: 'Direction arrows across the view, colored by speed',
  },
  {
    id: 'terrain', name: 'Terrain relief', icon: Mountain, defaultOn: false,
    source: 'AWS Terrain Tiles (USGS 3DEP lidar in the US, SRTM globally)',
    desc: 'Elevation hillshade — ridges, valleys, drainage',
  },
  {
    id: 'fcst', name: 'Forecast precip & clouds', icon: Cloud, defaultOn: false,
    source: 'Open-Meteo model blend (ICON/GFS/AROME…), hourly to +48 h',
    desc: 'Predicted rain and cloud cover — scrub the green slider',
  },
  {
    id: 'events', name: 'Natural events', icon: Flame, defaultOn: true,
    source: 'NASA EONET (curated; every event links to its source)',
    desc: 'Live wildfires, volcanoes, severe storms',
  },
  {
    id: 'aerosol', name: 'Aerosol / dust', icon: Wind, defaultOn: false,
    source: 'NASA MODIS Terra Aerosol Optical Depth, daily (2-day lag)',
    desc: 'Sandstorms, smoke plumes, haze',
    gibs: { layer: 'MODIS_Terra_Aerosol', level: 6, ext: 'png', lag: 2 },
  },
  {
    id: 'chlorophyll', name: 'Ocean chlorophyll', icon: Droplets, defaultOn: false,
    source: 'NASA MODIS Aqua Chlorophyll-a, daily (2-day lag)',
    desc: 'Algae blooms & ocean productivity',
    gibs: { layer: 'MODIS_Aqua_L2_Chlorophyll_A', level: 7, ext: 'png', lag: 2 },
  },
  {
    id: 'lst', name: 'Surface temperature', icon: Thermometer, defaultOn: false,
    source: 'NASA MODIS Terra Land Surface Temp (day), daily (2-day lag)',
    desc: 'Heat map of the land surface',
    gibs: { layer: 'MODIS_Terra_Land_Surface_Temp_Day', level: 7, ext: 'png', lag: 2 },
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

// Collapsible side-panel card; open/closed state persists per device.
const Section = ({ id, icon, title, subtitle, action, defaultOpen = true, className = '', children }) => {
  const [open, setOpen] = useState(() => {
    const s = localStorage.getItem(`wt-sec-${id}`);
    return s == null ? defaultOpen : s === '1';
  });
  const toggle = () => setOpen(o => { localStorage.setItem(`wt-sec-${id}`, o ? '0' : '1'); return !o; });
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-3 ${className}`}>
      <div className="flex items-center gap-2 cursor-pointer select-none" onClick={toggle}>
        {icon}
        <h3 className="text-xs font-bold text-white">{title}</h3>
        {subtitle && <span className="text-[9px] text-slate-500">{subtitle}</span>}
        <div className="ml-auto flex items-center gap-1.5">
          {action && <span onClick={e => e.stopPropagation()}>{action}</span>}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? '' : '-rotate-90'}`} />
        </div>
      </div>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
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
  const [myWx, setMyWx] = useState(null);       // { pos, place, current, daily, air, at }
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(null);
  const myMarkerRef = useRef(null);
  const [frames, setFrames] = useState(null);   // { host, list: [{time, path}] } — radar loop
  const [frameIdx, setFrameIdx] = useState(-1); // -1 = live (latest frame)
  const [playing, setPlaying] = useState(false);
  const [daysBack, setDaysBack] = useState(1);  // NASA satellite history slider
  const [fcstHour, setFcstHour] = useState(0);  // model forecast slider (+0..+48 h)
  const fcstRef = useRef(null);                 // cached grid forecast {pts, precip[][], cloud[][]}
  const [windCount, setWindCount] = useState(null); // live diagnostic: samples on the map

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
    // Air quality + pollen (pollen coverage is Europe-only; rest is global)
    let air = null;
    try {
      const a = await (await fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${pos.lat.toFixed(4)}&longitude=${pos.lng.toFixed(4)}` +
        `&current=pm2_5,pm10,ozone,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen&timezone=auto`
      )).json();
      air = a.current ?? null;
    } catch { /* air data optional */ }
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
    setMyWx({ pos, place, current: data.current, daily: data.daily, air, at: new Date() });
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

  const radarTiles = (host, path) => [`${host}${path}/256/{z}/{x}/{y}/2/1_1.png`];

  const loadRadar = useCallback(async (map) => {
    try {
      const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      const data = await res.json();
      const list = data?.radar?.past ?? [];
      if (!list.length) return;
      if (!map.getSource('radar')) {
        // RainViewer's composite only exists to z7 — deeper requests return
        // literal "Zoom Level Not Supported" tiles. Cap the source so MapLibre
        // upscales real z7 data at street zooms instead.
        map.addSource('radar', {
          type: 'raster', tiles: radarTiles(data.host, list.at(-1).path),
          tileSize: 256, maxzoom: 7, attribution: 'RainViewer',
        });
        map.addLayer({
          id: 'radar', type: 'raster', source: 'radar',
          layout: { visibility: enabled.radar ? 'visible' : 'none' },
          paint: { 'raster-opacity': 0.75 },
        }, 'quake-circles');
      }
      setFrames({ host: data.host, list });
    } catch { /* keep previous frames */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap raster tiles in place (falls back to re-adding the layer when the
  // running MapLibre lacks RasterTileSource.setTiles)
  const setRasterTiles = useCallback((id, tiles, beforeId) => {
    const map = mapRef.current;
    if (!map || !map.getSource(id)) return;
    const src = map.getSource(id);
    if (typeof src.setTiles === 'function') {
      try { src.setTiles(tiles); return; } catch { /* fall through */ }
    }
    if (!map.getLayer(id)) return;
    const vis = map.getLayoutProperty(id, 'visibility') ?? 'visible';
    const op = map.getPaintProperty(id, 'raster-opacity') ?? 0.8;
    map.removeLayer(id);
    map.removeSource(id);
    map.addSource(id, { type: 'raster', tileSize: 256, maxzoom: RASTER_MAXZOOM[id], tiles });
    map.addLayer(
      { id, type: 'raster', source: id, layout: { visibility: vis }, paint: { 'raster-opacity': op } },
      beforeId && map.getLayer(beforeId) ? beforeId : undefined
    );
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
    if (import.meta.env.DEV) window.__wtMap = map; // debugging hook, dev only
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');

    map.on('style.load', () => {
      map.setProjection({ type: 'globe' });

      // Terrain relief (lidar-derived elevation in the US, SRTM+ globally)
      map.addSource('dem', {
        type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 15,
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        attribution: 'Terrain: AWS/USGS/SRTM',
      });
      map.addLayer({
        id: 'terrain', type: 'hillshade', source: 'dem',
        layout: { visibility: enabled.terrain ? 'visible' : 'none' },
        paint: { 'hillshade-exaggeration': 0.6 },
      }, 'streets');

      // GIBS overlays (each product knows how far behind today it publishes)
      for (const o of OVERLAYS) {
        if (!o.gibs) continue;
        map.addSource(o.id, {
          type: 'raster', tileSize: 256, maxzoom: o.gibs.level,
          tiles: [GIBS(o.gibs.layer, o.gibs.level, o.gibs.ext, gibsDate(o.gibs.lag ?? 1))],
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

  // ---------- radar time loop ----------
  useEffect(() => {
    if (!ready || !frames) return;
    const idx = frameIdx === -1 ? frames.list.length - 1 : Math.min(frameIdx, frames.list.length - 1);
    const f = frames.list[idx];
    if (f) setRasterTiles('radar', radarTiles(frames.host, f.path), 'quake-circles');
  }, [ready, frames, frameIdx, setRasterTiles]);

  useEffect(() => {
    if (!playing || !frames) return;
    const t = setInterval(() => {
      setFrameIdx(i => {
        const n = frames.list.length;
        const cur = i === -1 ? n - 1 : i;
        return (cur + 1) % n;
      });
    }, 650);
    return () => clearInterval(t);
  }, [playing, frames]);

  // ---------- NASA satellite history (day slider) ----------
  useEffect(() => {
    if (!ready) return;
    setRasterTiles('basemap', [GIBS('MODIS_Terra_CorrectedReflectance_TrueColor', 9, 'jpg', gibsDate(daysBack))], 'streets');
    for (const o of OVERLAYS) {
      if (o.gibs) {
        const ds = gibsDate(Math.max(daysBack, o.gibs.lag ?? 1));
        setRasterTiles(o.id, [GIBS(o.gibs.layer, o.gibs.level, o.gibs.ext, ds)], 'eonet-circles');
      }
    }
  }, [ready, daysBack, setRasterTiles]);

  // ---------- wind field ----------
  const fetchWind = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    // Bounds can be degenerate on the globe at low zoom — fall back to a
    // center+zoom derived window so the grid is always finite.
    let south, north, west, east;
    try {
      const b = map.getBounds();
      south = b.getSouth(); north = b.getNorth(); west = b.getWest(); east = b.getEast();
    } catch { /* fall through to fallback */ }
    if (![south, north, west, east].every(Number.isFinite) || Math.abs(north - south) < 0.01) {
      const c = map.getCenter();
      const z = map.getZoom();
      const lngSpan = Math.min(300, 360 / Math.pow(2, Math.max(0, z - 1)));
      const latSpan = lngSpan / 2;
      west = c.lng - lngSpan / 2; east = c.lng + lngSpan / 2;
      south = c.lat - latSpan / 2; north = c.lat + latSpan / 2;
    }
    south = Math.max(-80, south); north = Math.min(80, north);
    const pts = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) {
        const lat = south + (north - south) * (r + 0.5) / 4;
        const lng = ((west + (east - west) * (c + 0.5) / 6 + 540) % 360) - 180;
        if (Number.isFinite(lat) && Number.isFinite(lng)) pts.push({ lat, lng });
      }
    }
    if (!pts.length) { setWindCount(0); return; }
    // Arrow length scales with the visible area
    let len = Math.min(Math.abs(east - west), Math.abs(north - south) * 2) / 26;
    if (!Number.isFinite(len) || len <= 0) len = 2;
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${pts.map(p => p.lat.toFixed(2)).join(',')}` +
        `&longitude=${pts.map(p => p.lng.toFixed(2)).join(',')}&current=wind_speed_10m,wind_direction_10m`
      );
      const j = await res.json();
      const arr = Array.isArray(j) ? j : [j];
      const features = arr.map((row, i) => {
        const w = row?.current;
        if (!w || w.wind_speed_10m == null) return null;
        return {
          type: 'Feature',
          // arrow points where the wind is GOING (dir is where it comes from)
          geometry: windArrowGeom(pts[i].lat, pts[i].lng, (w.wind_direction_10m + 180) % 360, len),
          properties: { speed: w.wind_speed_10m, bucket: windBucket(w.wind_speed_10m) },
        };
      }).filter(Boolean);
      map.getSource('wind')?.setData({ type: 'FeatureCollection', features });
      setWindCount(features.length);
    } catch { setWindCount(0); /* wind sampling unavailable */ }
  }, []);

  // ---------- precipitation & cloud forecast (model, +48 h) ----------
  const applyFcstHour = useCallback((hour) => {
    const map = mapRef.current;
    const data = fcstRef.current;
    if (!map || !data || !map.getSource('fcst')) return;
    const features = data.pts.map((p, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        p: data.precip[i]?.[hour] ?? 0,
        c: data.cloud[i]?.[hour] ?? 0,
      },
    }));
    map.getSource('fcst').setData({ type: 'FeatureCollection', features });
  }, []);

  const fetchFcst = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    const south = Math.max(-80, b.getSouth()), north = Math.min(80, b.getNorth());
    const west = b.getWest(), east = b.getEast();
    const pts = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 8; c++) {
        const lat = south + (north - south) * (r + 0.5) / 5;
        const lng = ((west + (east - west) * (c + 0.5) / 8 + 540) % 360) - 180;
        pts.push({ lat, lng });
      }
    }
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${pts.map(p => p.lat.toFixed(2)).join(',')}` +
        `&longitude=${pts.map(p => p.lng.toFixed(2)).join(',')}&hourly=precipitation,cloud_cover&forecast_days=3&timezone=UTC`
      );
      const j = await res.json();
      const arr = Array.isArray(j) ? j : [j];
      // Index 0 of the hourly arrays = current UTC hour onward
      const nowIso = new Date().toISOString().slice(0, 13);
      const startIdx = Math.max(0, (arr[0]?.hourly?.time ?? []).findIndex(t => t.startsWith(nowIso)));
      fcstRef.current = {
        pts,
        precip: arr.map(row => (row?.hourly?.precipitation ?? []).slice(startIdx)),
        cloud: arr.map(row => (row?.hourly?.cloud_cover ?? []).slice(startIdx)),
      };
    } catch { /* forecast unavailable — keep last grid */ }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (enabled.fcst && !map.getSource('fcst')) {
      map.addSource('fcst', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      const before = map.getLayer('eonet-circles') ? 'eonet-circles' : undefined;
      map.addLayer({
        id: 'fcst-clouds', type: 'circle', source: 'fcst',
        paint: {
          'circle-radius': 26,
          'circle-color': '#94a3b8',
          'circle-blur': 1,
          'circle-opacity': ['*', ['/', ['get', 'c'], 100], 0.4],
        },
      }, before);
      map.addLayer({
        id: 'fcst-precip', type: 'circle', source: 'fcst',
        filter: ['>', ['get', 'p'], 0.05],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'p'], 0.05, 5, 1, 9, 5, 16, 15, 26],
          'circle-color': ['interpolate', ['linear'], ['get', 'p'], 0.05, '#7dd3fc', 1, '#3b82f6', 5, '#8b5cf6', 15, '#e11d48'],
          'circle-blur': 0.5,
          'circle-opacity': 0.55,
        },
      }, before);
    }
    for (const l of ['fcst-clouds', 'fcst-precip']) {
      if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', enabled.fcst ? 'visible' : 'none');
    }
    if (!enabled.fcst) return;
    fetchFcst().then(() => applyFcstHour(fcstHour));
    let t = null;
    const onMove = () => { clearTimeout(t); t = setTimeout(() => fetchFcst().then(() => applyFcstHour(fcstHour)), 800); };
    map.on('moveend', onMove);
    return () => { clearTimeout(t); map.off('moveend', onMove); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled.fcst, ready, fetchFcst, applyFcstHour]);

  useEffect(() => { applyFcstHour(fcstHour); }, [fcstHour, applyFcstHour]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (enabled.wind && !map.getSource('wind')) {
      map.addSource('wind', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      // Topmost layers (no beforeId): arrows must never sit under radar or
      // cloud rasters. Dark casing underneath keeps them visible on any
      // background, satellite or storm.
      map.addLayer({
        id: 'wind-casing', type: 'line', source: 'wind',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#0f172a',
          'line-width': ['interpolate', ['linear'], ['get', 'speed'], 0, 4, 30, 5, 60, 6.5],
          'line-opacity': 0.85,
        },
      });
      map.addLayer({
        id: 'wind', type: 'line', source: 'wind',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['match', ['get', 'bucket'], 0, WIND_COLORS[0], 1, WIND_COLORS[1], 2, WIND_COLORS[2], WIND_COLORS[3]],
          'line-width': ['interpolate', ['linear'], ['get', 'speed'], 0, 2, 30, 2.8, 60, 4],
          'line-opacity': 1,
        },
      });
    }
    for (const l of ['wind-casing', 'wind']) {
      if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', enabled.wind ? 'visible' : 'none');
    }
    if (!enabled.wind) return;
    fetchWind();
    let t = null;
    const onMove = () => { clearTimeout(t); t = setTimeout(fetchWind, 700); };
    map.on('moveend', onMove);
    return () => { clearTimeout(t); map.off('moveend', onMove); };
  }, [enabled.wind, ready, fetchWind]);

  // ---------- layer toggling ----------
  const toggle = (id) => {
    setEnabled(prev => {
      const next = { ...prev, [id]: !prev[id] };
      const map = mapRef.current;
      const layerIds = { quakes: ['quake-circles'], events: ['eonet-circles'], fcst: ['fcst-clouds', 'fcst-precip'], wind: ['wind-casing', 'wind'] }[id] ?? [id];
      for (const layerId of layerIds) {
        if (map?.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', next[id] ? 'visible' : 'none');
        }
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
      </div>

      {/* Side panel */}
      <div className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-2 min-h-0 overflow-y-auto">
        {/* My Weather */}
        <Section
          id="myweather"
          icon={<LocateFixed className="w-3.5 h-3.5 text-sky-400" />}
          title="My Weather"
          action={
            <button
              onClick={locateMe}
              disabled={locating}
              className="flex items-center gap-1.5 px-2 py-1 bg-sky-500/15 border border-sky-500/30 text-sky-300 rounded-lg text-[10px] font-medium hover:bg-sky-500/25 disabled:opacity-50"
            >
              {locating ? <Loader2 className="w-3 h-3 animate-spin" /> : <LocateFixed className="w-3 h-3" />}
              {myWx ? 'Update' : 'Use my GPS'}
            </button>
          }
        >
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

              {/* Air quality & pollen */}
              {myWx.air && (
                <div className="mt-2 pt-2 border-t border-slate-800">
                  <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Leaf className="w-2.5 h-2.5" />Air & pollen
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
                    {myWx.air.pm2_5 != null && <span>PM2.5 <b className={pmColor(myWx.air.pm2_5)}>{Math.round(myWx.air.pm2_5)}</b></span>}
                    {myWx.air.pm10 != null && <span>PM10 <b className={pmColor(myWx.air.pm10 / 2)}>{Math.round(myWx.air.pm10)}</b></span>}
                    {myWx.air.ozone != null && <span>O₃ <b className={myWx.air.ozone < 100 ? 'text-green-400' : myWx.air.ozone < 160 ? 'text-yellow-400' : 'text-red-400'}>{Math.round(myWx.air.ozone)}</b></span>}
                  </div>
                  {(() => {
                    const species = POLLEN_SPECIES.filter(([k]) => myWx.air[k] != null);
                    return species.length ? (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-400 mt-1">
                        {species.map(([k, label]) => (
                          <span key={k}>{label} <b className={pollenColor(myWx.air[k])}>{Math.round(myWx.air[k])}</b></span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[9px] text-slate-600 mt-1">Pollen forecast: no coverage at this location (European model)</p>
                    );
                  })()}
                  <p className="text-[8px] text-slate-600 mt-1">pollen: grains/m³ · air: µg/m³ · Source: Open-Meteo Air Quality (CAMS)</p>
                </div>
              )}

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
        </Section>

        {/* Time machine */}
        <Section
          id="time"
          icon={<Clock className="w-3.5 h-3.5 text-orange-400" />}
          title="Time"
          subtitle="past · now · forecast"
        >
          <div className="space-y-1.5">
            {frames && (
              <div className="flex items-center gap-2" title="Rain radar loop — last 2 hours">
                <button
                  onClick={() => setPlaying(p => !p)}
                  className="p-0.5 text-orange-400 hover:text-orange-300 flex-shrink-0"
                  title={playing ? 'Pause radar loop' : 'Play radar loop (last 2 h)'}
                >
                  {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <input
                  type="range" min={0} max={frames.list.length - 1}
                  value={frameIdx === -1 ? frames.list.length - 1 : frameIdx}
                  onChange={e => setFrameIdx(Number(e.target.value))}
                  className="flex-1 accent-orange-500 h-1"
                />
                <span className="text-[10px] text-slate-300 w-12 text-right flex-shrink-0 font-medium">
                  {(() => {
                    const idx = frameIdx === -1 ? frames.list.length - 1 : frameIdx;
                    return idx === frames.list.length - 1
                      ? 'LIVE'
                      : new Date(frames.list[idx].time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  })()}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2" title="Model forecast — next 48 hours">
              <Cloud className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
              <input
                type="range" min={0} max={48} value={fcstHour}
                onChange={e => {
                  setFcstHour(Number(e.target.value));
                  if (!enabled.fcst) toggle('fcst');
                }}
                className="flex-1 accent-green-500 h-1"
              />
              <span className="text-[10px] text-slate-300 w-12 text-right flex-shrink-0 font-medium">
                {fcstHour === 0 ? 'Now' : `+${fcstHour}h`}
              </span>
            </div>
            <div className="flex items-center gap-2" title="NASA satellite history — 30 days">
              <Calendar className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
              <input
                type="range" min={1} max={30} value={daysBack}
                onChange={e => setDaysBack(Number(e.target.value))}
                style={{ direction: 'rtl' }}
                className="flex-1 accent-sky-500 h-1"
              />
              <span className="text-[10px] text-slate-300 w-12 text-right flex-shrink-0 font-medium">
                {daysBack === 1 ? 'Latest' : gibsDate(daysBack).slice(5)}
              </span>
            </div>
            <p className="text-[8px] text-slate-500 leading-none">
              Orange: radar loop (2 h) · Green: forecast (+48 h) · Blue: satellite history (30 d) · click the globe anywhere for live weather
            </p>
          </div>
        </Section>

        {/* Layers */}
        <Section
          id="layers"
          icon={<Layers className="w-3.5 h-3.5 text-orange-400" />}
          title="Layers"
        >
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
                    {o.name}
                    {o.id === 'quakes' && quakeCount > 0 && ` (${quakeCount})`}
                    {o.id === 'wind' && enabled.wind && windCount != null && ` (${windCount} samples)`}
                  </span>
                  <span className="block text-[10px] text-slate-500 leading-tight">{o.desc}</span>
                  <span className="block text-[9px] text-slate-600 leading-tight">{o.source}</span>
                </span>
              </button>
            ))}
          </div>
        </Section>

        {/* Cascade Watch */}
        <Section
          id="cascade"
          icon={<AlertTriangle className="w-3.5 h-3.5 text-orange-400" />}
          title="Cascade Watch"
          className="flex-shrink-0"
          action={lastRefresh && (
            <span className="text-[9px] text-slate-500 flex items-center gap-1">
              <RefreshCw className="w-2.5 h-2.5" />{lastRefresh.toLocaleTimeString()}
            </span>
          )}
        >
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
        </Section>
      </div>
    </div>
  );
};

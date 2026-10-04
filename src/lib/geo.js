// ============================================================
// Map geometry helpers — pure functions, no browser or React needed
// (unit-testable with plain node).
//
// Shapes are stored as:
//   zone   { path: [{lat, lng}, ...] }            (open ring, ≥ 3 points)
//   route  { path: [{lat, lng}, ...] }            (≥ 2 points)
//   circle { center: {lat, lng}, radius: metres }
// GeoJSON coordinates are [lng, lat]; everything here converts at the edge.
// ============================================================

const R_EARTH = 6371008.8;          // mean radius, metres
const MERC_HALF = 20037508.342789244; // half the EPSG:3857 world width, metres

function toRad(d) { return (d * Math.PI) / 180; }
function toDeg(r) { return (r * 180) / Math.PI; }

export function isLatLng(p) {
  return p != null && Number.isFinite(p.lat) && Number.isFinite(p.lng)
    && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}

// Great-circle distance in metres (haversine).
export function distanceM(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Ray casting on lat/lng (fine at incident scale; rings must not cross the antimeridian).
export function pointInPolygon(pt, ring) {
  if (!ring || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.lat > pt.lat) !== (b.lat > pt.lat)) {
      const x = ((b.lng - a.lng) * (pt.lat - a.lat)) / (b.lat - a.lat) + a.lng;
      if (pt.lng < x) inside = !inside;
    }
  }
  return inside;
}

// Is a point inside a stored shape? Routes have no inside.
export function insideShape(shape, pt) {
  const g = shape?.geometry ?? {};
  if (shape?.kind === 'circle') return isLatLng(g.center) && Number(g.radius) > 0 && distanceM(g.center, pt) <= Number(g.radius);
  if (shape?.kind === 'zone') return pointInPolygon(pt, g.path ?? []);
  return false;
}

// Length of a path in metres.
export function pathLengthM(path) {
  let m = 0;
  for (let i = 1; i < (path?.length ?? 0); i++) m += distanceM(path[i - 1], path[i]);
  return m;
}

// Approximate area of a ring in m² (spherical excess on a local projection).
export function polygonAreaM2(ring) {
  if (!ring || ring.length < 3) return 0;
  const lat0 = toRad(ring.reduce((a, p) => a + p.lat, 0) / ring.length);
  const xy = ring.map(p => [toRad(p.lng) * R_EARTH * Math.cos(lat0), toRad(p.lat) * R_EARTH]);
  let s = 0;
  for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) s += xy[j][0] * xy[i][1] - xy[i][0] * xy[j][1];
  return Math.abs(s / 2);
}

// Point at a distance/bearing from a start point (metres, degrees).
export function destination(from, distM, bearingDeg) {
  const d = distM / R_EARTH, b = toRad(bearingDeg);
  const la1 = toRad(from.lat), lo1 = toRad(from.lng);
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
  const lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return { lat: toDeg(la2), lng: ((toDeg(lo2) + 540) % 360) - 180 };
}

// Circle as a polygon ring (for export to formats with no circle type).
export function circleRing(center, radius, n = 64) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(destination(center, radius, (360 * i) / n));
  return out;
}

// A sensible anchor for a shape's label / popup.
export function shapeAnchor(shape) {
  const g = shape?.geometry ?? {};
  if (shape?.kind === 'circle') return isLatLng(g.center) ? g.center : null;
  const path = (g.path ?? []).filter(isLatLng);
  if (!path.length) return null;
  if (shape?.kind === 'route') return path[Math.floor((path.length - 1) / 2)];
  return { lat: path.reduce((a, p) => a + p.lat, 0) / path.length, lng: path.reduce((a, p) => a + p.lng, 0) / path.length };
}

// ---------- tiles ----------

// Slippy-map tile containing a point.
export function lngLatToTile(lat, lng, z) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const la = toRad(Math.max(-85.0511, Math.min(85.0511, lat)));
  const y = Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n);
  return { x: Math.min(n - 1, Math.max(0, x)), y: Math.min(n - 1, Math.max(0, y)), z };
}

// EPSG:3857 bounding box of a tile: [minx, miny, maxx, maxy] in metres.
export function tileBBox3857(x, y, z) {
  const size = (2 * MERC_HALF) / 2 ** z;
  const minx = -MERC_HALF + x * size;
  const maxy = MERC_HALF - y * size;
  return [minx, maxy - size, minx + size, maxy];
}

// Normalise a tile coordinate (wrap x around the world, reject y off the map).
export function normTile(x, y, z) {
  const n = 2 ** z;
  if (y < 0 || y >= n) return null;
  return { x: ((x % n) + n) % n, y, z };
}

// XYZ template → URL. Supports {z} {x} {y} {-y} (TMS) and {s} (a/b/c).
export function xyzTileUrl(template, x, y, z) {
  const t = normTile(x, y, z);
  if (!t || !template) return null;
  return String(template)
    .replace(/\{s\}/g, 'abc'[(t.x + t.y) % 3])
    .replace(/\{z\}/g, String(t.z))
    .replace(/\{x\}/g, String(t.x))
    .replace(/\{-y\}/g, String(2 ** t.z - 1 - t.y))
    .replace(/\{y\}/g, String(t.y));
}

// WMS 1.3.0 GetMap URL for one 256 px tile in EPSG:3857.
export function wmsTileUrl(baseUrl, layers, x, y, z) {
  const t = normTile(x, y, z);
  if (!t || !baseUrl) return null;
  const bbox = tileBBox3857(t.x, t.y, t.z).map(v => v.toFixed(2)).join(',');
  const params = [
    'SERVICE=WMS', 'VERSION=1.3.0', 'REQUEST=GetMap', 'FORMAT=image/png', 'TRANSPARENT=TRUE',
    'CRS=EPSG:3857', 'WIDTH=256', 'HEIGHT=256',
    `LAYERS=${encodeURIComponent(layers ?? '')}`, 'STYLES=', `BBOX=${bbox}`,
  ].join('&');
  const base = String(baseUrl).trim();
  return base + (base.includes('?') ? (/[?&]$/.test(base) ? '' : '&') : '?') + params;
}

// URL for any configured overlay tile.
export function overlayTileUrl(overlay, x, y, z) {
  if (!overlay) return null;
  return overlay.type === 'wms'
    ? wmsTileUrl(overlay.url, overlay.layers, x, y, z)
    : xyzTileUrl(overlay.url, x, y, z);
}

// ---------- import ----------

function cleanPath(coords) {
  // [[lng, lat, (alt)], ...] → [{lat, lng}], dropping invalid points and repeats
  const out = [];
  for (const c of coords ?? []) {
    if (!Array.isArray(c)) continue;
    const p = { lat: Number(c[1]), lng: Number(c[0]) };
    if (!isLatLng(p)) continue;
    const last = out[out.length - 1];
    if (last && last.lat === p.lat && last.lng === p.lng) continue;
    out.push(p);
  }
  return out;
}
function openRing(path) {
  if (path.length > 1) {
    const a = path[0], b = path[path.length - 1];
    if (a.lat === b.lat && a.lng === b.lng) return path.slice(0, -1);
  }
  return path;
}

function propName(props) {
  if (!props || typeof props !== 'object') return '';
  const v = props.name ?? props.Name ?? props.NAME ?? props.title ?? props.label ?? props.Label ?? '';
  return String(v).trim().slice(0, 200);
}
function propNotes(props) {
  if (!props || typeof props !== 'object') return null;
  const v = props.description ?? props.notes ?? props.Description ?? null;
  return v == null || v === '' ? null : String(typeof v === 'object' ? (v.value ?? JSON.stringify(v)) : v).slice(0, 2000);
}

function emptyResult() { return { zones: [], routes: [], points: [], skipped: 0 }; }

function addGeometry(out, geom, label, notes) {
  if (!geom || typeof geom !== 'object') { out.skipped++; return; }
  const c = geom.coordinates;
  switch (geom.type) {
    case 'Point': {
      const p = { lat: Number(c?.[1]), lng: Number(c?.[0]) };
      if (isLatLng(p)) out.points.push({ label, notes, ...p }); else out.skipped++;
      break;
    }
    case 'MultiPoint':
      for (const pc of c ?? []) addGeometry(out, { type: 'Point', coordinates: pc }, label, notes);
      break;
    case 'LineString': {
      const path = cleanPath(c);
      if (path.length >= 2) out.routes.push({ label, notes, path }); else out.skipped++;
      break;
    }
    case 'MultiLineString':
      for (const lc of c ?? []) addGeometry(out, { type: 'LineString', coordinates: lc }, label, notes);
      break;
    case 'Polygon': {
      // outer ring only — holes are not represented in zones
      const path = openRing(cleanPath(c?.[0]));
      if (path.length >= 3) out.zones.push({ label, notes, path }); else out.skipped++;
      break;
    }
    case 'MultiPolygon':
      for (const pc of c ?? []) addGeometry(out, { type: 'Polygon', coordinates: pc }, label, notes);
      break;
    case 'GeometryCollection':
      for (const g of geom.geometries ?? []) addGeometry(out, g, label, notes);
      break;
    default:
      out.skipped++;
  }
}

// GeoJSON (string or object) → { zones, routes, points, skipped }.
export function parseGeoJSON(input) {
  const obj = typeof input === 'string' ? JSON.parse(input) : input;
  const out = emptyResult();
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (o.type === 'FeatureCollection') { for (const f of o.features ?? []) walk(f); return; }
    if (o.type === 'Feature') { addGeometry(out, o.geometry, propName(o.properties), propNotes(o.properties)); return; }
    addGeometry(out, o, '', null);
  };
  if (Array.isArray(obj)) obj.forEach(walk); else walk(obj);
  return out;
}

// KML coordinates text "lng,lat[,alt] lng,lat[,alt] ..." → [[lng, lat], ...]
function kmlCoords(text) {
  return String(text ?? '').trim().split(/\s+/).filter(Boolean).map(t => t.split(',').map(Number));
}
function localName(n) { return n?.localName ?? String(n?.nodeName ?? '').replace(/^.*:/, ''); }
function childNamed(el, name) {
  for (const n of Array.from(el?.childNodes ?? [])) if (n.nodeType === 1 && localName(n) === name) return n;
  return null;
}
function descendants(el, name) {
  // namespace-agnostic: match by local name
  const all = Array.from(el?.getElementsByTagName?.('*') ?? []);
  return all.filter(n => localName(n) === name);
}

// KML text → { zones, routes, points, skipped }. Uses the browser's
// DOMParser; pass { DOMParser } to use another implementation.
export function parseKML(text, opts = {}) {
  const Parser = opts.DOMParser ?? globalThis.DOMParser;
  if (!Parser) throw new Error('DOMParser unavailable');
  const doc = new Parser().parseFromString(String(text), 'application/xml');
  if (descendants(doc, 'parsererror').length) throw new Error('Not a valid KML file');
  const out = emptyResult();
  for (const pm of descendants(doc, 'Placemark')) {
    const label = String(childNamed(pm, 'name')?.textContent ?? '').trim().slice(0, 200);
    const d = String(childNamed(pm, 'description')?.textContent ?? '').trim();
    const notes = d ? d.slice(0, 2000) : null;
    let found = false;
    for (const poly of descendants(pm, 'Polygon')) {
      found = true;
      const outer = childNamed(poly, 'outerBoundaryIs');
      const ring = outer ? descendants(outer, 'coordinates')[0] : descendants(poly, 'coordinates')[0];
      addGeometry(out, { type: 'Polygon', coordinates: [kmlCoords(ring?.textContent)] }, label, notes);
    }
    for (const ls of descendants(pm, 'LineString')) {
      found = true;
      addGeometry(out, { type: 'LineString', coordinates: kmlCoords(descendants(ls, 'coordinates')[0]?.textContent) }, label, notes);
    }
    for (const pt of descendants(pm, 'Point')) {
      found = true;
      const c = kmlCoords(descendants(pt, 'coordinates')[0]?.textContent)[0];
      addGeometry(out, { type: 'Point', coordinates: c }, label, notes);
    }
    if (!found) out.skipped++;
  }
  return out;
}

// Pick the parser from the file name (falls back to sniffing the content).
export function parseMapFile(name, text, opts) {
  const n = String(name ?? '').toLowerCase();
  if (n.endsWith('.kml') || /^\s*<(\?xml|kml)/i.test(text)) return parseKML(text, opts);
  return parseGeoJSON(text);
}

// ---------- export ----------

function ll(p) { return [Number(p.lng.toFixed(7)), Number(p.lat.toFixed(7))]; }

// Shapes + markers → GeoJSON FeatureCollection. Circles become 64-point
// polygons (GeoJSON has no circle) with center/radius kept in properties.
// labels: { category(id) → text, markerKind(id) → text } (optional).
export function toGeoJSON({ shapes = [], markers = [], labels = {}, name = 'Watchtower map' } = {}) {
  const features = [];
  for (const s of shapes) {
    const g = s.geometry ?? {};
    const props = {
      name: s.label || labels.category?.(s.category) || s.category || s.kind,
      source: 'watchtower', shape: s.kind, category: s.category ?? null,
      category_label: labels.category?.(s.category) ?? null,
      notes: s.notes ?? null, color: s.color ?? null, stroke: s.color ?? null,
      alert: s.alert ?? 'none', active: s.active !== false,
      created_at: s.created_at ?? null, updated_at: s.updated_at ?? null,
    };
    let geometry = null;
    if (s.kind === 'circle' && isLatLng(g.center) && Number(g.radius) > 0) {
      const ring = circleRing(g.center, Number(g.radius)).map(ll);
      geometry = { type: 'Polygon', coordinates: [[...ring, ring[0]]] };
      props.center = ll(g.center); props.radius_m = Math.round(Number(g.radius));
    } else if (s.kind === 'zone') {
      const ring = (g.path ?? []).filter(isLatLng).map(ll);
      if (ring.length >= 3) geometry = { type: 'Polygon', coordinates: [[...ring, ring[0]]] };
      props.fill = s.color ?? null;
    } else if (s.kind === 'route') {
      const line = (g.path ?? []).filter(isLatLng).map(ll);
      if (line.length >= 2) geometry = { type: 'LineString', coordinates: line };
    }
    if (geometry) features.push({ type: 'Feature', id: s.id, geometry, properties: props });
  }
  for (const m of markers) {
    const p = { lat: Number(m.lat), lng: Number(m.lng) };
    if (!isLatLng(p)) continue;
    features.push({
      type: 'Feature', id: m.id, geometry: { type: 'Point', coordinates: ll(p) },
      properties: {
        name: m.label || labels.markerKind?.(m.kind) || m.kind, source: 'watchtower', marker: m.kind,
        kind_label: labels.markerKind?.(m.kind) ?? null, notes: m.notes ?? null, created_at: m.created_at ?? null,
      },
    });
  }
  return { type: 'FeatureCollection', name, generated: new Date().toISOString(), features };
}

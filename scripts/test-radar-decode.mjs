// Decodes live RainViewer tiles with the palette and reports how many echo
// pixels match it. Run: node scripts/test-radar-decode.mjs
import { PNG } from 'pngjs';
import { rvPixelDbz, RV_PALETTE } from '../src/lib/radarPalette.js';

const exact = new Set(RV_PALETTE.map(([rgb, a]) => rgb * 256 + a));
const meta = await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();
const frame = meta.radar.past.at(-1);
let echo = 0, matched = 0, near = 0, unknown = 0;
const hist = {};
// a band of z5 tiles over North America and Europe, where rain is likely somewhere
const tiles = [];
for (let x = 4; x <= 11; x++) for (let y = 9; y <= 12; y++) tiles.push([5, x, y]);
for (let x = 14; x <= 18; x++) for (let y = 9; y <= 11; y++) tiles.push([5, x, y]);
for (const [z, x, y] of tiles) {
  const buf = Buffer.from(await (await fetch(`${meta.host}${frame.path}/256/${z}/${x}/${y}/2/0_0.png`)).arrayBuffer());
  const png = PNG.sync.read(buf);
  for (let i = 0; i < png.data.length; i += 4) {
    const [r, g, b, a] = [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]];
    if (!a) continue;
    echo++;
    if (exact.has(((r << 16) | (g << 8) | b) * 256 + a)) matched++;
    const v = rvPixelDbz(r, g, b, a);
    if (v == null) unknown++;
    else { if (!exact.has(((r << 16) | (g << 8) | b) * 256 + a)) near++; const k = Math.floor(v / 10) * 10; hist[k] = (hist[k] ?? 0) + 1; }
  }
}
console.log({ tiles: tiles.length, echo, exactMatch: matched, nearestMatch: near, unknown, pct: echo ? (100 * matched / echo).toFixed(1) + '%' : '-' });
console.log('dBZ histogram (by 10):', hist);

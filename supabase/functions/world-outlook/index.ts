// ============================================================
// Watchtower edge function: world-outlook
// Seasonal context the browser can't fetch itself (NOAA serves no
// CORS headers): the ENSO alert status + synopsis from the Climate
// Prediction Center, and the recent Oceanic Niño Index (ONI) run —
// the El Niño / La Niña signal behind the Forecasts tab's seasonal view.
// Cached per isolate for 6 hours; NOAA updates monthly.
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

const decode = (s: string) => s
  .replace(/&ntilde;/g, 'ñ').replace(/&#37;/g, '%').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const text = (html: string) => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

let cache: { at: number; body: unknown } | null = null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (cache && Date.now() - cache.at < 6 * 3600e3) return json(cache.body);

  const out: Record<string, unknown> = { source: 'NOAA Climate Prediction Center', fetched_at: new Date().toISOString() };
  try {
    const html = await (await fetch('https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml')).text();
    // The status sits a few tags after its label, inside </strong>
    const statusM = html.match(/ENSO Alert System Status:([\s\S]{0,600}?)<\/strong>/i);
    const synM = html.match(/Synopsis:([\s\S]{0,1200}?)<\/strong>/i);
    const status = statusM ? text(statusM[1]) : '';
    out.status = status || null;
    out.synopsis = synM ? text(synM[1]) : null;
    out.discussion_url = 'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml';
  } catch { out.status = null; }

  try {
    const raw = await (await fetch('https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt')).text();
    const rows = raw.trim().split('\n').slice(1).map(l => l.trim().split(/\s+/))
      .filter(p => p.length >= 4)
      .map(p => ({ season: p[0], year: +p[1], anomaly: +p[3] }));
    out.oni = rows.slice(-12);
    const last = rows.at(-1);
    out.phase = !last ? null
      : last.anomaly >= 0.5 ? 'El Niño' : last.anomaly <= -0.5 ? 'La Niña' : 'Neutral';
    out.strength = !last ? null
      : Math.abs(last.anomaly) >= 2 ? 'very strong'
      : Math.abs(last.anomaly) >= 1.5 ? 'strong'
      : Math.abs(last.anomaly) >= 1 ? 'moderate'
      : Math.abs(last.anomaly) >= 0.5 ? 'weak' : null;
  } catch { out.oni = []; }

  cache = { at: Date.now(), body: out };
  return json(out);
});

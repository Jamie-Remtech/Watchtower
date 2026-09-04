// ============================================================
// Watchtower edge function: tower-sweep — the tower never sleeps.
// Runs on a 5-minute cron for EVERY company, no open app required.
// Watches the safety layer around every anchor (fresh crew positions
// + device fleet): measured radar echoes, rain nowcast, earthquakes,
// wildfires. Raises attention items (same dedupe keys as the in-app
// sweep, so the two cooperate) and pushes critical ones to pockets.
//
// Deploy: Supabase Dashboard → Edge Functions → New function
//   name: tower-sweep → paste this file → Deploy
// Secrets used: VAPID_KEYS_JSON (already set for push-notify)
// Schedule (SQL Editor, after enabling pg_cron + pg_net):
//   see the cron block provided in chat / README.
// ============================================================

import * as webpush from 'jsr:@negrel/webpush';
import UPNG from 'npm:upng-js@2.1.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

const KM = 6371;
const haversine = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * KM * Math.asin(Math.sqrt(s));
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const supaUrl = Deno.env.get('SUPABASE_URL');
    const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const vapidJson = Deno.env.get('VAPID_KEYS_JSON');
    if (!supaUrl || !svc) return json({ error: 'missing env' }, 500);

    const qErrors: string[] = [];
    const q = async (path: string) => {
      const res = await fetch(`${supaUrl}/rest/v1/${path}`, { headers: { apikey: svc, Authorization: `Bearer ${svc}` } });
      const body = await res.json();
      if (!res.ok || !Array.isArray(body)) {
        qErrors.push(`${path.split('?')[0]}: ${res.status} ${JSON.stringify(body).slice(0, 120)}`);
        return [];
      }
      return body;
    };
    const insert = (path: string, body: unknown) =>
      fetch(`${supaUrl}/rest/v1/${path}`, {
        method: 'POST',
        headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(body),
      });

    // ---------- gather platform state ----------
    const freshCut = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const [orgs, profiles, positions, devices, existing, subs] = await Promise.all([
      q('organizations?select=id,name,settings'),
      q('profiles?select=id,display_name,org_id'),
      q(`positions?select=profile_id,org_id,lat,lng,at&at=gte.${freshCut}&order=at.desc&limit=1000`),
      q('devices?select=org_id,lat,lng,name'),
      q('attention_items?select=org_id,dedupe_key&status=neq.resolved'),
      q('push_subscriptions?select=org_id,endpoint,p256dh,auth'),
    ]);
    const nameOf = Object.fromEntries((profiles ?? []).map((p: { id: string; display_name: string }) => [p.id, p.display_name]));
    const liveKeys = new Set((existing ?? []).map((i: { org_id: string; dedupe_key: string }) => `${i.org_id}|${i.dedupe_key}`));
    const hourBucket = new Date().toISOString().slice(0, 13);

    // Anchors per org: fresh crew positions (latest per person) + device fleet centroid
    const anchorsByOrg = new Map<string, Array<{ lat: number; lng: number; label: string }>>();
    const seen = new Set<string>();
    for (const p of positions ?? []) {
      if (!p.org_id || seen.has(p.profile_id)) continue;
      seen.add(p.profile_id);
      const arr = anchorsByOrg.get(p.org_id) ?? [];
      arr.push({ lat: p.lat, lng: p.lng, label: nameOf[p.profile_id] ?? 'crew member' });
      anchorsByOrg.set(p.org_id, arr);
    }
    for (const org of orgs ?? []) {
      const placed = (devices ?? []).filter((d: { org_id: string; lat: number | null }) => d.org_id === org.id && d.lat != null);
      if (placed.length) {
        const arr = anchorsByOrg.get(org.id) ?? [];
        arr.push({
          lat: placed.reduce((a: number, d: { lat: number }) => a + d.lat, 0) / placed.length,
          lng: placed.reduce((a: number, d: { lng: number }) => a + d.lng, 0) / placed.length,
          label: 'device fleet',
        });
        anchorsByOrg.set(org.id, arr);
      }
    }

    // ---------- shared feeds (fetched once for the whole platform) ----------
    let radarMeta: { host: string; frame: { path: string; time: number } } | null = null;
    try {
      const m = await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();
      const frame = m?.radar?.past?.at(-1);
      if (frame) radarMeta = { host: m.host, frame };
    } catch { /* radar down — other checks continue */ }

    let quakes: Array<{ id: string; mag: number; place: string; lat: number; lng: number; tsunami: number; url: string }> = [];
    try {
      const d = await (await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson')).json();
      quakes = (d.features ?? []).map((f: { id: string; properties: { mag: number; place: string; tsunami: number; url: string }; geometry: { coordinates: number[] } }) => ({
        id: f.id, mag: f.properties.mag, place: f.properties.place,
        lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1],
        tsunami: f.properties.tsunami, url: f.properties.url,
      }));
    } catch { /* feed down */ }

    let fires: Array<{ id: string; title: string; lat: number; lng: number }> = [];
    try {
      const d = await (await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=wildfires&limit=500')).json();
      for (const e of d.events ?? []) {
        const g = e.geometry?.at(-1);
        const c = g?.type === 'Point' ? g.coordinates : g?.coordinates?.[0]?.[0];
        if (Array.isArray(c)) fires.push({ id: e.id, title: e.title, lng: c[0], lat: c[1] });
      }
    } catch { /* feed down */ }

    // Radar tile cache: decode each z7 tile once (BW scheme: value=(dBZ+32)*2)
    const tileCache = new Map<string, Uint8Array | null>();
    const radarDbz = async (a: { lat: number; lng: number }) => {
      if (!radarMeta) return null;
      const z = 7, n = 2 ** z;
      const xf = ((a.lng + 180) / 360) * n;
      const latRad = (a.lat * Math.PI) / 180;
      const yf = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
      const tx = Math.floor(xf), ty = Math.floor(yf);
      const key = `${tx},${ty}`;
      let rgba = tileCache.get(key);
      if (rgba === undefined) {
        try {
          const buf = await (await fetch(`${radarMeta.host}${radarMeta.frame.path}/256/${z}/${tx}/${ty}/0/0_0.png`)).arrayBuffer();
          const png = UPNG.decode(buf);
          rgba = new Uint8Array(UPNG.toRGBA8(png)[0]);
        } catch { rgba = null; }
        tileCache.set(key, rgba);
      }
      if (!rgba) return null;
      const px = Math.floor((xf - tx) * 256), py = Math.floor((yf - ty) * 256);
      let maxV = -1;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const X = Math.min(255, Math.max(0, px + dx)), Y = Math.min(255, Math.max(0, py + dy));
          const i = (Y * 256 + X) * 4;
          if (rgba[i + 3] > 0 && rgba[i] > maxV) maxV = rgba[i];
        }
      }
      return maxV >= 0 ? maxV / 2 - 32 : null;
    };

    // ---------- per-org detection ----------
    type Cand = { dedupe_key: string; severity: string; kind: string; title: string; detail: string; source?: unknown };
    let raised = 0, pushed = 0;
    const appServer = vapidJson
      ? await webpush.ApplicationServer.new({
        contactInformation: 'mailto:jamietxtcal@gmail.com',
        vapidKeys: await webpush.importVapidKeys(JSON.parse(vapidJson), { extractable: false }),
      })
      : null;

    for (const org of orgs ?? []) {
      const anchors = (anchorsByOrg.get(org.id) ?? []).slice(0, 12);
      if (!anchors.length) continue;
      const s = org.settings ?? {};
      const FIRE_KM = +s.wildfire_radius_km > 0 ? +s.wildfire_radius_km : 150;
      const HAZ_KM = +s.hazard_radius_km > 0 ? +s.hazard_radius_km : 300;
      const cands: Cand[] = [];

      // 1) measured radar over each anchor
      for (const a of anchors) {
        const dbz = await radarDbz(a);
        if (dbz != null && dbz >= 40) {
          cands.push({
            dedupe_key: `radar-storm:${a.label}:${hourBucket}`, severity: 'critical', kind: 'weather',
            title: `Intense cell over ${a.label} (radar ${Math.round(dbz)} dBZ)`,
            detail: 'Radar measures a strong precipitation cell at this exact position right now — torrential rain, possible hail and lightning. Source: RainViewer radar composite.',
            source: { lat: a.lat, lng: a.lng, dbz: Math.round(dbz) },
          });
        } else if (dbz != null && dbz >= 10) {
          cands.push({
            dedupe_key: `radar-rain:${a.label}:${hourBucket}`, severity: 'critical', kind: 'weather',
            title: `Rain over ${a.label} now (radar)`,
            detail: `Radar shows precipitation at this exact position (${Math.round(dbz)} dBZ). Source: RainViewer radar composite.`,
            source: { lat: a.lat, lng: a.lng, dbz: Math.round(dbz) },
          });
        }
      }

      // 2) rain nowcast (lead time, where the model has skill)
      try {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${anchors.map(a => a.lat.toFixed(3)).join(',')}` +
          `&longitude=${anchors.map(a => a.lng.toFixed(3)).join(',')}&minutely_15=precipitation&forecast_minutely_15=8&timezone=UTC`
        );
        const j = await r.json();
        const rows = Array.isArray(j) ? j : [j];
        for (let i = 0; i < anchors.length; i++) {
          const a = anchors[i];
          const m = rows[i]?.minutely_15;
          if (!m?.time?.length) continue;
          let idx = 0;
          for (let k = 0; k < m.time.length; k++) {
            if (new Date(m.time[k] + 'Z') <= Date.now()) idx = k; else break;
          }
          if (idx > m.time.length - 5) idx = 0;
          const cur = m.precipitation[idx] ?? 0;
          const next = m.precipitation.slice(idx + 1, idx + 5);
          if (cur < 0.1) {
            const onset = next.findIndex((v: number) => v >= 0.2);
            if (onset >= 0) {
              const peak = Math.max(...next.map((v: number) => v ?? 0)) * 4;
              cands.push({
                dedupe_key: `rain:${a.label}:${hourBucket}`,
                severity: peak >= 2 ? 'critical' : 'warning', kind: 'weather',
                title: `Rain reaching ${a.label} in ~${(onset + 1) * 15} min`,
                detail: `Point nowcast at this exact position: up to ${peak.toFixed(1)} mm/h within the hour. Source: Open-Meteo 15-minute model.`,
              });
            }
          }
        }
      } catch { /* nowcast down */ }

      // 3) significant earthquakes near anchors
      for (const qk of quakes) {
        const dist = Math.min(...anchors.map(a => haversine(a, qk)));
        if (dist <= HAZ_KM) {
          cands.push({
            dedupe_key: `quake:${qk.id}`,
            severity: qk.mag >= 6 || qk.tsunami === 1 ? 'critical' : 'warning', kind: 'seismic',
            title: `M${qk.mag} earthquake ${Math.round(dist)} km from your fleet`,
            detail: `${qk.place ?? 'Location unknown'}${qk.tsunami === 1 ? ' — TSUNAMI SIGNAL ISSUED' : ''}. Verify: ${qk.url}`,
          });
        }
      }

      // 4) wildfires near anchors
      for (const f of fires) {
        const dist = Math.min(...anchors.map(a => haversine(a, f)));
        if (dist <= FIRE_KM) {
          cands.push({
            dedupe_key: `eonet:${f.id}`, severity: 'critical', kind: 'hazard',
            title: `Wildfire ${Math.round(dist)} km from your fleet`,
            detail: `${f.title}. Source: NASA EONET.`,
          });
        }
      }

      // ---------- raise + push ----------
      const fresh = cands.filter(c => !liveKeys.has(`${org.id}|${c.dedupe_key}`));
      for (const c of fresh) {
        const res = await insert('attention_items', { org_id: org.id, ...c });
        if (!res.ok) continue;
        raised++;
        liveKeys.add(`${org.id}|${c.dedupe_key}`);
        await insert('events', {
          org_id: org.id, actor_kind: 'system', type: 'attention.raised',
          subject: c.dedupe_key, payload: { severity: c.severity, kind: c.kind, title: c.title, via: 'tower-sweep' },
        });
        if (c.severity === 'critical' && appServer) {
          const orgSubs = (subs ?? []).filter((x: { org_id: string }) => x.org_id === org.id);
          const message = JSON.stringify({ kind: 'attention', title: `⚠ ${c.title}`, body: c.detail.slice(0, 140), url: '/', tag: c.dedupe_key });
          for (const sub of orgSubs) {
            try {
              await appServer.subscribe({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }).pushTextMessage(message, {});
              pushed++;
            } catch (e) {
              if (String(e).includes('410') || String(e).includes('404')) {
                await fetch(`${supaUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, {
                  method: 'DELETE', headers: { apikey: svc, Authorization: `Bearer ${svc}` },
                });
              }
            }
          }
        }
      }
    }

    return json({
      ok: qErrors.length === 0,
      orgs: (orgs ?? []).length,
      anchored_orgs: anchorsByOrg.size,
      raised,
      pushed,
      ...(qErrors.length ? { query_errors: qErrors } : {}),
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

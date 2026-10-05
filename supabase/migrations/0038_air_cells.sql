-- ============================================================
-- Watchtower migration 0038: shared aircraft cell cache
-- The world is divided into fixed cells (5° of latitude). The air-cells
-- edge function (pg_cron, every 15 s) refreshes the cells people are
-- looking at from the public ADS-B network at a polite 1 request/second —
-- the networks refuse request bursts — and every user and every map view
-- reads from here. Cells someone is zoomed into ("fine") refresh every
-- ~15 s, cells only seen in wide views every ~60 s.
-- Replaces the OpenSky snapshot (0037): OpenSky blocks cloud servers and
-- does not allow browsers from other sites.
-- Service role only (no client policies).
-- ============================================================

create table if not exists public.air_cells (
  key           text primary key,
  lat           double precision not null,
  lng           double precision not null,
  at            timestamptz,
  ac            jsonb,                 -- compact rows: [hex, callsign, reg, type, lat, lng, alt_m, heading, kmh, kind, operator]
  wanted_at     timestamptz,
  want_fine_at  timestamptz,
  last_error    text
);
create index if not exists air_cells_wanted_idx on public.air_cells (wanted_at desc);
alter table public.air_cells enable row level security;

drop table if exists public.air_snapshot;

-- refresh every 15 s (the function itself paces its requests)
-- select cron.schedule('air-cells', '15 seconds', $$ select net.http_post(
--   url := 'https://lamezbfkdnzztpmwimoz.supabase.co/functions/v1/air-cells',
--   headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <public anon key>'),
--   body := '{}'::jsonb, timeout_milliseconds := 20000) $$);

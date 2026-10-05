-- ============================================================
-- Watchtower migration 0037: one shared wide-area aircraft snapshot
-- Wide map views (a region to a continent) are served from a single
-- snapshot of every aircraft in the world (OpenSky Network), refreshed by
-- air-public at most every 90 s with an OpenSky account (secrets
-- OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET), every 15 min without — the
-- free allowance is per server, so it is shared by every user and view.
-- Service role only (no client policies).
-- ============================================================

create table if not exists public.air_snapshot (
  id           smallint primary key default 1 check (id = 1),
  at           timestamptz,
  source       text,
  states       jsonb,
  fetching_at  timestamptz,
  last_error   text
);
insert into public.air_snapshot (id) values (1) on conflict (id) do nothing;
alter table public.air_snapshot enable row level security;

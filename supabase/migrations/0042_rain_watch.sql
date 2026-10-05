-- ============================================================
-- Watchtower migration 0042: rain_watch — rain over each person, sweep to sweep
-- tower-sweep records the last time radar measured rain over each person.
-- "Rain is starting over you" is pushed when rain appears after at least
-- 40 dry minutes — every shower, not once per hour. Server-only (no client
-- policies; the service role bypasses RLS).
-- ============================================================

create table if not exists public.rain_watch (
  profile_id    uuid primary key references public.profiles (id) on delete cascade,
  org_id        uuid not null,
  wet_since     timestamptz,
  last_wet_at   timestamptz,
  last_push_at  timestamptz,
  last_dbz      int
);
alter table public.rain_watch enable row level security;

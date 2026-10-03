-- ============================================================
-- 0028: heartbeats — the tower must never fail silently again
-- tower-sweep stamps its row every run. tower-watchdog (pg_cron, every
-- 10 min) pushes platform staff when it is stale; the app shows staff a
-- banner. Everyone signed in may read it (a "tower is watching" signal).
-- ============================================================
create table if not exists public.system_heartbeats (
  name    text primary key,
  at      timestamptz not null default now(),
  ok      boolean not null default true,
  detail  jsonb not null default '{}',
  alerted_at timestamptz
);
alter table public.system_heartbeats enable row level security;
create policy system_heartbeats_read on public.system_heartbeats for select to authenticated using (true);

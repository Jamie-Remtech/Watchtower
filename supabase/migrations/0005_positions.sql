-- ============================================================
-- Watchtower migration 0005: live positions
-- Field collaborators share their position; the tactical map shows
-- the latest fix per person and history accumulates for pattern
-- analysis and action reconstruction.
-- Run in the Supabase SQL Editor after 0004.
-- ============================================================

create table public.positions (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  accuracy    double precision,
  heading     double precision,
  speed       double precision,
  at          timestamptz not null default now()
);

create index positions_org_profile_at_idx on public.positions (org_id, profile_id, at desc);
create index positions_org_at_idx on public.positions (org_id, at desc);

alter table public.positions enable row level security;

-- Org members see the team's positions; you can only write your own
create policy positions_read on public.positions
  for select using (org_id = public.current_org_id());
create policy positions_insert on public.positions
  for insert with check (profile_id = auth.uid() and org_id = public.current_org_id());

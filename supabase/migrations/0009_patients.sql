-- ============================================================
-- Watchtower migration 0009: patients (multi-casualty field log)
-- Each casualty is a patient row with a SALT triage color; every
-- action spoken by a responder becomes a timestamped event bound
-- to the active patient. Realtime keeps the triage board live.
-- Run in the Supabase SQL Editor after 0008.
-- ============================================================

create table public.patients (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  num         integer not null,                 -- spoken identity: "patient two"
  tag         text,                             -- physical triage tag number, if used
  triage      text not null default 'unknown',  -- red | yellow | green | gray | black | unknown
  status      text not null default 'active',   -- active | transported | handed_off | deceased
  lat         double precision,
  lng         double precision,
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index patients_org_idx on public.patients (org_id, created_at desc);

alter table public.patients enable row level security;

create policy patients_read on public.patients
  for select using (org_id = public.current_org_id());
create policy patients_insert on public.patients
  for insert with check (
    org_id = public.current_org_id()
    and created_by = auth.uid()
    and public.current_role_at_least('field')
  );
create policy patients_update on public.patients
  for update using (
    org_id = public.current_org_id()
    and public.current_role_at_least('field')
  );

alter publication supabase_realtime add table public.patients;

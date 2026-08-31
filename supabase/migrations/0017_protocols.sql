-- ============================================================
-- 0017: protocols & runs — playbooks the team executes together
--
-- protocols: the org's library of response playbooks (steps jsonb).
-- protocol_runs: a live execution — snapshot of the steps with
-- done/by/at per step, checked off in realtime by the whole team,
-- ended with an AI after-action debrief. Every run is a recorded
-- pattern the org learns from.
-- ============================================================

create table public.protocols (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  name          text not null,
  trigger_kind  text not null default 'custom',   -- wildfire | seismic | weather | medical | custom
  description   text,
  steps         jsonb not null default '[]'::jsonb, -- [{id, text}]
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.protocol_runs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  protocol_id   uuid references public.protocols (id) on delete set null,
  name          text not null,                      -- snapshot of the protocol name
  steps         jsonb not null default '[]'::jsonb, -- [{id, text, done, by, by_name, at}]
  context       jsonb not null default '{}'::jsonb, -- linked attention item, notes
  status        text not null default 'active',     -- active | completed | aborted
  started_by    uuid references public.profiles (id) on delete set null,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  debrief       text                                 -- AI after-action summary
);

create index protocols_org_idx     on public.protocols (org_id, updated_at desc);
create index protocol_runs_org_idx on public.protocol_runs (org_id, started_at desc);

alter table public.protocols     enable row level security;
alter table public.protocol_runs enable row level security;

-- Library: every operational member reads; coordinators+ manage
create policy protocols_read on public.protocols
  for select using (org_id = public.current_org_id());
create policy protocols_insert on public.protocols
  for insert with check (org_id = public.current_org_id() and public.current_role_at_least('coordinator'));
create policy protocols_update on public.protocols
  for update using (org_id = public.current_org_id() and public.current_role_at_least('coordinator'));
create policy protocols_delete on public.protocols
  for delete using (org_id = public.current_org_id() and public.current_role_at_least('coordinator'));

-- Runs: field+ start them and check steps off (the crew executes)
create policy protocol_runs_read on public.protocol_runs
  for select using (org_id = public.current_org_id());
create policy protocol_runs_insert on public.protocol_runs
  for insert with check (org_id = public.current_org_id() and public.current_role_at_least('field'));
create policy protocol_runs_update on public.protocol_runs
  for update using (org_id = public.current_org_id() and public.current_role_at_least('field'));

-- Live sync: step checks appear on every screen instantly
alter publication supabase_realtime add table public.protocol_runs;

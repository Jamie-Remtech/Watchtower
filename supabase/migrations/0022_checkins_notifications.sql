-- ============================================================
-- 0022: personnel accountability (check-in / PAR) + per-user
-- notification preferences
--
-- checkins: one PAR request ("everyone, are you OK?"), optionally
-- scoped to a team. checkin_responses: one row per member who
-- answered (ok | help) with where they were. Who may request is an
-- org setting (settings.par_request_min_role, default coordinator);
-- silence thresholds and auto-escalation are org settings read by
-- the client board and the tower-sweep.
--
-- profiles.notification_prefs: categories on/off, minimum severity
-- to push, sound choice. Life-safety criticals and check-ins are
-- never dropped by preferences — only made quieter.
-- ============================================================

alter table public.profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

create table public.checkins (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  team_id       uuid references public.teams (id) on delete set null,
  requested_by  uuid references public.profiles (id) on delete set null,
  message       text,
  source        text not null default 'manual',      -- manual | auto (tower) | protocol
  status        text not null default 'open',        -- open | closed
  created_at    timestamptz not null default now(),
  closed_at     timestamptz
);

create table public.checkin_responses (
  checkin_id    uuid not null references public.checkins (id) on delete cascade,
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  org_id        uuid not null references public.organizations (id) on delete cascade,
  status        text not null,                       -- ok | help
  note          text,
  lat           double precision,
  lng           double precision,
  at            timestamptz not null default now(),
  primary key (checkin_id, profile_id)
);

create index checkins_org_idx on public.checkins (org_id, created_at desc);

alter table public.checkins          enable row level security;
alter table public.checkin_responses enable row level security;

-- The rank allowed to request a check-in is an org setting
create or replace function public.can_request_checkin()
returns boolean language sql stable security definer set search_path = public as
$$
  select public.current_role_at_least(
    coalesce(
      (select (settings ->> 'par_request_min_role') from public.organizations where id = public.current_org_id()),
      'coordinator'
    )::public.watchtower_role
  )
$$;

create policy checkins_read on public.checkins
  for select using (org_id = public.current_org_id() or public.is_platform_staff());
create policy checkins_insert on public.checkins
  for insert with check (org_id = public.current_org_id() and public.can_request_checkin());
create policy checkins_update on public.checkins
  for update using (
    org_id = public.current_org_id()
    and (requested_by = auth.uid() or public.current_role_at_least('coordinator'))
  );

create policy checkin_responses_read on public.checkin_responses
  for select using (org_id = public.current_org_id() or public.is_platform_staff());
create policy checkin_responses_insert on public.checkin_responses
  for insert with check (org_id = public.current_org_id() and profile_id = auth.uid());
create policy checkin_responses_update on public.checkin_responses
  for update using (org_id = public.current_org_id() and profile_id = auth.uid());

alter publication supabase_realtime add table public.checkins;
alter publication supabase_realtime add table public.checkin_responses;

-- ============================================================
-- 0018: the platform layer — companies, teams, links, invoices
--
-- Companies are organizations: fully isolated by the existing RLS.
-- This adds the layer above them:
--  - platform_owner: the app creator, above every company
--  - create_company / assign_member: mint companies, move people
--  - teams: sub-groups inside a company for parallel operations
--  - org_links: registry of company-to-company mutual-aid links
--  - invoices: platform owner bills companies; admins see their own
-- ============================================================

-- ---------- platform owner ----------
alter table public.profiles add column if not exists platform_owner boolean not null default false;
alter table public.profiles add column if not exists team_id uuid;

update public.profiles set platform_owner = true where email = 'jlapierre@txt1.ca';

create or replace function public.is_platform_owner()
returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select platform_owner from public.profiles where id = auth.uid()), false) $$;

-- Platform owner sees and manages every company, invitation, profile
create policy organizations_owner_all on public.organizations
  for all using (public.is_platform_owner()) with check (public.is_platform_owner());
create policy profiles_owner_read on public.profiles
  for select using (public.is_platform_owner());
create policy invitations_owner_all on public.invitations
  for all using (public.is_platform_owner()) with check (public.is_platform_owner());

-- ---------- teams (inside a company) ----------
create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null,
  color       text,
  created_at  timestamptz not null default now()
);
alter table public.teams enable row level security;
create policy teams_read on public.teams
  for select using (org_id = public.current_org_id() or public.is_platform_owner());
create policy teams_manage on public.teams
  for all using (
    (org_id = public.current_org_id() and public.current_role_at_least('coordinator'))
    or public.is_platform_owner()
  ) with check (
    (org_id = public.current_org_id() and public.current_role_at_least('coordinator'))
    or public.is_platform_owner()
  );

alter table public.profiles
  add constraint profiles_team_fk foreign key (team_id) references public.teams (id) on delete set null;

-- ---------- company-to-company links (registry; data sharing later) ----------
create table public.org_links (
  id          uuid primary key default gen_random_uuid(),
  org_a       uuid not null references public.organizations (id) on delete cascade,
  org_b       uuid not null references public.organizations (id) on delete cascade,
  status      text not null default 'active',   -- active | suspended
  note        text,
  created_at  timestamptz not null default now()
);
alter table public.org_links enable row level security;
create policy org_links_read on public.org_links
  for select using (org_a = public.current_org_id() or org_b = public.current_org_id() or public.is_platform_owner());
create policy org_links_owner_all on public.org_links
  for all using (public.is_platform_owner()) with check (public.is_platform_owner());

-- ---------- invoices ----------
create table public.invoices (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  label        text not null,                     -- e.g. 'September 2026'
  amount_cents integer not null default 0,
  currency     text not null default 'CAD',
  status       text not null default 'draft',     -- draft | sent | paid | void
  notes        text,
  due_at       date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.invoices enable row level security;
create policy invoices_owner_all on public.invoices
  for all using (public.is_platform_owner()) with check (public.is_platform_owner());
create policy invoices_org_read on public.invoices
  for select using (org_id = public.current_org_id() and public.current_role_at_least('admin'));

-- ---------- platform functions ----------
create or replace function public.create_company(company_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_platform_owner() then raise exception 'platform owner only'; end if;
  insert into public.organizations (name) values (company_name) returning id into new_id;
  return new_id;
end; $$;

create or replace function public.assign_member(target uuid, new_org uuid, new_role public.watchtower_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_owner() then raise exception 'platform owner only'; end if;
  update public.profiles
    set org_id = new_org, role = new_role, team_id = null, updated_at = now()
    where id = target;
end; $$;

-- Coordinators assign members of their own org to teams
create or replace function public.set_member_team(target uuid, new_team uuid)
returns void language plpgsql security definer set search_path = public as $$
declare caller_role public.watchtower_role; caller_org uuid; target_org uuid; team_org uuid;
begin
  select role, org_id into caller_role, caller_org from public.profiles where id = auth.uid();
  select org_id into target_org from public.profiles where id = target;
  if caller_org is null or target_org is null or caller_org <> target_org then
    raise exception 'not in your organization';
  end if;
  if caller_role not in ('coordinator', 'admin') then
    raise exception 'coordinators and admins assign teams';
  end if;
  if new_team is not null then
    select org_id into team_org from public.teams where id = new_team;
    if team_org is null or team_org <> caller_org then raise exception 'team not in your organization'; end if;
  end if;
  update public.profiles set team_id = new_team, updated_at = now() where id = target;
end; $$;

grant execute on function public.create_company(text) to authenticated;
grant execute on function public.assign_member(uuid, uuid, public.watchtower_role) to authenticated;
grant execute on function public.set_member_team(uuid, uuid) to authenticated;

-- ---------- guard trigger: let the platform owner cross the walls ----------
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller public.watchtower_role;
begin
  if new.role is distinct from old.role or new.org_id is distinct from old.org_id
     or new.platform_owner is distinct from old.platform_owner then
    if public.is_platform_owner() then
      return new;  -- the platform owner manages companies and membership
    end if;
    if new.platform_owner is distinct from old.platform_owner then
      raise exception 'platform ownership cannot be changed';
    end if;
    select role into caller from public.profiles where id = auth.uid();
    if caller = 'admin' and new.org_id is not distinct from old.org_id then
      return new;  -- admins manage roles inside their company
    elsif caller = 'coordinator'
      and new.role = 'viewer'
      and old.role in ('viewer','field','operator')
      and new.org_id is not distinct from old.org_id then
      return new;  -- coordinators may stand their field ranks down
    end if;
    raise exception 'you cannot change roles or organization';
  end if;
  return new;
end;
$$;

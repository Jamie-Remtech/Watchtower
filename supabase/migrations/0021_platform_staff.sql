-- ============================================================
-- 0021: system admins vs company admins
--
-- platform_role on profiles: 'owner' (the creator — exactly one,
-- and the only rank that can appoint platform staff) and 'staff'
-- (system admins: see and manage every customer platform).
-- Company admins are the existing per-org 'admin' role, scoped to
-- their own company. Rebecca becomes platform staff + HQ admin.
-- ============================================================

alter table public.profiles add column if not exists platform_role text;

-- Backfill: the boolean owner flag becomes platform_role 'owner';
-- Rebecca is appointed staff (and company admin of HQ).
alter table public.profiles disable trigger profiles_guard;
update public.profiles set platform_role = 'owner' where platform_owner = true;
update public.profiles set platform_role = 'staff', role = 'admin'
  where lower(email) = 'rebecca.lapierre@icloud.com';
alter table public.profiles enable trigger profiles_guard;

create or replace function public.is_platform_owner()
returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select platform_role from public.profiles where id = auth.uid()) = 'owner', false) $$;

create or replace function public.is_platform_staff()
returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select platform_role from public.profiles where id = auth.uid()) in ('owner','staff'), false) $$;

grant execute on function public.is_platform_staff() to authenticated;

-- Platform-wide visibility & management now covers staff
drop policy if exists organizations_owner_all on public.organizations;
create policy organizations_owner_all on public.organizations
  for all using (public.is_platform_staff()) with check (public.is_platform_staff());

drop policy if exists profiles_owner_read on public.profiles;
create policy profiles_owner_read on public.profiles
  for select using (public.is_platform_staff());

drop policy if exists invitations_owner_all on public.invitations;
create policy invitations_owner_all on public.invitations
  for all using (public.is_platform_staff()) with check (public.is_platform_staff());

drop policy if exists invoices_owner_all on public.invoices;
create policy invoices_owner_all on public.invoices
  for all using (public.is_platform_staff()) with check (public.is_platform_staff());

drop policy if exists org_links_owner_all on public.org_links;
create policy org_links_owner_all on public.org_links
  for all using (public.is_platform_staff()) with check (public.is_platform_staff());

drop policy if exists org_links_read on public.org_links;
create policy org_links_read on public.org_links
  for select using (org_a = public.current_org_id() or org_b = public.current_org_id() or public.is_platform_staff());

drop policy if exists teams_read on public.teams;
create policy teams_read on public.teams
  for select using (org_id = public.current_org_id() or public.is_platform_staff());
drop policy if exists teams_manage on public.teams;
create policy teams_manage on public.teams
  for all using (
    (org_id = public.current_org_id() and public.current_role_at_least('coordinator'))
    or public.is_platform_staff()
  ) with check (
    (org_id = public.current_org_id() and public.current_role_at_least('coordinator'))
    or public.is_platform_staff()
  );

-- Platform functions: staff may mint companies and move members
create or replace function public.create_company(company_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_platform_staff() then raise exception 'platform staff only'; end if;
  insert into public.organizations (name) values (company_name) returning id into new_id;
  return new_id;
end; $$;

create or replace function public.assign_member(target uuid, new_org uuid, new_role public.watchtower_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_staff() then raise exception 'platform staff only'; end if;
  if (select platform_role from public.profiles where id = target) is not null
     and not public.is_platform_owner() then
    raise exception 'only the platform owner moves platform staff';
  end if;
  update public.profiles
    set org_id = new_org, role = new_role, team_id = null, updated_at = now()
    where id = target;
end; $$;

-- Guard: staff manage membership; ONLY the owner touches platform roles
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller public.watchtower_role;
begin
  if auth.uid() is null then
    return new;  -- direct database / service-role context (migrations, server jobs)
  end if;
  if new.platform_role is distinct from old.platform_role
     or new.platform_owner is distinct from old.platform_owner then
    if public.is_platform_owner() then return new; end if;
    raise exception 'platform roles are managed by the platform owner';
  end if;
  if new.role is distinct from old.role or new.org_id is distinct from old.org_id then
    if public.is_platform_staff() then return new; end if;
    select role into caller from public.profiles where id = auth.uid();
    if caller = 'admin' and new.org_id is not distinct from old.org_id then
      return new;
    elsif caller = 'coordinator'
      and new.role = 'viewer'
      and old.role in ('viewer','field','operator')
      and new.org_id is not distinct from old.org_id then
      return new;
    end if;
    raise exception 'you cannot change roles or organization';
  end if;
  return new;
end;
$$;

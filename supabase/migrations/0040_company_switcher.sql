-- ============================================================
-- Watchtower migration 0040: company switcher for platform staff
-- The platform owner and system admins can VIEW another company as its
-- admin sees it. "My company" (current_org_id) becomes the company being
-- viewed; every read rule follows automatically. Unchanged while viewing:
--   - membership: the profile stays in its own company (home_org_id)
--   - own position and push registrations stay in the home company
--   - patient medical files: only the company's own crew (never viewers
--     from the platform, even while switched in)
-- Every switch is written to both companies' activity log.
-- ============================================================

alter table public.profiles add column if not exists acting_org_id uuid references public.organizations (id) on delete set null;

create or replace function public.home_org_id()
returns uuid language sql stable security definer set search_path = public as
$$ select org_id from public.profiles where id = auth.uid() $$;
grant execute on function public.home_org_id() to authenticated;

-- the company the caller is working in: the viewed one for platform staff
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as
$$
  select case
           when p.acting_org_id is not null and p.platform_role in ('owner', 'staff') then p.acting_org_id
           else p.org_id
         end
    from public.profiles p where p.id = auth.uid()
$$;

-- own position and push registrations always belong to the home company
drop policy if exists positions_insert on public.positions;
create policy positions_insert on public.positions
  for insert with check (profile_id = auth.uid() and org_id = public.home_org_id());
drop policy if exists push_subs_own_insert on public.push_subscriptions;
create policy push_subs_own_insert on public.push_subscriptions
  for insert with check (profile_id = auth.uid() and org_id = public.home_org_id());

-- patient files: own company's crew only — not visible to someone switched in
create or replace function public.can_see_patient_record(p_org uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select p_org = public.current_org_id() and p_org = public.home_org_id() and public.current_role_at_least('field') $$;

-- only staff may set acting_org_id (and only through switch_company)
create or replace function public.guard_acting_org()
returns trigger language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null then return new; end if;
  if new.acting_org_id is distinct from old.acting_org_id
     and coalesce(current_setting('watchtower.switching', true), '') <> 'on' then
    raise exception 'use switch_company()';
  end if;
  return new;
end
$$;
drop trigger if exists profiles_guard_acting on public.profiles;
create trigger profiles_guard_acting before update on public.profiles
  for each row execute function public.guard_acting_org();

create or replace function public.switch_company(p_org uuid)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  me public.profiles;
  target uuid;
  tname text;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or coalesce(me.platform_role, '') not in ('owner', 'staff') then
    raise exception 'platform owner or system admins only';
  end if;
  target := case when p_org is null or p_org = me.org_id then null else p_org end;
  if target is not null then
    select name into tname from public.organizations where id = target;
    if tname is null then raise exception 'company not found'; end if;
  end if;
  perform set_config('watchtower.switching', 'on', true);
  update public.profiles set acting_org_id = target where id = me.id;
  -- transparency: both companies see who came in and left
  if me.acting_org_id is not null and me.acting_org_id is distinct from target then
    insert into public.events (org_id, actor_id, actor_kind, type, payload)
    values (me.acting_org_id, me.id, 'user', 'platform.view_left', jsonb_build_object('who', me.display_name, 'role', me.platform_role));
  end if;
  if target is not null then
    insert into public.events (org_id, actor_id, actor_kind, type, payload)
    values (target, me.id, 'user', 'platform.view_entered', jsonb_build_object('who', me.display_name, 'role', me.platform_role));
  end if;
  insert into public.events (org_id, actor_id, actor_kind, type, payload)
  values (me.org_id, me.id, 'user', 'platform.switch', jsonb_build_object('to', coalesce(tname, 'home')));
  return jsonb_build_object('acting_org_id', target, 'name', tname);
end
$$;
grant execute on function public.switch_company(uuid) to authenticated;

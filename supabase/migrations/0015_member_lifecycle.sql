-- ============================================================
-- Watchtower migration 0015: member lifecycle
-- Coordinators can stand down (drop to viewer) their field ranks
-- when an emergency ends or a team changes; admins can drop anyone
-- but other admins. Enforced server-side, rank-checked.
-- Run in the Supabase SQL Editor after 0014.
-- ============================================================

create or replace function public.drop_member(target uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  caller_role public.watchtower_role;
  caller_org  uuid;
  target_role public.watchtower_role;
  target_org  uuid;
begin
  select role, org_id into caller_role, caller_org from public.profiles where id = auth.uid();
  select role, org_id into target_role, target_org from public.profiles where id = target;

  if caller_org is null or target_org is null or caller_org <> target_org then
    raise exception 'not in your organization';
  end if;
  if target = auth.uid() then
    raise exception 'you cannot drop yourself';
  end if;

  if caller_role = 'admin' then
    if target_role = 'admin' then
      raise exception 'admins cannot drop other admins';
    end if;
  elsif caller_role = 'coordinator' then
    if target_role not in ('viewer', 'field', 'operator') then
      raise exception 'coordinators can only drop operator, field, or viewer members';
    end if;
  else
    raise exception 'insufficient rank';
  end if;

  update public.profiles set role = 'viewer', updated_at = now() where id = target;
end;
$$;

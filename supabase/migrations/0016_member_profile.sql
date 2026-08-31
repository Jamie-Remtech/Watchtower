-- ============================================================
-- 0016: editable member profiles + role-change guard
--
-- 1. Real contact/radio fields on profiles (the member modal
--    was mock-era display only).
-- 2. SECURITY FIX: profiles_self_update allowed a member to
--    update their OWN row — including their role. This trigger
--    locks role/org changes to the rank ladder while leaving
--    contact fields freely editable.
-- ============================================================

alter table public.profiles
  add column if not exists mobile text,
  add column if not exists emergency_phone text,
  add column if not exists emergency_contact text,
  add column if not exists frequency text;

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller public.watchtower_role;
begin
  if new.role is distinct from old.role or new.org_id is distinct from old.org_id then
    select role into caller from public.profiles where id = auth.uid();
    if caller = 'admin' and new.org_id is not distinct from old.org_id then
      return new;  -- admins manage roles (org moves stay locked)
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

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_update();

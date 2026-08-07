-- ============================================================
-- Watchtower migration 0002: store email on profiles
-- The Team surface shows member emails; auth.users isn't readable
-- from the client, so we mirror the email onto the profile row.
-- Run in the Supabase SQL Editor after 0001_init.sql.
-- ============================================================

alter table public.profiles add column if not exists email text;

-- Backfill existing profiles from auth.users
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- Keep new signups populated
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  inv public.invitations%rowtype;
begin
  select * into inv
  from public.invitations
  where code = coalesce(new.raw_user_meta_data ->> 'invite_code', '')
    and status = 'pending'
    and expires_at > now()
    and (email is null or lower(email) = lower(new.email))
  limit 1;

  insert into public.profiles (id, org_id, display_name, role, email)
  values (
    new.id,
    inv.org_id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(inv.role, 'viewer'),
    new.email
  );

  if inv.id is not null then
    update public.invitations
      set status = 'accepted', accepted_by = new.id
      where id = inv.id;
    insert into public.events (org_id, actor_id, actor_kind, type, payload)
      values (inv.org_id, new.id, 'system', 'user.joined',
              jsonb_build_object('via', 'invitation', 'role', inv.role));
  end if;

  return new;
end;
$$;

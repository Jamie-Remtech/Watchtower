-- ============================================================
-- Watchtower schema v1
-- Organizations, profiles/roles, invitation onboarding, and the
-- append-only events log (the pattern-recording backbone).
-- Apply in the Supabase SQL editor or with `supabase db push`.
-- ============================================================

-- Role ladder (mirror of src/auth/roles.js)
create type public.watchtower_role as enum ('viewer', 'field', 'operator', 'coordinator', 'admin');

-- ---------- Organizations ----------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  region      text,
  tier        text not null default 'standard',
  created_at  timestamptz not null default now()
);

-- ---------- Profiles ----------
-- One row per auth user; created automatically by trigger on signup.
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  org_id        uuid references public.organizations (id) on delete set null,
  display_name  text not null default '',
  callsign      text,
  role          public.watchtower_role not null default 'viewer',
  phone         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- Invitations ----------
-- Admin/coordinator creates an invitation; the code is given to the person.
-- Signup with the code binds the new user to the org with the invited role.
create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  code        text not null unique default encode(gen_random_bytes(6), 'hex'),
  email       text,                                   -- optional: restrict to an address
  role        public.watchtower_role not null default 'field',
  invited_by  uuid references public.profiles (id),
  status      text not null default 'pending',        -- pending | accepted | revoked | expired
  expires_at  timestamptz not null default now() + interval '14 days',
  created_at  timestamptz not null default now(),
  accepted_by uuid references public.profiles (id)
);

-- ---------- Events ----------
-- Append-only operational log. Everything notable that happens in Watchtower
-- is an event: detections, acknowledgements, position updates, protocol steps,
-- predictions, attention items. Patterns are mined from this table; the AI
-- coordinator learns from it. Never update or delete rows.
create table public.events (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  at          timestamptz not null default now(),
  actor_id    uuid references public.profiles (id),   -- null = system/AI
  actor_kind  text not null default 'user',           -- user | system | ai | device
  type        text not null,                          -- e.g. 'detection.fire', 'alert.acknowledged', 'position.update', 'protocol.step'
  subject     text,                                   -- device/stream/operation the event is about
  payload     jsonb not null default '{}'::jsonb
);

create index events_org_at_idx   on public.events (org_id, at desc);
create index events_org_type_idx on public.events (org_id, type, at desc);

-- ============================================================
-- Signup trigger: create a profile; if an invite code is present
-- in user metadata, attach the user to the org with the invited role.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  inv public.invitations%rowtype;
begin
  -- Try to redeem an invitation code from signup metadata
  select * into inv
  from public.invitations
  where code = coalesce(new.raw_user_meta_data ->> 'invite_code', '')
    and status = 'pending'
    and expires_at > now()
    and (email is null or lower(email) = lower(new.email))
  limit 1;

  insert into public.profiles (id, org_id, display_name, role)
  values (
    new.id,
    inv.org_id,                                        -- null when no valid invite
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(inv.role, 'viewer')
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.organizations enable row level security;
alter table public.profiles      enable row level security;
alter table public.invitations   enable row level security;
alter table public.events        enable row level security;

-- Helpers
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as
$$ select org_id from public.profiles where id = auth.uid() $$;

create or replace function public.current_role_at_least(required public.watchtower_role)
returns boolean language sql stable security definer set search_path = public as
$$
  select case (select role from public.profiles where id = auth.uid())
    when 'admin'       then required in ('viewer','field','operator','coordinator','admin')
    when 'coordinator' then required in ('viewer','field','operator','coordinator')
    when 'operator'    then required in ('viewer','field','operator')
    when 'field'       then required in ('viewer','field')
    when 'viewer'      then required in ('viewer')
    else false
  end
$$;

-- Organizations: members can read their own org; admins can update it
create policy org_read on public.organizations
  for select using (id = public.current_org_id());
create policy org_update on public.organizations
  for update using (id = public.current_org_id() and public.current_role_at_least('admin'));

-- Profiles: members see org colleagues; users update themselves; admins update anyone in org
create policy profiles_read on public.profiles
  for select using (org_id = public.current_org_id() or id = auth.uid());
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid());
create policy profiles_admin_update on public.profiles
  for update using (org_id = public.current_org_id() and public.current_role_at_least('admin'));

-- Invitations: coordinators+ manage them within their org
create policy invitations_read on public.invitations
  for select using (org_id = public.current_org_id() and public.current_role_at_least('coordinator'));
create policy invitations_insert on public.invitations
  for insert with check (org_id = public.current_org_id() and public.current_role_at_least('coordinator'));
create policy invitations_update on public.invitations
  for update using (org_id = public.current_org_id() and public.current_role_at_least('coordinator'));

-- Events: org members read; any member may append; nobody updates/deletes (append-only)
create policy events_read on public.events
  for select using (org_id = public.current_org_id());
create policy events_insert on public.events
  for insert with check (org_id = public.current_org_id());

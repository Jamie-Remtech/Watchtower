-- ============================================================
-- Watchtower migration 0033: comms platform
-- Channels inside a company, an external contacts directory, emergency
-- broadcasts with acknowledgements, and CONNECTORS: each company plugs
-- its own systems in (SMS/WhatsApp via Twilio, email, Slack, Teams,
-- Discord, Google Chat, Telegram, PagerDuty, generic webhooks in and
-- out, CAP feed). Secrets are write-only from the app: stored in
-- connector_secrets, which no client can read — only the comms edge
-- functions (service role) use them.
-- ============================================================

-- ---------- channels ----------
create table if not exists public.channels (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  name         text not null,
  description  text,
  color        text not null default '#f97316',
  min_role     public.watchtower_role not null default 'field',
  sort         integer not null default 0,
  archived     boolean not null default false,
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists channels_org_idx on public.channels (org_id, sort);
alter table public.channels enable row level security;

create or replace function public.can_read_channel(p_channel uuid)
returns boolean language sql stable security definer set search_path = public as
$$
  select p_channel is null
      or exists (select 1 from public.channels c
                 where c.id = p_channel and c.org_id = public.current_org_id()
                   and public.current_role_at_least(c.min_role))
$$;
grant execute on function public.can_read_channel(uuid) to authenticated;

drop policy if exists channels_read on public.channels;
create policy channels_read on public.channels
  for select using (org_id = public.current_org_id() and public.current_role_at_least(min_role));
drop policy if exists channels_manage on public.channels;
create policy channels_manage on public.channels
  for all using (org_id = public.current_org_id() and public.current_role_at_least('coordinator'))
  with check (org_id = public.current_org_id() and public.current_role_at_least('coordinator'));

-- ---------- messages: channels, external sources, broadcasts ----------
alter table public.messages add column if not exists channel_id uuid references public.channels (id) on delete set null;
alter table public.messages add column if not exists source text not null default 'app';   -- app | sms | whatsapp | email | telegram | webhook | radio | broadcast
alter table public.messages add column if not exists external_from text;                   -- who wrote it outside the app
alter table public.messages add column if not exists contact_id uuid;
alter table public.messages add column if not exists connector_id uuid;
alter table public.messages add column if not exists broadcast_id uuid;
alter table public.messages add column if not exists meta jsonb;
create index if not exists messages_channel_idx on public.messages (org_id, channel_id, at desc);

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages
  for select using (org_id = public.current_org_id() and public.can_read_channel(channel_id));
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert with check (
    org_id = public.current_org_id()
    and sender = auth.uid()
    and public.current_role_at_least('field')
    and public.can_read_channel(channel_id)
    and source in ('app', 'broadcast')
  );

-- ---------- contacts (people and agencies outside the app) ----------
create table if not exists public.contacts (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  name         text not null,
  agency       text,
  role         text,
  phone        text,
  email        text,
  whatsapp     text,
  telegram     text,
  radio        text,
  notes        text,
  groups       text[] not null default '{}',
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists contacts_org_idx on public.contacts (org_id, name);
create index if not exists contacts_groups_idx on public.contacts using gin (groups);
alter table public.contacts enable row level security;
drop policy if exists contacts_read on public.contacts;
create policy contacts_read on public.contacts
  for select using (org_id = public.current_org_id() and public.current_role_at_least('field'));
drop policy if exists contacts_manage on public.contacts;
create policy contacts_manage on public.contacts
  for all using (org_id = public.current_org_id() and public.current_role_at_least('coordinator'))
  with check (org_id = public.current_org_id() and public.current_role_at_least('coordinator'));

-- ---------- connectors ----------
create table if not exists public.connectors (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations (id) on delete cascade,
  kind              text not null,       -- twilio_sms | twilio_whatsapp | resend | sendgrid | slack | teams | discord | google_chat | telegram | pagerduty | webhook | cap
  name              text not null,
  enabled           boolean not null default true,
  config            jsonb not null default '{}'::jsonb,   -- non-secret settings (from number, chat id, recipients…)
  routes            jsonb not null default '{}'::jsonb,   -- what it sends: {broadcasts, channels:[id|'*'], alerts:['critical','warning']}
  inbound_enabled   boolean not null default false,
  inbound_channel   uuid references public.channels (id) on delete set null,
  inbound_key_hash  text unique,                          -- sha256 of the inbound key (shown once)
  inbound_key_hint  text,
  secret_set        boolean not null default false,
  secret_hint       text,
  last_ok_at        timestamptz,
  last_error        text,
  last_error_at     timestamptz,
  created_by        uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now()
);
create index if not exists connectors_org_idx on public.connectors (org_id);
alter table public.connectors enable row level security;
drop policy if exists connectors_read on public.connectors;
create policy connectors_read on public.connectors
  for select using (org_id = public.current_org_id() and public.current_role_at_least('coordinator'));
drop policy if exists connectors_manage on public.connectors;
create policy connectors_manage on public.connectors
  for all using (org_id = public.current_org_id() and public.current_role_at_least('coordinator'))
  with check (org_id = public.current_org_id() and public.current_role_at_least('coordinator'));

-- Secrets: no client policy at all → unreadable through the API.
create table if not exists public.connector_secrets (
  connector_id  uuid primary key references public.connectors (id) on delete cascade,
  org_id        uuid not null,
  secret        jsonb not null,
  updated_by    uuid,
  updated_at    timestamptz not null default now()
);
alter table public.connector_secrets enable row level security;

create or replace function public.set_connector_secret(p_connector uuid, p_secret jsonb, p_hint text default null)
returns void language plpgsql security definer set search_path = public as
$$
declare c public.connectors;
begin
  select * into c from public.connectors where id = p_connector;
  if c.id is null or c.org_id <> public.current_org_id() or not public.current_role_at_least('coordinator') then
    raise exception 'not allowed';
  end if;
  if p_secret is null or p_secret = '{}'::jsonb then
    delete from public.connector_secrets where connector_id = p_connector;
    update public.connectors set secret_set = false, secret_hint = null where id = p_connector;
    return;
  end if;
  insert into public.connector_secrets (connector_id, org_id, secret, updated_by)
  values (p_connector, c.org_id, p_secret, auth.uid())
  on conflict (connector_id) do update set secret = excluded.secret, updated_by = excluded.updated_by, updated_at = now();
  update public.connectors set secret_set = true, secret_hint = left(p_hint, 12) where id = p_connector;
end
$$;
grant execute on function public.set_connector_secret(uuid, jsonb, text) to authenticated;

-- ---------- broadcasts ----------
create table if not exists public.broadcasts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  title         text not null,
  body          text,
  severity      text not null default 'urgent' check (severity in ('info', 'urgent', 'emergency')),
  audience      jsonb not null default '{}'::jsonb,   -- {team:true, channels:[], groups:[], contacts:[], connectors:[]}
  require_ack   boolean not null default true,
  lat           double precision,
  lng           double precision,
  status        text not null default 'active' check (status in ('active', 'closed')),
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  closed_at     timestamptz
);
create index if not exists broadcasts_org_idx on public.broadcasts (org_id, created_at desc);
alter table public.broadcasts enable row level security;
drop policy if exists broadcasts_read on public.broadcasts;
create policy broadcasts_read on public.broadcasts
  for select using (org_id = public.current_org_id());
drop policy if exists broadcasts_insert on public.broadcasts;
create policy broadcasts_insert on public.broadcasts
  for insert with check (org_id = public.current_org_id() and created_by = auth.uid() and public.current_role_at_least('coordinator'));
drop policy if exists broadcasts_update on public.broadcasts;
create policy broadcasts_update on public.broadcasts
  for update using (org_id = public.current_org_id() and public.current_role_at_least('coordinator'));

create table if not exists public.broadcast_acks (
  id            bigint generated always as identity primary key,
  broadcast_id  uuid not null references public.broadcasts (id) on delete cascade,
  org_id        uuid not null,
  profile_id    uuid references public.profiles (id) on delete cascade,
  contact_id    uuid references public.contacts (id) on delete cascade,
  via           text not null default 'app',
  reply         text,
  at            timestamptz not null default now()
);
create unique index if not exists broadcast_acks_member_idx on public.broadcast_acks (broadcast_id, profile_id) where profile_id is not null;
create unique index if not exists broadcast_acks_contact_idx on public.broadcast_acks (broadcast_id, contact_id) where contact_id is not null;
alter table public.broadcast_acks enable row level security;
drop policy if exists broadcast_acks_read on public.broadcast_acks;
create policy broadcast_acks_read on public.broadcast_acks
  for select using (org_id = public.current_org_id());
drop policy if exists broadcast_acks_insert on public.broadcast_acks;
create policy broadcast_acks_insert on public.broadcast_acks
  for insert with check (org_id = public.current_org_id() and profile_id = auth.uid() and contact_id is null);

-- ---------- delivery log ----------
create table if not exists public.comms_deliveries (
  id            bigint generated always as identity primary key,
  org_id        uuid not null,
  connector_id  uuid references public.connectors (id) on delete cascade,
  ref_type      text not null,       -- message | broadcast | alert | test | inbound
  ref_id        text,
  target        text,
  status        text not null,       -- sent | failed | skipped | received
  detail        text,
  at            timestamptz not null default now()
);
create index if not exists comms_deliveries_idx on public.comms_deliveries (org_id, at desc);
create index if not exists comms_deliveries_ref_idx on public.comms_deliveries (connector_id, ref_type, ref_id);
alter table public.comms_deliveries enable row level security;
drop policy if exists comms_deliveries_read on public.comms_deliveries;
create policy comms_deliveries_read on public.comms_deliveries
  for select using (org_id = public.current_org_id() and public.current_role_at_least('coordinator'));

-- ---------- dispatch: new messages / broadcasts / alerts → comms-dispatch ----------
-- Only fires when the company has an enabled outbound connector.
-- (The key below is the public anon key — it already ships in the app.)
create or replace function public.comms_dispatch_trigger() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_kind text := tg_argv[0];
begin
  -- nested ifs: each table's own fields are only read for that table
  if v_kind = 'alert' then
    if new.severity not in ('critical', 'warning') then return new; end if;
  end if;
  if not exists (select 1 from public.connectors c where c.org_id = new.org_id and c.enabled and c.kind <> 'cap') then return new; end if;
  perform net.http_post(
    url := 'https://lamezbfkdnzztpmwimoz.supabase.co/functions/v1/comms-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhbWV6YmZrZG56enRwbXdpbW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTcyNzUsImV4cCI6MjEwMTU5MzI3NX0.n79p2rk0w_TQUU2QTLnM5s3sJvpAHExNz4rkPCo6D20'
    ),
    body := jsonb_build_object('type', v_kind, 'id', new.id::text),
    timeout_milliseconds := 30000
  );
  return new;
end $$;

drop trigger if exists messages_dispatch on public.messages;
create trigger messages_dispatch after insert on public.messages
  for each row execute function public.comms_dispatch_trigger('message');
drop trigger if exists broadcasts_dispatch on public.broadcasts;
create trigger broadcasts_dispatch after insert on public.broadcasts
  for each row execute function public.comms_dispatch_trigger('broadcast');
drop trigger if exists attention_dispatch on public.attention_items;
create trigger attention_dispatch after insert on public.attention_items
  for each row execute function public.comms_dispatch_trigger('alert');

-- ---------- realtime ----------
do $$ begin alter publication supabase_realtime add table public.channels; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.broadcasts; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.broadcast_acks; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.contacts; exception when duplicate_object then null; end $$;

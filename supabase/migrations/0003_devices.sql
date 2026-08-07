-- ============================================================
-- Watchtower migration 0003: devices
-- Every feed source — drones, cameras, sensors, edge boxes —
-- is a device row. Streams, the tactical map, and settings all
-- read from this table in live mode.
-- Run in the Supabase SQL Editor after 0002.
-- ============================================================

create type public.device_kind as enum ('drone', 'ptz_camera', 'camera', 'sensor', 'edge_box');

create table public.devices (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  name          text not null,
  kind          public.device_kind not null,
  status        text not null default 'offline',   -- offline | active | alert | maintenance
  lat           double precision,
  lng           double precision,
  stream_url    text,                              -- future: RTSP/WebRTC ingest endpoint
  channel_cost  integer not null default 1,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index devices_org_idx on public.devices (org_id);

alter table public.devices enable row level security;

-- Org members see their devices; operators+ manage them; admins delete
create policy devices_read on public.devices
  for select using (org_id = public.current_org_id());
create policy devices_insert on public.devices
  for insert with check (org_id = public.current_org_id() and public.current_role_at_least('operator'));
create policy devices_update on public.devices
  for update using (org_id = public.current_org_id() and public.current_role_at_least('operator'));
create policy devices_delete on public.devices
  for delete using (org_id = public.current_org_id() and public.current_role_at_least('admin'));

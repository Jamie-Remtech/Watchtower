-- ============================================================
-- 0034: map layers — drawn shapes, geofence alerts, company map setup
--
-- map_shapes      zones (polygons), circles and routes drawn on the
--                 tactical map, shared live with the team. Zones and
--                 circles can alert when someone enters / leaves them.
--                 geometry:  zone/route { "path": [{"lat":..,"lng":..}, ...] }
--                            circle     { "center": {"lat":..,"lng":..}, "radius": metres }
-- geofence_state  last known inside/outside per (shape, person), kept by
--                 the geofence-watch edge function (service role only writes).
-- map_config      one row per company: which marker kinds / shape
--                 categories are offered, custom ones, map overlays
--                 (XYZ / WMS) and the default map type.
-- Idempotent: safe to run more than once.
-- ============================================================

-- ---------- drawn shapes ----------
create table if not exists public.map_shapes (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  kind        text not null check (kind in ('zone', 'circle', 'route')),
  category    text not null default '',            -- built-in id (exclusion, hazard_area, …) or a custom id from map_config
  label       text not null default '' check (char_length(label) <= 200),
  notes       text check (notes is null or char_length(notes) <= 4000),
  color       text not null default '#38bdf8' check (color ~ '^#[0-9a-fA-F]{6}$'),
  alert       text not null default 'none' check (alert in ('none', 'enter', 'exit', 'both')),
  active      boolean not null default true,
  geometry    jsonb not null,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);
create index if not exists map_shapes_org_idx on public.map_shapes (org_id, created_at desc);
create index if not exists map_shapes_alert_idx on public.map_shapes (org_id) where active and alert <> 'none';

alter table public.map_shapes enable row level security;

-- Same rights as markers: members see them, field+ draw them,
-- the creator or an operator+ edits / removes them.
drop policy if exists map_shapes_read on public.map_shapes;
create policy map_shapes_read on public.map_shapes
  for select using (org_id = public.current_org_id());
drop policy if exists map_shapes_insert on public.map_shapes;
create policy map_shapes_insert on public.map_shapes
  for insert with check (
    org_id = public.current_org_id()
    and created_by = auth.uid()
    and public.current_role_at_least('field')
  );
drop policy if exists map_shapes_update on public.map_shapes;
create policy map_shapes_update on public.map_shapes
  for update using (
    org_id = public.current_org_id()
    and (created_by = auth.uid() or public.current_role_at_least('operator'))
  ) with check (org_id = public.current_org_id());
drop policy if exists map_shapes_delete on public.map_shapes;
create policy map_shapes_delete on public.map_shapes
  for delete using (
    org_id = public.current_org_id()
    and (created_by = auth.uid() or public.current_role_at_least('operator'))
  );

-- ---------- geofence state (written by the edge function) ----------
create table if not exists public.geofence_state (
  shape_id    uuid not null references public.map_shapes (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  inside      boolean not null,
  changed_at  timestamptz not null default now(),
  primary key (shape_id, profile_id)
);
create index if not exists geofence_state_org_idx on public.geofence_state (org_id);

alter table public.geofence_state enable row level security;
-- read-only for the company; no client writes
drop policy if exists geofence_state_read on public.geofence_state;
create policy geofence_state_read on public.geofence_state
  for select using (org_id = public.current_org_id());

-- ---------- per-company map configuration ----------
create table if not exists public.map_config (
  org_id      uuid primary key references public.organizations (id) on delete cascade,
  config      jsonb not null default '{}'::jsonb,
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);

alter table public.map_config enable row level security;
drop policy if exists map_config_read on public.map_config;
create policy map_config_read on public.map_config
  for select using (org_id = public.current_org_id());
drop policy if exists map_config_insert on public.map_config;
create policy map_config_insert on public.map_config
  for insert with check (org_id = public.current_org_id() and public.current_role_at_least('coordinator'));
drop policy if exists map_config_update on public.map_config;
create policy map_config_update on public.map_config
  for update using (org_id = public.current_org_id() and public.current_role_at_least('coordinator'))
  with check (org_id = public.current_org_id());

-- ---------- live sync ----------
do $$ begin
  alter publication supabase_realtime add table public.map_shapes;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.map_config;
exception when duplicate_object then null; end $$;

-- ---------- schedule (run by hand with the real key; not part of this migration) ----------
-- select cron.schedule(
--   'geofence-watch',
--   '30 seconds',
--   $$ select net.http_post(
--        url := 'https://lamezbfkdnzztpmwimoz.supabase.co/functions/v1/geofence-watch',
--        headers := jsonb_build_object(
--          'Content-Type', 'application/json',
--          'Authorization', 'Bearer <public anon key — the function uses its own service role inside>'
--        ),
--        body := '{}'::jsonb,
--        timeout_milliseconds := 25000
--      ) $$
-- );
-- To stop it:  select cron.unschedule('geofence-watch');

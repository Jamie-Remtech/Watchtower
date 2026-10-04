-- ============================================================
-- 0031: airspace — every aircraft and drone, in 3D, deconflicted
--
-- air_links   things that feed the sky picture, each with a secret key
--             (only its SHA-256 is stored):
--               adsb      a receiver box hearing aircraft transponders
--               remoteid  a receiver hearing drones' Remote ID broadcasts
--               telemetry one drone's own live feed (ground-station bridge)
-- air_tracks  the current state of each airborne thing in a company's
--             picture: aircraft from receivers, drones from telemetry or
--             Remote ID, and drone flights pilots declare by hand.
--             Altitudes are normalised to metres above sea level
--             (alt_msl_m) so planes and drones compare on one scale.
-- Public ADS-B (adsb.lol) is fetched live, not stored.
-- ============================================================

create table if not exists public.air_links (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  kind          text not null check (kind in ('adsb', 'remoteid', 'telemetry')),
  key_hash      text not null unique,
  key_hint      text,                       -- last 4 characters, to recognise it
  home_elev_m   real,                       -- telemetry: ground elevation at takeoff
  home_set_at   timestamptz,
  last_seen_at  timestamptz,
  last_count    integer,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
alter table public.air_links enable row level security;
create policy air_links_read on public.air_links
  for select using (org_id = public.current_org_id() or public.is_platform_staff());
create policy air_links_insert on public.air_links
  for insert with check (org_id = public.current_org_id() and public.current_role_at_least('coordinator'));
create policy air_links_delete on public.air_links
  for delete using (org_id = public.current_org_id() and public.current_role_at_least('coordinator'));

create table if not exists public.air_tracks (
  org_id        uuid not null references public.organizations (id) on delete cascade,
  id            text not null,              -- icao:<hex> | rid:<serial> | tel:<link> | decl:<uuid>
  kind          text not null check (kind in ('aircraft', 'helicopter', 'drone', 'balloon', 'other')),
  source        text not null check (source in ('receiver', 'remoteid', 'telemetry', 'declared')),
  label         text,
  callsign      text,
  registration  text,
  model         text,
  lat           double precision not null,
  lng           double precision not null,
  alt_msl_m     real,
  alt_agl_m     real,
  alt_source    text,                       -- geom | baro | rid-geodetic | takeoff+rel | ground+ceiling
  ceiling_m     real,                       -- declared flights: max height above ground
  radius_m      real,                       -- declared flights: operating radius
  heading       real,
  speed_kmh     real,
  vrate_mps     real,
  operator_lat  double precision,
  operator_lng  double precision,
  link_id       uuid references public.air_links (id) on delete set null,
  declared_by   uuid references public.profiles (id) on delete set null,
  status        text not null default 'active' check (status in ('active', 'ended')),
  started_at    timestamptz not null default now(),
  seen_at       timestamptz not null default now(),
  raw           jsonb,
  primary key (org_id, id)
);
create index if not exists air_tracks_live_idx on public.air_tracks (org_id, seen_at desc) where status = 'active';
alter table public.air_tracks enable row level security;
create policy air_tracks_read on public.air_tracks
  for select using (org_id = public.current_org_id() or public.is_platform_staff());
-- pilots declare and end their own flights; feeds write through the service role
create policy air_tracks_declare on public.air_tracks
  for insert with check (org_id = public.current_org_id() and source = 'declared' and declared_by = auth.uid());
create policy air_tracks_declare_update on public.air_tracks
  for update using (org_id = public.current_org_id() and source = 'declared'
                    and (declared_by = auth.uid() or public.current_role_at_least('coordinator')));

do $$ begin
  alter publication supabase_realtime add table public.air_tracks;
exception when duplicate_object then null; end $$;

-- ============================================================
-- 0025: prediction ledger + regional memory
--
-- predictions        every forecast Watchtower makes for the places its
--                    people are, with the variables it used, frozen at
--                    issue time (fingerprinted, edits blocked), later
--                    scored against what actually happened (ERA5).
--                    Both the raw model value and Watchtower's locally
--                    bias-corrected value are kept and scored, so the
--                    record proves whether learning helps.
-- regional_incidents past fires, quakes, storms, floods by place — the
--                    memory behind burn-scar context and recurrence
--                    hotspots. Global rows (org_id null) come from public
--                    sources; companies can add their own.
-- region_normals     1991–2020 monthly climate per cell (cache).
-- ============================================================

create table if not exists public.predictions (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  region_key     text not null,              -- 0.25° cell "lat,lng"
  lat            double precision not null,
  lng            double precision not null,
  place          text,
  kind           text not null check (kind in ('daily', 'seasonal')),
  metric         text not null,              -- gust_max, precip_sum, temp_max, temp_min, tstorm, temp_mean, precip_month
  issue_date     date not null default current_date,
  issued_at      timestamptz not null default now(),
  valid_date     date not null,              -- the day, or first day of the month
  lead_days      int not null,
  predicted_raw  numeric,                    -- what the model said
  predicted      numeric,                    -- after Watchtower's local correction
  flagged        boolean,                    -- did we warn (on the corrected value)
  flagged_raw    boolean,
  threshold      numeric,
  unit           text,
  inputs         jsonb not null default '{}', -- model, members, ENSO, bias used, regional context
  source         text not null,
  version        text not null,
  fingerprint    text not null,              -- sha-256 of the prediction as issued
  observed       numeric,
  observed_flag  boolean,
  observed_source text,
  verdict        text not null default 'pending'
                 check (verdict in ('pending', 'hit', 'miss', 'false_alarm', 'correct_negative', 'scored', 'no_data')),
  verdict_raw    text,
  abs_error      numeric,
  abs_error_raw  numeric,
  scored_at      timestamptz,
  unique (org_id, region_key, kind, metric, valid_date, issue_date)
);
create index if not exists predictions_org_issue_idx on public.predictions (org_id, issue_date desc);
create index if not exists predictions_pending_idx on public.predictions (verdict, valid_date) where verdict = 'pending';
create index if not exists predictions_region_idx on public.predictions (org_id, region_key, metric, scored_at desc);

-- The record is official: what was predicted can never be rewritten.
create or replace function public.predictions_frozen() returns trigger
language plpgsql as $$
begin
  if new.predicted_raw is distinct from old.predicted_raw
     or new.predicted is distinct from old.predicted
     or new.flagged is distinct from old.flagged
     or new.flagged_raw is distinct from old.flagged_raw
     or new.threshold is distinct from old.threshold
     or new.inputs is distinct from old.inputs
     or new.issued_at is distinct from old.issued_at
     or new.issue_date is distinct from old.issue_date
     or new.valid_date is distinct from old.valid_date
     or new.lead_days is distinct from old.lead_days
     or new.metric is distinct from old.metric
     or new.region_key is distinct from old.region_key
     or new.fingerprint is distinct from old.fingerprint then
    raise exception 'predictions are frozen once issued — only scoring fields may change';
  end if;
  return new;
end $$;
drop trigger if exists predictions_frozen on public.predictions;
create trigger predictions_frozen before update on public.predictions
  for each row execute function public.predictions_frozen();

alter table public.predictions enable row level security;
create policy predictions_read on public.predictions
  for select using (org_id = public.current_org_id() or public.is_platform_staff());
-- writes only through the ledger function (service role)

create table if not exists public.regional_incidents (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references public.organizations (id) on delete cascade,
  source        text not null,               -- eonet, usgs, manual
  external_id   text,
  kind          text not null,               -- wildfire, earthquake, severe_storm, flood, volcano, landslide, snow_ice, drought, heat, other
  title         text,
  lat           double precision not null,
  lng           double precision not null,
  region_key    text not null,               -- 0.5° cell
  started_at    timestamptz,
  ended_at      timestamptz,
  magnitude     numeric,
  magnitude_unit text,
  details       jsonb not null default '{}',
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (source, external_id)
);
create index if not exists regional_incidents_cell_idx on public.regional_incidents (region_key, kind, started_at desc);
create index if not exists regional_incidents_geo_idx on public.regional_incidents (lat, lng);

alter table public.regional_incidents enable row level security;
create policy regional_incidents_read on public.regional_incidents
  for select to authenticated using (org_id is null or org_id = public.current_org_id() or public.is_platform_staff());
create policy regional_incidents_add on public.regional_incidents
  for insert to authenticated with check (org_id = public.current_org_id() and source = 'manual' and created_by = auth.uid());
create policy regional_incidents_delete_own on public.regional_incidents
  for delete to authenticated using (org_id = public.current_org_id() and source = 'manual' and public.current_role_at_least('coordinator'));

create table if not exists public.region_normals (
  region_key  text primary key,              -- 0.25° cell
  months      jsonb not null,                -- [{temp, precip} x12], 1991–2020
  created_at  timestamptz not null default now()
);
alter table public.region_normals enable row level security;
create policy region_normals_read on public.region_normals for select to authenticated using (true);

-- Which cells have had their incident history backfilled
create table if not exists public.region_backfills (
  region_key  text primary key,              -- 0.5° cell
  done_at     timestamptz not null default now()
);
alter table public.region_backfills enable row level security;

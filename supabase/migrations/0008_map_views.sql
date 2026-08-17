-- ============================================================
-- Watchtower migration 0008: saved tactical views
-- Operators freeze map views (center/zoom/style) as named quick
-- references for the fronts they're working — shared org-wide and
-- synced in realtime to every window and device.
-- Run in the Supabase SQL Editor after 0007.
-- ============================================================

create table public.map_views (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null,
  lat         double precision not null,
  lng         double precision not null,
  zoom        double precision not null,
  map_mode    text not null default 'satellite',
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now()
);

create index map_views_org_idx on public.map_views (org_id, created_at);

alter table public.map_views enable row level security;

create policy map_views_read on public.map_views
  for select using (org_id = public.current_org_id());
create policy map_views_insert on public.map_views
  for insert with check (
    org_id = public.current_org_id()
    and created_by = auth.uid()
    and public.current_role_at_least('field')
  );
create policy map_views_update on public.map_views
  for update using (
    org_id = public.current_org_id()
    and (created_by = auth.uid() or public.current_role_at_least('operator'))
  );
create policy map_views_delete on public.map_views
  for delete using (
    org_id = public.current_org_id()
    and (created_by = auth.uid() or public.current_role_at_least('operator'))
  );

alter publication supabase_realtime add table public.map_views;

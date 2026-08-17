-- ============================================================
-- Watchtower migration 0006: tactical markers
-- Shared points of interest on the tactical map: hazards, medical
-- points, water sources, blocked roads, staging areas. Anyone in
-- the field can drop one; the whole org sees it live.
-- Run in the Supabase SQL Editor after 0005.
-- ============================================================

create table public.markers (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  kind        text not null default 'poi',   -- fire | medical | injured | hazard | blocked | water | staging | vehicle | poi
  label       text not null default '',
  notes       text,
  lat         double precision not null,
  lng         double precision not null,
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now()
);

create index markers_org_idx on public.markers (org_id, created_at desc);

alter table public.markers enable row level security;

-- Org members see markers; field role and up create them;
-- the creator or an operator+ can remove them
create policy markers_read on public.markers
  for select using (org_id = public.current_org_id());
create policy markers_insert on public.markers
  for insert with check (
    org_id = public.current_org_id()
    and created_by = auth.uid()
    and public.current_role_at_least('field')
  );
create policy markers_delete on public.markers
  for delete using (
    org_id = public.current_org_id()
    and (created_by = auth.uid() or public.current_role_at_least('operator'))
  );

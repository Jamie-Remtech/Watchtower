-- ============================================================
-- 0019: linked companies share the live tactical picture
--
-- An ACTIVE org_link opens READ access between two companies for
-- the tactical layer: crew positions, markers, devices — and the
-- member names needed to label them. Suspend the link and the
-- sharing stops on the next query. Nothing is writable across the
-- wall: each company still edits only its own data. Medical records
-- (patients) and internal comms stay private to each company.
-- ============================================================

create or replace function public.linked_org_ids()
returns setof uuid
language sql stable security definer set search_path = public as
$$
  select public.current_org_id()
  union
  select case when org_a = public.current_org_id() then org_b else org_a end
  from public.org_links
  where status = 'active'
    and (org_a = public.current_org_id() or org_b = public.current_org_id())
$$;

grant execute on function public.linked_org_ids() to authenticated;

create policy positions_linked_read on public.positions
  for select using (org_id in (select public.linked_org_ids()));

create policy markers_linked_read on public.markers
  for select using (org_id in (select public.linked_org_ids()));

create policy devices_linked_read on public.devices
  for select using (org_id in (select public.linked_org_ids()));

-- Names for the shared picture (display name / role / callsign only
-- in practice — the client selects what it shows)
create policy profiles_linked_read on public.profiles
  for select using (org_id in (select public.linked_org_ids()));

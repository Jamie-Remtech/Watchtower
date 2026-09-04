-- ============================================================
-- 0020: link confidentiality — cross-company reads are rank-gated
--
-- Customer companies are confidential. Link-based tactical sharing
-- (0019) now applies only to coordinators and admins of a linked
-- company — not every member. The platform owner's own visibility
-- is unchanged (and remains the only cross-platform view).
-- ============================================================

drop policy if exists positions_linked_read on public.positions;
create policy positions_linked_read on public.positions
  for select using (
    public.current_role_at_least('coordinator')
    and org_id in (select public.linked_org_ids())
  );

drop policy if exists markers_linked_read on public.markers;
create policy markers_linked_read on public.markers
  for select using (
    public.current_role_at_least('coordinator')
    and org_id in (select public.linked_org_ids())
  );

drop policy if exists devices_linked_read on public.devices;
create policy devices_linked_read on public.devices
  for select using (
    public.current_role_at_least('coordinator')
    and org_id in (select public.linked_org_ids())
  );

drop policy if exists profiles_linked_read on public.profiles;
create policy profiles_linked_read on public.profiles
  for select using (
    public.current_role_at_least('coordinator')
    and org_id in (select public.linked_org_ids())
  );

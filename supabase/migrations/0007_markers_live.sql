-- ============================================================
-- Watchtower migration 0007: draggable, editable, realtime markers
-- - update policy so markers can be moved and edited after placing
-- - realtime publication so every client sees marker and position
--   changes the moment they happen (no polling delay)
-- Run in the Supabase SQL Editor after 0006.
-- ============================================================

-- Creator or operator+ can move/edit a marker
create policy markers_update on public.markers
  for update using (
    org_id = public.current_org_id()
    and (created_by = auth.uid() or public.current_role_at_least('operator'))
  );

-- Broadcast changes live to connected clients
alter publication supabase_realtime add table public.markers;
alter publication supabase_realtime add table public.positions;

-- ============================================================
-- Watchtower migration 0014: invitation hierarchy
-- Only admins may create coordinator or admin invitations.
-- Coordinators can invite viewer / field / operator.
-- Run in the Supabase SQL Editor after 0013.
-- ============================================================

drop policy if exists invitations_insert on public.invitations;
create policy invitations_insert on public.invitations
  for insert with check (
    org_id = public.current_org_id()
    and public.current_role_at_least('coordinator')
    and (
      public.current_role_at_least('admin')
      or role in ('viewer', 'field', 'operator')
    )
  );

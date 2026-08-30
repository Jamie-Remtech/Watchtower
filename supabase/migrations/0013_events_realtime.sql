-- ============================================================
-- Watchtower migration 0013: live activity stream
-- Broadcast the events log so coordinators can watch the operation
-- unfold in realtime (Activity tab).
-- Run in the Supabase SQL Editor after 0012.
-- ============================================================

alter publication supabase_realtime add table public.events;

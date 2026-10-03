-- ============================================================
-- 0030: communications quality, captured with every position report
--
-- Each tracked device measures its own link (round-trip time to
-- Watchtower, browser connection estimate, online state) and sends it
-- with its position. That gives the control centre each member's link
-- live, and a coverage history map — the baseline for measuring what a
-- relay drone overhead actually adds.
--   net_quality   good | fair | poor | offline (computed on the device)
--   net_rtt_ms    measured round trip to Watchtower, median of recent
--   net_effective browser estimate: slow-2g | 2g | 3g | 4g (Chrome/Android)
--   net_type      cellular | wifi | ethernet | … when the browser says
--   net_downlink  browser estimate, Mbit/s
-- ============================================================
alter table public.positions add column if not exists net_quality   text check (net_quality in ('good', 'fair', 'poor', 'offline'));
alter table public.positions add column if not exists net_rtt_ms    integer;
alter table public.positions add column if not exists net_effective text;
alter table public.positions add column if not exists net_type      text;
alter table public.positions add column if not exists net_downlink  real;
create index if not exists positions_org_quality_at_idx on public.positions (org_id, at desc) where net_quality is not null;

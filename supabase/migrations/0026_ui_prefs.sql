-- ============================================================
-- 0026: per-member appearance (theme, accent colour)
-- Applied per device first (localStorage); the profile copy lets a
-- member's choice follow them to a new device.
-- ============================================================
alter table public.profiles add column if not exists ui_prefs jsonb not null default '{}';

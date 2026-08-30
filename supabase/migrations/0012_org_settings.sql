-- ============================================================
-- Watchtower migration 0012: organization settings
-- Free-form org configuration (attention watch radii first).
-- Run in the Supabase SQL Editor after 0011.
-- ============================================================

alter table public.organizations
  add column if not exists settings jsonb not null default '{}'::jsonb;

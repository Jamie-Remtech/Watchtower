-- ============================================================
-- Watchtower migration 0004: attention items
-- The attention engine raises items here; coordinators acknowledge
-- them. dedupe_key prevents the same condition from stacking up;
-- a resolved item can be re-raised if the condition returns.
-- Run in the Supabase SQL Editor after 0003.
-- ============================================================

create table public.attention_items (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete cascade,
  dedupe_key       text not null,
  severity         text not null default 'info',      -- info | warning | critical
  kind             text not null default 'general',   -- device | hazard | weather | seismic | admin
  title            text not null,
  detail           text,
  subject          text,                              -- device id, event id, etc.
  source           jsonb not null default '{}'::jsonb,
  status           text not null default 'open',      -- open | acknowledged | resolved
  created_at       timestamptz not null default now(),
  acknowledged_by  uuid references public.profiles (id),
  acknowledged_at  timestamptz
);

-- One live item per condition; resolved items don't block a re-raise
create unique index attention_dedupe_live_idx
  on public.attention_items (org_id, dedupe_key)
  where status <> 'resolved';

create index attention_org_status_idx on public.attention_items (org_id, status, created_at desc);

alter table public.attention_items enable row level security;

-- Members see their org's items; any member's client may raise items
-- (the engine runs in every session); operators+ acknowledge/resolve
create policy attention_read on public.attention_items
  for select using (org_id = public.current_org_id());
create policy attention_insert on public.attention_items
  for insert with check (org_id = public.current_org_id());
create policy attention_update on public.attention_items
  for update using (org_id = public.current_org_id() and public.current_role_at_least('operator'));

-- ============================================================
-- Watchtower migration 0011: push subscriptions
-- One row per device registered for Web Push. The push-notify edge
-- function (service role) reads the org's subscriptions to deliver
-- notifications even when the app is closed.
-- Run in the Supabase SQL Editor after 0010.
-- ============================================================

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

create index push_subs_org_idx on public.push_subscriptions (org_id);

alter table public.push_subscriptions enable row level security;

-- Each user manages only their own device registrations; delivery is
-- done server-side with the service role.
create policy push_subs_own_read on public.push_subscriptions
  for select using (profile_id = auth.uid());
create policy push_subs_own_insert on public.push_subscriptions
  for insert with check (profile_id = auth.uid() and org_id = public.current_org_id());
create policy push_subs_own_update on public.push_subscriptions
  for update using (profile_id = auth.uid());
create policy push_subs_own_delete on public.push_subscriptions
  for delete using (profile_id = auth.uid());

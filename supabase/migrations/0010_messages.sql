-- ============================================================
-- Watchtower migration 0010: team messages
-- One realtime channel per organization — command and field text
-- each other inside the operational picture.
-- Run in the Supabase SQL Editor after 0009.
-- ============================================================

create table public.messages (
  id       bigint generated always as identity primary key,
  org_id   uuid not null references public.organizations (id) on delete cascade,
  sender   uuid references public.profiles (id),
  text     text not null,
  at       timestamptz not null default now()
);

create index messages_org_at_idx on public.messages (org_id, at desc);

alter table public.messages enable row level security;

create policy messages_read on public.messages
  for select using (org_id = public.current_org_id());
create policy messages_insert on public.messages
  for insert with check (
    org_id = public.current_org_id()
    and sender = auth.uid()
    and public.current_role_at_least('field')
  );

alter publication supabase_realtime add table public.messages;

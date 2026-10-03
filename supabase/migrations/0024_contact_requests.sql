-- ============================================================
-- 0024: contact requests from the public homepage
--
-- Anyone (signed in or not) can send one: access requests, dispatch /
-- CAD connection requests, questions. Only platform staff read them —
-- they surface in the Platform tab. Lengths are capped and a status
-- lets staff work through them.
-- ============================================================

create table if not exists public.contact_requests (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 120),
  email        text not null check (char_length(email) between 3 and 200),
  organization text check (char_length(organization) <= 200),
  topic        text not null default 'other' check (topic in ('access', 'dispatch', 'pricing', 'other')),
  message      text check (char_length(message) <= 4000),
  language     text,
  status       text not null default 'new' check (status in ('new', 'replied', 'closed')),
  created_at   timestamptz not null default now()
);

alter table public.contact_requests enable row level security;

create policy contact_requests_insert on public.contact_requests
  for insert to anon, authenticated with check (status = 'new');
create policy contact_requests_staff_read on public.contact_requests
  for select using (public.is_platform_staff());
create policy contact_requests_staff_update on public.contact_requests
  for update using (public.is_platform_staff());

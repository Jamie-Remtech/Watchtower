-- ============================================================
-- 0029: correct and remove Field Log entries — without losing the record
--
-- events stays append-only for clients (no UPDATE/DELETE policies).
-- Notes (field.report, patient.entry) can be edited or removed only
-- through these functions, by their author or a coordinator+. Every
-- change writes the before/after into event_revisions; "remove" hides
-- the entry (deleted_at) and a coordinator+ can restore it. The change
-- itself is logged to the Activity feed.
-- ============================================================

alter table public.events add column if not exists edited_at  timestamptz;
alter table public.events add column if not exists edited_by  uuid references public.profiles (id) on delete set null;
alter table public.events add column if not exists deleted_at timestamptz;
alter table public.events add column if not exists deleted_by uuid references public.profiles (id) on delete set null;

create table if not exists public.event_revisions (
  id          bigint generated always as identity primary key,
  event_id    bigint not null references public.events (id) on delete cascade,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  action      text not null check (action in ('edit', 'remove', 'restore')),
  old_payload jsonb,
  new_payload jsonb,
  reason      text check (char_length(reason) <= 500),
  by_id       uuid references public.profiles (id) on delete set null,
  at          timestamptz not null default now()
);
create index if not exists event_revisions_event_idx on public.event_revisions (event_id, at);
alter table public.event_revisions enable row level security;
create policy event_revisions_read on public.event_revisions
  for select using (org_id = public.current_org_id() or public.is_platform_staff());

create or replace function public.log_entry_guard(p_id bigint)
returns public.events
language plpgsql security definer set search_path = public as $$
declare ev public.events;
begin
  select * into ev from public.events where id = p_id;
  if ev.id is null or ev.org_id is distinct from public.current_org_id() then
    raise exception 'entry not found';
  end if;
  if ev.type not in ('field.report', 'patient.entry') then
    raise exception 'only notes can be corrected — change the patient instead';
  end if;
  if ev.actor_id is distinct from auth.uid() and not public.current_role_at_least('coordinator') then
    raise exception 'only the author or a coordinator can change this entry';
  end if;
  return ev;
end $$;

create or replace function public.edit_log_entry(p_id bigint, p_text text, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare ev public.events; np jsonb;
begin
  ev := public.log_entry_guard(p_id);
  if ev.deleted_at is not null then raise exception 'entry was removed — restore it first'; end if;
  if coalesce(trim(p_text), '') = '' then raise exception 'the entry cannot be empty'; end if;
  np := ev.payload || jsonb_build_object('text', left(trim(p_text), 4000));
  insert into public.event_revisions (event_id, org_id, action, old_payload, new_payload, reason, by_id)
    values (ev.id, ev.org_id, 'edit', ev.payload, np, nullif(left(trim(coalesce(p_reason, '')), 500), ''), auth.uid());
  update public.events set payload = np, edited_at = now(), edited_by = auth.uid() where id = ev.id;
  insert into public.events (org_id, actor_id, actor_kind, type, subject, payload)
    values (ev.org_id, auth.uid(), 'user', 'log.entry_edited', ev.id::text,
            jsonb_build_object('reason', p_reason, 'patient', ev.subject));
end $$;

create or replace function public.remove_log_entry(p_id bigint, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare ev public.events;
begin
  ev := public.log_entry_guard(p_id);
  if ev.deleted_at is not null then return; end if;
  insert into public.event_revisions (event_id, org_id, action, old_payload, reason, by_id)
    values (ev.id, ev.org_id, 'remove', ev.payload, nullif(left(trim(coalesce(p_reason, '')), 500), ''), auth.uid());
  update public.events set deleted_at = now(), deleted_by = auth.uid() where id = ev.id;
  insert into public.events (org_id, actor_id, actor_kind, type, subject, payload)
    values (ev.org_id, auth.uid(), 'user', 'log.entry_removed', ev.id::text,
            jsonb_build_object('reason', p_reason, 'patient', ev.subject));
end $$;

create or replace function public.restore_log_entry(p_id bigint)
returns void
language plpgsql security definer set search_path = public as $$
declare ev public.events;
begin
  ev := public.log_entry_guard(p_id);
  if not public.current_role_at_least('coordinator') then raise exception 'only a coordinator can restore entries'; end if;
  if ev.deleted_at is null then return; end if;
  insert into public.event_revisions (event_id, org_id, action, new_payload, by_id)
    values (ev.id, ev.org_id, 'restore', ev.payload, auth.uid());
  update public.events set deleted_at = null, deleted_by = null where id = ev.id;
  insert into public.events (org_id, actor_id, actor_kind, type, subject, payload)
    values (ev.org_id, auth.uid(), 'user', 'log.entry_restored', ev.id::text, jsonb_build_object('patient', ev.subject));
end $$;

revoke all on function public.log_entry_guard(bigint) from public, anon;
revoke all on function public.edit_log_entry(bigint, text, text) from public, anon;
revoke all on function public.remove_log_entry(bigint, text) from public, anon;
revoke all on function public.restore_log_entry(bigint) from public, anon;
grant execute on function public.edit_log_entry(bigint, text, text) to authenticated;
grant execute on function public.remove_log_entry(bigint, text) to authenticated;
grant execute on function public.restore_log_entry(bigint) to authenticated;

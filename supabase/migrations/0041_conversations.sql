-- ============================================================
-- Watchtower migration 0041: conversations — direct and group messages
-- channels.kind: 'channel' (company channels, read by rank) | 'dm' (two
-- members) | 'group' (chosen members). DMs and groups are readable ONLY by
-- their members. conversation_reads keeps each person's last-read time per
-- conversation for unread counts. Outside-contact threads (SMS/WhatsApp)
-- are built from messages.contact_id in the app.
-- ============================================================

alter table public.channels add column if not exists kind text not null default 'channel';
do $$ begin
  alter table public.channels add constraint channels_kind_check check (kind in ('channel', 'dm', 'group'));
exception when duplicate_object then null; end $$;
alter table public.channels add column if not exists dm_key text unique;   -- 'smallerUuid:largerUuid' for a DM

create table if not exists public.channel_members (
  channel_id  uuid not null references public.channels (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  org_id      uuid not null,
  added_by    uuid references public.profiles (id) on delete set null,
  added_at    timestamptz not null default now(),
  primary key (channel_id, profile_id)
);
create index if not exists channel_members_profile_idx on public.channel_members (profile_id);
alter table public.channel_members enable row level security;

create or replace function public.is_channel_member(p_channel uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.channel_members m where m.channel_id = p_channel and m.profile_id = auth.uid()) $$;
grant execute on function public.is_channel_member(uuid) to authenticated;

-- who can read a conversation: company channels by rank, DMs/groups by membership
create or replace function public.can_read_channel(p_channel uuid)
returns boolean language sql stable security definer set search_path = public as
$$
  select p_channel is null
      or exists (select 1 from public.channels c
                 where c.id = p_channel and c.org_id = public.current_org_id()
                   and case when c.kind = 'channel' then public.current_role_at_least(c.min_role)
                            else public.is_channel_member(c.id) end)
$$;

drop policy if exists channels_read on public.channels;
create policy channels_read on public.channels
  for select using (
    org_id = public.current_org_id()
    and case when kind = 'channel' then public.current_role_at_least(min_role) else public.is_channel_member(id) end
  );
-- coordinators manage company channels only; DMs and groups go through the functions below
drop policy if exists channels_manage on public.channels;
create policy channels_manage on public.channels
  for all using (org_id = public.current_org_id() and kind = 'channel' and public.current_role_at_least('coordinator'))
  with check (org_id = public.current_org_id() and kind = 'channel' and public.current_role_at_least('coordinator'));

drop policy if exists channel_members_read on public.channel_members;
create policy channel_members_read on public.channel_members
  for select using (org_id = public.current_org_id() and public.is_channel_member(channel_id));

-- open (or reuse) the direct conversation with another member of my company
create or replace function public.start_dm(p_other uuid)
returns uuid language plpgsql security definer set search_path = public as
$$
declare me uuid := auth.uid(); org uuid := public.current_org_id(); k text; ch uuid;
begin
  if me is null or not public.current_role_at_least('field') then raise exception 'not allowed'; end if;
  if p_other = me then raise exception 'pick someone else'; end if;
  if not exists (select 1 from public.profiles where id = p_other and org_id = org) then raise exception 'not in your company'; end if;
  k := case when me::text < p_other::text then me::text || ':' || p_other::text else p_other::text || ':' || me::text end;
  select id into ch from public.channels where dm_key = k;
  if ch is null then
    insert into public.channels (org_id, name, kind, dm_key, min_role, created_by) values (org, 'direct', 'dm', k, 'field', me) returning id into ch;
    insert into public.channel_members (channel_id, profile_id, org_id, added_by) values (ch, me, org, me), (ch, p_other, org, me);
  end if;
  return ch;
end
$$;
grant execute on function public.start_dm(uuid) to authenticated;

-- a private group of chosen members (creator included)
create or replace function public.create_group(p_name text, p_members uuid[])
returns uuid language plpgsql security definer set search_path = public as
$$
declare me uuid := auth.uid(); org uuid := public.current_org_id(); ch uuid; m uuid;
begin
  if me is null or not public.current_role_at_least('field') then raise exception 'not allowed'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name the group'; end if;
  insert into public.channels (org_id, name, kind, min_role, created_by) values (org, left(trim(p_name), 60), 'group', 'field', me) returning id into ch;
  insert into public.channel_members (channel_id, profile_id, org_id, added_by) values (ch, me, org, me);
  foreach m in array coalesce(p_members, '{}') loop
    if m <> me and exists (select 1 from public.profiles where id = m and org_id = org) then
      insert into public.channel_members (channel_id, profile_id, org_id, added_by) values (ch, m, org, me) on conflict do nothing;
    end if;
  end loop;
  return ch;
end
$$;
grant execute on function public.create_group(text, uuid[]) to authenticated;

-- members of a group add people, rename it, or leave it
create or replace function public.group_update(p_channel uuid, p_name text default null, p_add uuid[] default null, p_leave boolean default false)
returns void language plpgsql security definer set search_path = public as
$$
declare me uuid := auth.uid(); org uuid := public.current_org_id(); c public.channels; m uuid;
begin
  select * into c from public.channels where id = p_channel;
  if c.id is null or c.kind <> 'group' or c.org_id <> org or not public.is_channel_member(p_channel) then raise exception 'not allowed'; end if;
  if p_name is not null and trim(p_name) <> '' then update public.channels set name = left(trim(p_name), 60) where id = p_channel; end if;
  foreach m in array coalesce(p_add, '{}') loop
    if exists (select 1 from public.profiles where id = m and org_id = org) then
      insert into public.channel_members (channel_id, profile_id, org_id, added_by) values (p_channel, m, org, me) on conflict do nothing;
    end if;
  end loop;
  if p_leave then delete from public.channel_members where channel_id = p_channel and profile_id = me; end if;
end
$$;
grant execute on function public.group_update(uuid, text, uuid[], boolean) to authenticated;

-- unread counts: last time each person read each conversation
create table if not exists public.conversation_reads (
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  conv_key    text not null,          -- 'ch:all' | 'ch:<channel id>' | 'ext:<contact id>' | 'ext:num:<number>'
  read_at     timestamptz not null default now(),
  primary key (profile_id, conv_key)
);
alter table public.conversation_reads enable row level security;
drop policy if exists conversation_reads_own on public.conversation_reads;
create policy conversation_reads_own on public.conversation_reads
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

do $$ begin alter publication supabase_realtime add table public.channel_members; exception when duplicate_object then null; end $$;

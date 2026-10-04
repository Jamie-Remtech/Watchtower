-- ============================================================
-- Watchtower migration 0035: VIP, archive and delete for comms
-- VIP flags a message (anyone who can read the channel); archive moves
-- it out of the conversation (author or coordinator+); delete hides it
-- from everyone except coordinators, who can still read and restore it —
-- the operation's record is never truly lost. Every action is logged to
-- events (without the message text). VIP contacts' messages arrive
-- flagged.
-- ============================================================

alter table public.messages add column if not exists vip          boolean not null default false;
alter table public.messages add column if not exists vip_by       uuid references public.profiles (id) on delete set null;
alter table public.messages add column if not exists vip_at       timestamptz;
alter table public.messages add column if not exists archived_at  timestamptz;
alter table public.messages add column if not exists archived_by  uuid references public.profiles (id) on delete set null;
alter table public.messages add column if not exists deleted_at   timestamptz;
alter table public.messages add column if not exists deleted_by   uuid references public.profiles (id) on delete set null;
create index if not exists messages_vip_idx on public.messages (org_id, channel_id) where vip and deleted_at is null;

alter table public.contacts add column if not exists vip boolean not null default false;

-- deleted messages: only coordinators still see them
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages
  for select using (
    org_id = public.current_org_id()
    and public.can_read_channel(channel_id)
    and (deleted_at is null or public.current_role_at_least('coordinator'))
  );

create or replace function public.message_action(p_id bigint, p_action text)
returns public.messages language plpgsql security definer set search_path = public as
$$
declare m public.messages;
begin
  select * into m from public.messages where id = p_id;
  if m.id is null or m.org_id <> public.current_org_id() or not public.can_read_channel(m.channel_id) then
    raise exception 'message not found';
  end if;
  if not public.current_role_at_least('field') then raise exception 'not allowed'; end if;
  if p_action in ('archive', 'unarchive', 'delete') and m.sender is distinct from auth.uid() and not public.current_role_at_least('coordinator') then
    raise exception 'only the author or a coordinator can do that';
  end if;
  if p_action = 'restore' and not public.current_role_at_least('coordinator') then
    raise exception 'only a coordinator can restore messages';
  end if;

  if p_action = 'vip' then update public.messages set vip = true, vip_by = auth.uid(), vip_at = now() where id = p_id returning * into m;
  elsif p_action = 'unvip' then update public.messages set vip = false, vip_by = null, vip_at = null where id = p_id returning * into m;
  elsif p_action = 'archive' then update public.messages set archived_at = now(), archived_by = auth.uid() where id = p_id returning * into m;
  elsif p_action = 'unarchive' then update public.messages set archived_at = null, archived_by = null where id = p_id returning * into m;
  elsif p_action = 'delete' then update public.messages set deleted_at = now(), deleted_by = auth.uid() where id = p_id returning * into m;
  elsif p_action = 'restore' then update public.messages set deleted_at = null, deleted_by = null where id = p_id returning * into m;
  else raise exception 'unknown action %', p_action;
  end if;

  insert into public.events (org_id, actor_id, actor_kind, type, subject, payload)
  values (m.org_id, auth.uid(), 'user', 'comms.message_' || p_action, null,
          jsonb_build_object('message_id', m.id, 'channel_id', m.channel_id, 'source', m.source));
  return m;
end
$$;
grant execute on function public.message_action(bigint, text) to authenticated;

-- coordinators clear a channel: archive everything up to now
create or replace function public.archive_channel(p_channel uuid)
returns integer language plpgsql security definer set search_path = public as
$$
declare n integer;
begin
  if not public.current_role_at_least('coordinator') or not public.can_read_channel(p_channel) then
    raise exception 'only a coordinator can archive a channel';
  end if;
  update public.messages set archived_at = now(), archived_by = auth.uid()
   where org_id = public.current_org_id()
     and channel_id is not distinct from p_channel
     and archived_at is null and deleted_at is null and not vip;
  get diagnostics n = row_count;
  insert into public.events (org_id, actor_id, actor_kind, type, subject, payload)
  values (public.current_org_id(), auth.uid(), 'user', 'comms.channel_archived', null, jsonb_build_object('channel_id', p_channel, 'count', n));
  return n;
end
$$;
grant execute on function public.archive_channel(uuid) to authenticated;

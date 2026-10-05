import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getOrgId } from '../lib/org';

// Every conversation the member can see, in three sections:
//   group    — All hands, company channels, private groups
//   direct   — one-to-one with a team member
//   external — SMS / WhatsApp threads with outside contacts (or numbers)
// each with its last message and unread count (0041 conversation_reads).

export const EXTERNAL_SOURCES = ['sms', 'whatsapp'];

// Which conversation a message belongs to
export function convKeyOf(m) {
  if (EXTERNAL_SOURCES.includes(m.source) && (m.contact_id || m.external_from)) {
    return m.contact_id ? `ext:${m.contact_id}` : `ext:num:${String(m.external_from).replace(/^→\s*/, '')}`;
  }
  return `ch:${m.channel_id ?? 'all'}`;
}

export const useConversations = ({ myId, nameOf, contacts }) => {
  const [channels, setChannels] = useState([]);
  const [members, setMembers] = useState({});   // channel id → [profile ids]
  const [recent, setRecent] = useState([]);
  const [reads, setReads] = useState({});       // conv key → read_at ms
  const [loaded, setLoaded] = useState(false);
  const timer = useRef(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const org = await getOrgId();
    if (!org) return;
    const since = new Date(Date.now() - 30 * 86400e3).toISOString();
    const [{ data: ch }, { data: msgs }, { data: rd }] = await Promise.all([
      supabase.from('channels').select('*').eq('org_id', org).eq('archived', false).order('sort').order('created_at'),
      supabase.from('messages').select('id, channel_id, sender, text, at, source, contact_id, external_from, broadcast_id, archived_at, vip')
        .eq('org_id', org).is('deleted_at', null).gte('at', since).order('at', { ascending: false }).limit(1500),
      supabase.from('conversation_reads').select('conv_key, read_at'),
    ]);
    const chs = ch ?? [];
    const priv = chs.filter(c => (c.kind ?? 'channel') !== 'channel').map(c => c.id);
    let mem = {};
    if (priv.length) {
      const { data: cm } = await supabase.from('channel_members').select('channel_id, profile_id').in('channel_id', priv);
      for (const r of cm ?? []) (mem[r.channel_id] ??= []).push(r.profile_id);
    }
    setChannels(chs);
    setMembers(mem);
    setRecent(msgs ?? []);
    setReads(Object.fromEntries((rd ?? []).map(r => [r.conv_key, Date.parse(r.read_at)])));
    setLoaded(true);
  }, []);

  const soon = useCallback(() => { clearTimeout(timer.current); timer.current = setTimeout(refresh, 400); }, [refresh]);

  useEffect(() => {
    refresh();
    const sub = supabase
      .channel(`conversations-${Math.random().toString(36).slice(2, 10)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, soon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channels' }, soon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channel_members' }, soon)
      .subscribe();
    const id = setInterval(refresh, 60000);
    return () => { clearInterval(id); clearTimeout(timer.current); supabase.removeChannel(sub); };
  }, [refresh, soon]);

  const markRead = useCallback(async (key) => {
    setReads(r => ({ ...r, [key]: Date.now() }));
    await supabase.from('conversation_reads').upsert({ profile_id: myId, conv_key: key, read_at: new Date().toISOString() });
  }, [myId]);

  // ---------- build the list ----------
  const byKey = new Map();
  for (const m of recent) {
    const k = convKeyOf(m);
    const e = byKey.get(k) ?? { last: null, unread: 0 };
    if (!m.archived_at && !e.last) e.last = m;
    // never opened: only the last day counts as new (not 30 days of history)
    const readAt = reads[k] ?? Date.now() - 86400e3;
    if (m.sender !== myId && Date.parse(m.at) > readAt && !m.archived_at) e.unread++;
    byKey.set(k, e);
  }
  const stat = (k) => byKey.get(k) ?? { last: null, unread: 0 };
  const contactById = Object.fromEntries((contacts ?? []).map(c => [c.id, c]));

  const group = [
    { key: 'ch:all', type: 'channel', channelId: null, name: null, color: '#94a3b8', minRole: 'field', pinned: true, ...stat('ch:all') },
    ...channels.filter(c => (c.kind ?? 'channel') === 'channel').map(c => ({ key: `ch:${c.id}`, type: 'channel', channelId: c.id, name: c.name, color: c.color, minRole: c.min_role, description: c.description, ...stat(`ch:${c.id}`) })),
    ...channels.filter(c => c.kind === 'group').map(c => ({ key: `ch:${c.id}`, type: 'group', channelId: c.id, name: c.name, color: c.color, members: members[c.id] ?? [], createdBy: c.created_by, ...stat(`ch:${c.id}`) })),
  ];
  const direct = channels.filter(c => c.kind === 'dm').map(c => {
    const other = (members[c.id] ?? []).find(p => p !== myId);
    return { key: `ch:${c.id}`, type: 'dm', channelId: c.id, other, name: nameOf[other] ?? '—', members: members[c.id] ?? [], ...stat(`ch:${c.id}`) };
  });
  const external = [...byKey.keys()].filter(k => k.startsWith('ext:')).map(k => {
    const contactId = k.startsWith('ext:num:') ? null : k.slice(4);
    const number = k.startsWith('ext:num:') ? k.slice(8) : null;
    const c = contactId ? contactById[contactId] : null;
    return { key: k, type: 'external', contactId, number, name: c?.name ?? number ?? '—', agency: c?.agency ?? null, vip: !!c?.vip, contact: c ?? null, ...stat(k) };
  });
  const byRecent = (a, b) => (Date.parse(b.last?.at ?? 0) - Date.parse(a.last?.at ?? 0));
  const sections = {
    group: [group[0], ...group.slice(1).sort(byRecent)],
    direct: direct.sort(byRecent),
    external: external.sort((a, b) => Number(b.vip) - Number(a.vip) || byRecent(a, b)),
  };
  const totalUnread = [...group, ...direct, ...external].reduce((n, c) => n + c.unread, 0);

  return { sections, channels, members, totalUnread, markRead, refresh, loaded };
};

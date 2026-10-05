import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getOrgId } from '../lib/org';

// Live-synced comms data for my company: channels, contacts, broadcasts.
// Each hook instance gets its own realtime channel name (realtime-js reuses
// channels by topic, and a reused one throws on a second subscribe).

const useLiveTable = (table, query, deps = []) => {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const org = await getOrgId();
    if (!org) return;
    const { data } = await query(supabase.from(table).select('*').eq('org_id', org));
    setRows(data ?? []);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    refresh();
    const ch = supabase
      .channel(`${table}-live-${Math.random().toString(36).slice(2, 10)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, refresh)
      .subscribe();
    const id = setInterval(refresh, 120000);
    return () => { clearInterval(id); supabase.removeChannel(ch); };
  }, [refresh, table]);
  return { rows, loaded, refresh };
};

export const useChannels = () => {
  // company channels only — direct and group conversations live in useConversations
  const { rows: all, refresh } = useLiveTable('channels', q => q.eq('archived', false).order('sort').order('created_at'));
  const rows = all.filter(c => (c.kind ?? 'channel') === 'channel');
  const save = useCallback(async (ch) => {
    const org = await getOrgId();
    const row = { name: ch.name.trim().slice(0, 60), description: ch.description || null, color: ch.color || '#f97316', min_role: ch.min_role || 'field', sort: ch.sort ?? 0 };
    const { error } = ch.id
      ? await supabase.from('channels').update(row).eq('id', ch.id)
      : await supabase.from('channels').insert({ ...row, org_id: org });
    if (error) throw error;
    refresh();
  }, [refresh]);
  const archive = useCallback(async (id) => {
    const { error } = await supabase.from('channels').update({ archived: true }).eq('id', id);
    if (error) throw error;
    refresh();
  }, [refresh]);
  return { channels: rows, save, archive, refresh };
};

export const useContacts = () => {
  const { rows, loaded, refresh } = useLiveTable('contacts', q => q.order('name'));
  const save = useCallback(async (c) => {
    const org = await getOrgId();
    const row = {
      name: c.name.trim().slice(0, 120), agency: c.agency || null, role: c.role || null, phone: c.phone || null,
      email: c.email || null, whatsapp: c.whatsapp || null, telegram: c.telegram || null, radio: c.radio || null,
      notes: c.notes || null, groups: (c.groups ?? []).map(g => g.trim()).filter(Boolean), vip: !!c.vip, updated_at: new Date().toISOString(),
    };
    const { error } = c.id
      ? await supabase.from('contacts').update(row).eq('id', c.id)
      : await supabase.from('contacts').insert({ ...row, org_id: org });
    if (error) throw error;
    refresh();
  }, [refresh]);
  const importMany = useCallback(async (list) => {
    const org = await getOrgId();
    const { error } = await supabase.from('contacts').insert(list.map(c => ({ ...c, org_id: org })));
    if (error) throw error;
    refresh();
  }, [refresh]);
  const remove = useCallback(async (id) => {
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) throw error;
    refresh();
  }, [refresh]);
  const groups = [...new Set(rows.flatMap(c => c.groups ?? []))].sort();
  return { contacts: rows, loaded, groups, save, importMany, remove, refresh };
};

// Broadcasts from the last 7 days with their acknowledgements.
export const useBroadcasts = () => {
  const since = () => new Date(Date.now() - 7 * 86400e3).toISOString();
  const { rows, refresh } = useLiveTable('broadcasts', q => q.gte('created_at', since()).order('created_at', { ascending: false }));
  const { rows: acks, refresh: refreshAcks } = useLiveTable('broadcast_acks', q => q.gte('at', since()));
  const ack = useCallback(async (b, userId) => {
    const { error } = await supabase.from('broadcast_acks').insert({ broadcast_id: b.id, org_id: b.org_id, profile_id: userId, via: 'app' });
    if (error && !/duplicate/i.test(error.message)) throw error;
    refreshAcks();
  }, [refreshAcks]);
  const close = useCallback(async (id) => {
    const { error } = await supabase.from('broadcasts').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    refresh();
  }, [refresh]);
  return { broadcasts: rows, acks, ack, close, refresh };
};

import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Real presence: who actually has Watchtower open right now.
// Uses Supabase Realtime Presence — each signed-in client tracks
// itself on an org-scoped channel; everyone sees the live set.
// One channel per device, shared by every screen that asks: the topic
// must be the same across devices, and realtime-js hands back the same
// channel for the same topic, so per-hook channels would collide.

let channel = null;
let starting = false;
let online = new Set();
const listeners = new Set();
const emit = () => listeners.forEach(fn => fn(online));

async function start() {
  if (channel || starting || !isSupabaseConfigured) return;
  starting = true;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let orgId = localStorage.getItem('watchtower-org-id');
    if (!orgId) {
      const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
      orgId = prof?.org_id;
      if (orgId) localStorage.setItem('watchtower-org-id', orgId);
    }
    if (!orgId) return;
    channel = supabase.channel(`presence-${orgId}`, { config: { presence: { key: user.id } } });
    channel.on('presence', { event: 'sync' }, () => {
      online = new Set(Object.keys(channel.presenceState()));
      emit();
    });
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await channel.track({ at: new Date().toISOString() });
    });
  } catch { /* presence is best-effort */ } finally {
    starting = false;
  }
}

export const usePresence = () => {
  const [onlineIds, setOnlineIds] = useState(online);
  useEffect(() => {
    listeners.add(setOnlineIds);
    setOnlineIds(online);
    start();
    return () => { listeners.delete(setOnlineIds); };
  }, []);
  return onlineIds;
};

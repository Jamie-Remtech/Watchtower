import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Real presence: who actually has Watchtower open right now.
// Uses Supabase Realtime Presence — each signed-in client tracks
// itself on an org-scoped channel; everyone sees the live set.
export const usePresence = () => {
  const [onlineIds, setOnlineIds] = useState(new Set());

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let channel = null;
    let cancelled = false;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      let orgId = localStorage.getItem('watchtower-org-id');
      if (!orgId) {
        const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
        orgId = prof?.org_id;
        if (orgId) localStorage.setItem('watchtower-org-id', orgId);
      }
      if (!orgId || cancelled) return;

      channel = supabase.channel(`presence-${orgId}`, { config: { presence: { key: user.id } } });
      channel.on('presence', { event: 'sync' }, () => {
        if (!cancelled) setOnlineIds(new Set(Object.keys(channel.presenceState())));
      });
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ at: new Date().toISOString() });
        }
      });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return onlineIds;
};

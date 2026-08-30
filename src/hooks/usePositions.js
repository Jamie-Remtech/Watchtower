import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const POLL_MS = 20 * 1000;

// Latest team positions (one fix per person). Broadcasting one's own
// position is automatic — see lib/tracker.js.
export const usePositions = () => {
  const isLive = isSupabaseConfigured;
  const [latest, setLatest] = useState([]);       // newest fix per profile_id

  const refresh = useCallback(async () => {
    if (!isLive) return;
    const { data } = await supabase
      .from('positions')
      .select('*')
      .order('at', { ascending: false })
      .limit(300);
    if (!data) return;
    const byProfile = new Map();
    for (const p of data) if (!byProfile.has(p.profile_id)) byProfile.set(p.profile_id, p);
    setLatest([...byProfile.values()]);
  }, [isLive]);

  useEffect(() => {
    if (!isLive) return;
    refresh();
    const t = setInterval(refresh, POLL_MS);
    const channel = supabase
      .channel('positions-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'positions' }, refresh)
      .subscribe();
    return () => { clearInterval(t); supabase.removeChannel(channel); };
  }, [isLive, refresh]);

  return { isLive, latest, refresh };
};

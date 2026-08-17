import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const POLL_MS = 20 * 1000;
const SEND_MIN_MS = 15 * 1000;

// Latest team positions (one fix per person) + my own live sharing.
export const usePositions = () => {
  const isLive = isSupabaseConfigured;
  const [latest, setLatest] = useState([]);       // newest fix per profile_id
  const [sharing, setSharing] = useState(false);
  const [lastSent, setLastSent] = useState(null);
  const [shareError, setShareError] = useState(null);
  const watchRef = useRef(null);
  const lastSentAtRef = useRef(0);

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

  const stopSharing = useCallback(() => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setSharing(false);
  }, []);

  const startSharing = useCallback(async () => {
    if (!isLive || !navigator.geolocation) { setShareError('Geolocation unavailable'); return; }
    setShareError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
    if (!prof?.org_id) { setShareError('No organization on your profile'); return; }

    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastSentAtRef.current < SEND_MIN_MS) return; // throttle
        lastSentAtRef.current = now;
        const { error } = await supabase.from('positions').insert({
          org_id: prof.org_id,
          profile_id: user.id,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        });
        if (!error) setLastSent(new Date());
      },
      (err) => {
        setShareError(err.code === 1 ? 'Location permission denied' : 'Position unavailable');
        stopSharing();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    setSharing(true);
  }, [isLive, stopSharing]);

  useEffect(() => () => stopSharing(), [stopSharing]);

  return { isLive, latest, refresh, sharing, startSharing, stopSharing, lastSent, shareError };
};

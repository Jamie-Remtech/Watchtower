import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logEvent } from '../lib/eventLog';

// Marker kinds a rescuer actually needs, one tap away.
export const MARKER_KINDS = [
  { id: 'fire', icon: '🔥', label: 'Fire' },
  { id: 'medical', icon: '⛑️', label: 'Medical point' },
  { id: 'injured', icon: '🩹', label: 'Injured person' },
  { id: 'hazard', icon: '⚠️', label: 'Hazard' },
  { id: 'blocked', icon: '🚧', label: 'Road blocked' },
  { id: 'water', icon: '💧', label: 'Water source' },
  { id: 'staging', icon: '🚩', label: 'Staging area' },
  { id: 'vehicle', icon: '🚒', label: 'Vehicle' },
  { id: 'poi', icon: '📍', label: 'Point of interest' },
];

export const markerMeta = (kind) => MARKER_KINDS.find(k => k.id === kind) ?? MARKER_KINDS.at(-1);

const POLL_MS = 60 * 1000; // fallback only — realtime does the heavy lifting

// Shared tactical markers, synced live to the whole team via Supabase
// Realtime (with slow polling as a safety net).
export const useMarkers = () => {
  const isLive = isSupabaseConfigured;
  const [markers, setMarkers] = useState([]);

  const refresh = useCallback(async () => {
    if (!isLive) return;
    const { data } = await supabase
      .from('markers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setMarkers(data ?? []);
  }, [isLive]);

  useEffect(() => {
    if (!isLive) return;
    refresh();
    const t = setInterval(refresh, POLL_MS);
    const channel = supabase
      .channel('markers-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'markers' }, refresh)
      .subscribe();
    return () => { clearInterval(t); supabase.removeChannel(channel); };
  }, [isLive, refresh]);

  const createMarker = useCallback(async ({ kind, label, lat, lng, notes = null }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
    const { data, error } = await supabase
      .from('markers')
      .insert({ org_id: prof.org_id, kind, label, notes, lat, lng, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    await logEvent('marker.created', { kind, label, lat, lng }, data.id);
    await refresh();
    return data;
  }, [refresh]);

  const updateMarker = useCallback(async (id, patch) => {
    const { error } = await supabase.from('markers').update(patch).eq('id', id);
    if (error) throw error;
    await logEvent('marker.updated', patch, id);
    await refresh();
  }, [refresh]);

  const removeMarker = useCallback(async (id) => {
    const m = markers.find(x => x.id === id);
    const { error } = await supabase.from('markers').delete().eq('id', id);
    if (error) throw error;
    await logEvent('marker.removed', { kind: m?.kind, label: m?.label }, id);
    await refresh();
  }, [markers, refresh]);

  return { isLive, markers, refresh, createMarker, updateMarker, removeMarker };
};

import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logEvent } from '../lib/eventLog';
import { getOrgId } from '../lib/org';

// Marker kinds a rescuer actually needs, one tap away. Ids are stored on
// markers rows — never rename one. 'poi' must stay last (the fallback).
export const MARKER_KINDS = [
  { id: 'fire', icon: '🔥', label: 'Fire' },
  { id: 'medical', icon: '⛑️', label: 'Medical point' },
  { id: 'injured', icon: '🩹', label: 'Injured person' },
  { id: 'hazard', icon: '⚠️', label: 'Hazard' },
  { id: 'blocked', icon: '🚧', label: 'Road blocked' },
  { id: 'water', icon: '💧', label: 'Water source' },
  { id: 'staging', icon: '🚩', label: 'Staging area' },
  { id: 'rally', icon: '🏁', label: 'Rally point' },
  { id: 'helispot', icon: '🚁', label: 'Helicopter landing zone' },
  { id: 'command_post', icon: '🏢', label: 'Command post' },
  { id: 'shelter', icon: '⛺', label: 'Shelter' },
  { id: 'vehicle', icon: '🚒', label: 'Vehicle' },
  { id: 'poi', icon: '📍', label: 'Point of interest' },
];

// Company-defined kinds (map_config.custom_marker_kinds), registered by
// useMapConfig so markerMeta resolves them anywhere in the app.
let customKinds = [];
export function setCustomMarkerKinds(list) {
  customKinds = Array.isArray(list)
    ? list.filter(k => k && k.id).map(k => ({ id: String(k.id), icon: k.icon || '📍', label: k.label || '', custom: true }))
    : [];
}
export function getCustomMarkerKinds() { return customKinds; }

export function markerMeta(kind) {
  return MARKER_KINDS.find(k => k.id === kind) ?? customKinds.find(k => k.id === kind) ?? MARKER_KINDS[MARKER_KINDS.length - 1];
}

// Display name of a marker kind: translated for built-ins, the company's own words for custom ones.
export function markerKindLabel(t, kind) {
  const meta = markerMeta(kind);
  return meta.custom ? meta.label : t(`marker.${meta.id}`);
}

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
      .channel(`markers-live-${Math.random().toString(36).slice(2, 10)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'markers' }, refresh)
      .subscribe();
    return () => { clearInterval(t); supabase.removeChannel(channel); };
  }, [isLive, refresh]);

  const createMarker = useCallback(async ({ kind, label, lat, lng, notes = null }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const prof = { org_id: await getOrgId() }; // company being worked in (0040)
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

  // Bulk add (file import): one insert, one log entry.
  const createMarkers = useCallback(async (list) => {
    if (!list?.length) return [];
    const { data: { user } } = await supabase.auth.getUser();
    const prof = { org_id: await getOrgId() }; // company being worked in (0040)
    const rows = list.map(m => ({ org_id: prof.org_id, kind: m.kind || 'poi', label: m.label ?? '', notes: m.notes ?? null, lat: m.lat, lng: m.lng, created_by: user.id }));
    const { data, error } = await supabase.from('markers').insert(rows).select();
    if (error) throw error;
    await logEvent('marker.imported', { count: rows.length });
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

  return { isLive, markers, refresh, createMarker, createMarkers, updateMarker, removeMarker };
};

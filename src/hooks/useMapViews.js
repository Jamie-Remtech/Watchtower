import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logEvent } from '../lib/eventLog';

// Saved tactical views ("fronts"): shared org-wide, realtime-synced so
// every operator, tab, and popped-out window shows the same list.
export const useMapViews = () => {
  const isLive = isSupabaseConfigured;
  const [views, setViews] = useState([]);

  const refresh = useCallback(async () => {
    if (!isLive) return;
    const { data } = await supabase.from('map_views').select('*').order('created_at');
    setViews(data ?? []);
  }, [isLive]);

  useEffect(() => {
    if (!isLive) return;
    refresh();
    const t = setInterval(refresh, 60 * 1000); // safety net
    const channel = supabase
      .channel('map-views-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_views' }, refresh)
      .subscribe();
    return () => { clearInterval(t); supabase.removeChannel(channel); };
  }, [isLive, refresh]);

  const createView = useCallback(async ({ name, lat, lng, zoom, map_mode }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
    const { data, error } = await supabase
      .from('map_views')
      .insert({ org_id: prof.org_id, name, lat, lng, zoom, map_mode, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    await logEvent('mapview.created', { name, lat, lng, zoom }, data.id);
    await refresh();
    return data;
  }, [refresh]);

  const updateView = useCallback(async (id, patch) => {
    const { error } = await supabase.from('map_views').update(patch).eq('id', id);
    if (error) throw error;
    await logEvent('mapview.updated', patch, id);
    await refresh();
  }, [refresh]);

  const removeView = useCallback(async (id) => {
    const v = views.find(x => x.id === id);
    const { error } = await supabase.from('map_views').delete().eq('id', id);
    if (error) throw error;
    await logEvent('mapview.removed', { name: v?.name }, id);
    await refresh();
  }, [views, refresh]);

  return { isLive, views, refresh, createView, updateView, removeView };
};

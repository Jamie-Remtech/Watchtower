import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logEvent } from '../lib/eventLog';

// Device kinds with their channel costs (mirrors the device_kind enum).
export const DEVICE_KINDS = [
  { id: 'drone', label: 'Drone', icon: '🚁', cost: 8, desc: 'Flight AI + detection + control' },
  { id: 'ptz_camera', label: 'PTZ Camera', icon: '📹', cost: 2, desc: 'Pan/tilt/zoom + detection' },
  { id: 'camera', label: 'Fixed Camera', icon: '📷', cost: 1, desc: 'Detection only' },
  { id: 'sensor', label: 'Sensor', icon: '📡', cost: 1, desc: 'Weather, smoke, IR, telemetry' },
  { id: 'edge_box', label: 'Edge AI Box', icon: '🖥️', cost: 0, desc: 'On-site processing hardware' },
];

export const DEVICE_STATUSES = ['offline', 'active', 'maintenance'];

// Live device roster with management actions. Demo mode returns an empty
// list and isLive=false so callers keep their mock data.
export const useDevices = () => {
  const isLive = isSupabaseConfigured;
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(isLive);

  const refresh = useCallback(async () => {
    if (!isLive) return;
    const { data } = await supabase.from('devices').select('*').order('created_at');
    setDevices(data ?? []);
    setLoading(false);
  }, [isLive]);

  useEffect(() => { refresh(); }, [refresh]);

  const createDevice = useCallback(async ({ name, kind, status, lat, lng }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
    const cost = DEVICE_KINDS.find(k => k.id === kind)?.cost ?? 1;
    const { data, error } = await supabase
      .from('devices')
      .insert({ org_id: prof.org_id, name, kind, status, lat, lng, channel_cost: cost })
      .select()
      .single();
    if (error) throw error;
    await logEvent('device.registered', { name, kind, status }, data.id);
    await refresh();
    return data;
  }, [refresh]);

  const updateDevice = useCallback(async (id, patch) => {
    const { error } = await supabase
      .from('devices')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await logEvent('device.updated', patch, id);
    await refresh();
  }, [refresh]);

  const removeDevice = useCallback(async (id) => {
    const dev = devices.find(d => d.id === id);
    const { error } = await supabase.from('devices').delete().eq('id', id);
    if (error) throw error;
    await logEvent('device.removed', { name: dev?.name, kind: dev?.kind }, id);
    await refresh();
  }, [devices, refresh]);

  return { isLive, devices, loading, refresh, createDevice, updateDevice, removeDevice };
};

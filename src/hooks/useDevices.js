import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Live device roster. Demo mode returns null so callers keep their mock data.
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

  return { isLive, devices, loading, refresh };
};

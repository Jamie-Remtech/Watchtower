import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logEvent } from '../lib/eventLog';

// Multi-casualty roster: realtime-synced patients with SALT triage.
export const usePatients = () => {
  const isLive = isSupabaseConfigured;
  const [patients, setPatients] = useState([]);

  const refresh = useCallback(async () => {
    if (!isLive) return;
    const { data } = await supabase.from('patients').select('*').order('num');
    setPatients(data ?? []);
  }, [isLive]);

  useEffect(() => {
    if (!isLive) return;
    refresh();
    const t = setInterval(refresh, 60 * 1000);
    const channel = supabase
      .channel('patients-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, refresh)
      .subscribe();
    return () => { clearInterval(t); supabase.removeChannel(channel); };
  }, [isLive, refresh]);

  const createPatient = useCallback(async ({ tag = null, lat = null, lng = null } = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
    const num = (patients.reduce((m, p) => Math.max(m, p.num), 0) || 0) + 1;
    const { data, error } = await supabase
      .from('patients')
      .insert({ org_id: prof.org_id, num, tag, lat, lng, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    logEvent('patient.created', { num, tag, lat, lng }, data.id);
    await refresh();
    return data;
  }, [patients, refresh]);

  const updatePatient = useCallback(async (id, patch, eventType = 'patient.updated') => {
    const { error } = await supabase
      .from('patients')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    logEvent(eventType, patch, id);
    await refresh();
  }, [refresh]);

  const counts = patients.reduce((acc, p) => {
    if (p.status === 'active') acc[p.triage] = (acc[p.triage] ?? 0) + 1;
    return acc;
  }, {});

  return { isLive, patients, counts, refresh, createPatient, updatePatient };
};

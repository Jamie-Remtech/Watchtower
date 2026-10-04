import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getOrgId } from '../lib/org';
import { saveRecord } from '../lib/patientRecord';

// Patient files (identity + medical) for the company, keyed by patient id.
// RLS returns nothing below field rank, so viewers simply see no names.
export const usePatientRecords = () => {
  const [records, setRecords] = useState({});

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const org = await getOrgId();
    if (!org) return;
    const { data } = await supabase.from('patient_records').select('*').eq('org_id', org);
    setRecords(Object.fromEntries((data ?? []).map(r => [r.patient_id, r])));
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    refresh();
    const channel = supabase
      .channel(`patient-records-${Math.random().toString(36).slice(2, 10)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_records' }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  const save = useCallback(async (patientId, draft) => {
    const row = await saveRecord(patientId, draft);
    setRecords(r => ({ ...r, [patientId]: row }));
    return row;
  }, []);

  return { records, refresh, save };
};

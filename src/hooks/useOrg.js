import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// The organization shown in the shell, read from the real row.
export const useOrg = () => {
  const [org, setOrg] = useState({ name: '…', region: '', tier: '' });

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.from('organizations').select('*').limit(1).single();
      if (!cancelled && data) setOrg(data);
    };
    load();
    window.addEventListener('watchtower-org-updated', load);
    return () => { cancelled = true; window.removeEventListener('watchtower-org-updated', load); };
  }, []);

  return org;
};

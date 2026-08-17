import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// The organization shown in the shell, read from the real row.
export const useOrg = () => {
  const [org, setOrg] = useState({ name: '…', region: '', tier: '' });

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('organizations').select('*').limit(1).single();
      if (!cancelled && data) setOrg(data);
    })();
    return () => { cancelled = true; };
  }, []);

  return org;
};

import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { orgData } from '../data/org';

// The organization shown in the shell. Live mode reads the real row;
// demo mode uses the simulated org.
export const useOrg = () => {
  const [org, setOrg] = useState(
    isSupabaseConfigured
      ? { name: '…', region: '', tier: '' }
      : { name: orgData.name, region: orgData.region, tier: orgData.tier }
  );

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

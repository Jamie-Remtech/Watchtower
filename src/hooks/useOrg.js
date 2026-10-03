import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';

// The member's own organization (platform staff can read every
// company, so this always filters on the profile's org_id).
export const useOrg = () => {
  const { profile } = useAuth() ?? {};
  const orgId = profile?.org_id;
  const [org, setOrg] = useState({ name: '…', region: '', tier: '' });

  useEffect(() => {
    if (!isSupabaseConfigured || !orgId) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.from('organizations').select('*').eq('id', orgId).single();
      if (!cancelled && data) setOrg(data);
    };
    load();
    window.addEventListener('watchtower-org-updated', load);
    return () => { cancelled = true; window.removeEventListener('watchtower-org-updated', load); };
  }, [orgId]);

  return org;
};

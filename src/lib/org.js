import { supabase } from './supabase';

// The signed-in member's own company. Platform staff can READ every
// company and linked coordinators can read linked ones, so any query
// meant as "my company" must filter on this id explicitly — RLS alone
// returns more than one company for those people.
const KEY = 'watchtower-org-id';

export const cachedOrgId = () => {
  try { return localStorage.getItem(KEY); } catch { return null; }
};

export const setCachedOrgId = (id) => {
  try { if (id) localStorage.setItem(KEY, id); } catch { /* storage unavailable */ }
};

export async function getOrgId() {
  const cached = cachedOrgId();
  if (cached) return cached;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
  setCachedOrgId(data?.org_id);
  return data?.org_id ?? null;
}

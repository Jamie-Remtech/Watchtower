import { supabase } from './supabase';

// The company the member is working in. For everyone that is their own
// company. The platform owner and system admins can switch in to view
// another company (0040) — then this is the company being viewed, and
// every "my company" screen follows; their own position and push
// registrations stay in the home company (getHomeOrgId).
// Platform staff can READ every company and linked coordinators can read
// linked ones, so any query meant as "my company" must filter on this id
// explicitly — RLS alone returns more than one company for those people.
const KEY = 'watchtower-org-id';

export const effectiveOrgOf = (p) =>
  (p?.acting_org_id && ['owner', 'staff'].includes(p?.platform_role) ? p.acting_org_id : p?.org_id) ?? null;

export const cachedOrgId = () => {
  try { return localStorage.getItem(KEY); } catch { return null; }
};

export const setCachedOrgId = (id) => {
  try { if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
};

export async function getOrgId() {
  const cached = cachedOrgId();
  if (cached) return cached;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('org_id, acting_org_id, platform_role').eq('id', user.id).single();
  const org = effectiveOrgOf(data);
  setCachedOrgId(org);
  return org;
}

// The member's own company, regardless of any company being viewed.
export async function getHomeOrgId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
  return data?.org_id ?? null;
}

// Platform staff: view another company (null = back home). Reloads the app
// so every screen starts fresh in the chosen company.
export async function switchCompany(orgId) {
  const { data, error } = await supabase.rpc('switch_company', { p_org: orgId });
  if (error) throw error;
  setCachedOrgId(null);
  window.location.assign('/?tab=world');
  return data;
}

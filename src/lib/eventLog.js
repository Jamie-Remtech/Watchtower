import { supabase, isSupabaseConfigured } from './supabase';
import { enqueueEvent } from './offlineQueue';

const ORG_CACHE_KEY = 'watchtower-org-id';

// Append an event to the org's operational log. This is the pattern-recording
// backbone: detections, registrations, acknowledgements, patient entries — all
// land here. Field entries carry a client timestamp in the payload so records
// stay truthful even when they sync late from a dead spot. Logging must never
// block or break the UX; offline failures are queued, not lost.
export async function logEvent(type, payload = {}, subject = null) {
  if (!isSupabaseConfigured) return;
  const stamped = { at_client: new Date().toISOString(), ...payload };
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let orgId = localStorage.getItem(ORG_CACHE_KEY);
    if (!orgId) {
      const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
      orgId = prof?.org_id;
      if (orgId) localStorage.setItem(ORG_CACHE_KEY, orgId);
    }
    if (!orgId) return;
    const row = {
      org_id: orgId,
      actor_id: user.id,
      actor_kind: 'user',
      type,
      subject,
      payload: stamped,
    };
    const { error } = await supabase.from('events').insert(row);
    if (error) enqueueEvent(row);
  } catch { /* fully offline — queue with cached identity if we have it */
    try {
      const orgId = localStorage.getItem(ORG_CACHE_KEY);
      if (orgId) enqueueEvent({ org_id: orgId, actor_kind: 'user', type, subject, payload: stamped });
    } catch { /* storage unavailable — nothing more we can do */ }
  }
}

import { supabase, isSupabaseConfigured } from './supabase';

// Append an event to the org's operational log. This is the pattern-recording
// backbone: detections, registrations, acknowledgements, protocol steps — all
// land here. Logging must never block or break the UX, so failures are silent.
export async function logEvent(type, payload = {}, subject = null) {
  if (!isSupabaseConfigured) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
    if (!prof?.org_id) return;
    await supabase.from('events').insert({
      org_id: prof.org_id,
      actor_id: user.id,
      actor_kind: 'user',
      type,
      subject,
      payload,
    });
  } catch { /* never block the app on event logging */ }
}

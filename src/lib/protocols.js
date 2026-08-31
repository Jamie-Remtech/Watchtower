import { supabase } from './supabase';
import { logEvent } from './eventLog';
import { pushToTeam } from './push';

// ============================================
// Protocol run plumbing shared by the Protocols tab and the
// attention bell's one-tap "Run protocol" launcher.
// ============================================

// Which playbook family answers a given attention item.
export const matchTriggerKind = (item) => {
  if (!item) return null;
  const t = `${item.title ?? ''} ${item.detail ?? ''}`.toLowerCase();
  if (item.kind === 'seismic') return 'seismic';
  if (item.kind === 'weather') return 'weather';
  if (item.kind === 'hazard' || item.kind === 'cascade') {
    if (/fire|smoke|burn|downwind/.test(t)) return 'wildfire';
    if (/rain|storm|flood|hail|snow|wind/.test(t)) return 'weather';
    if (/quake|seismic|landslide|tsunami|lahar|mudflow/.test(t)) return 'seismic';
  }
  return null;
};

// Start a live run: snapshot the steps, log it, alert the team.
export async function startProtocolRun(protocol, context = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  let orgId = localStorage.getItem('watchtower-org-id');
  if (!orgId) {
    const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', user?.id).single();
    orgId = prof?.org_id;
    if (orgId) localStorage.setItem('watchtower-org-id', orgId);
  }
  const { data, error } = await supabase.from('protocol_runs').insert({
    org_id: orgId,
    protocol_id: protocol.id,
    name: protocol.name,
    steps: (protocol.steps ?? []).map(s => ({ ...s, done: false, by: null, by_name: null, at: null })),
    context,
    started_by: user?.id,
  }).select().single();
  if (error) throw error;
  logEvent('protocol.run_started', { name: protocol.name, run_id: data.id, from_alert: context?.attention?.title ?? null });
  pushToTeam({
    kind: 'attention',
    title: `▶ Protocol started: ${protocol.name}`,
    body: context?.attention?.title
      ? `Triggered by: ${context.attention.title}. Open Protocols to work the checklist.`
      : 'Open Watchtower → Protocols to work the checklist with the team.',
    url: '/',
    tag: `protocol:${data.id}`,
  });
  return data;
}

// Best matching playbook for an attention item (newest of its kind).
export async function findProtocolForItem(item) {
  const kind = matchTriggerKind(item);
  if (!kind) return null;
  const { data } = await supabase
    .from('protocols').select('*')
    .eq('trigger_kind', kind)
    .order('updated_at', { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}

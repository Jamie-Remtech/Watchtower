import { supabase } from './supabase';
import { logEvent } from './eventLog';
import { pushToTeam } from './push';
import { startProtocolRun } from './protocols';

// ============================================
// AI ACTIONS — the assistant's hands.
// Every action runs through the ASKING USER's session, so RLS applies:
// the AI can never do more than the person talking to it. Each action
// is logged, and returns a short confirmation for the chat/voice reply.
// ============================================

const orgIdOf = async () => {
  let orgId = localStorage.getItem('watchtower-org-id');
  if (!orgId) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', user?.id).single();
    orgId = prof?.org_id;
    if (orgId) localStorage.setItem('watchtower-org-id', orgId);
  }
  return orgId;
};

export async function executeAiAction(action, askedQuestion) {
  const { name, input } = action;

  if (name === 'start_protocol') {
    const { data: protos } = await supabase.from('protocols').select('*');
    const wanted = String(input?.protocol_name ?? '').toLowerCase();
    const protocol = (protos ?? []).find(p => p.name.toLowerCase() === wanted)
      ?? (protos ?? []).find(p => p.name.toLowerCase().includes(wanted));
    if (!protocol) return `I could not find a protocol named "${input?.protocol_name}" in the library.`;
    const active = (await supabase.from('protocol_runs').select('id').eq('protocol_id', protocol.id).eq('status', 'active').limit(1)).data;
    if (active?.length) return `"${protocol.name}" is already running — check the Protocols tab.`;
    await startProtocolRun(protocol, { via: 'ai', asked: askedQuestion?.slice(0, 200) });
    logEvent('ai.action', { action: 'start_protocol', protocol: protocol.name });
    return `Started protocol "${protocol.name}" — the team has the checklist and was alerted.`;
  }

  if (name === 'send_team_message') {
    const text = String(input?.text ?? '').trim();
    if (!text) return 'No message text given — nothing sent.';
    const { data: { user } } = await supabase.auth.getUser();
    const orgId = await orgIdOf();
    const { data: prof } = await supabase.from('profiles').select('display_name').eq('id', user?.id).single();
    const { error } = await supabase.from('messages').insert({ org_id: orgId, sender: user?.id, text });
    if (error) throw error;
    pushToTeam({
      kind: 'message',
      title: `${prof?.display_name ?? 'Watchtower'} (via AI)`,
      body: text.slice(0, 140),
      url: '/',
      tag: 'comms',
    });
    logEvent('ai.action', { action: 'send_team_message', text: text.slice(0, 140) });
    return `Sent to the team: "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`;
  }

  if (name === 'raise_alert') {
    const severity = ['critical', 'warning', 'info'].includes(input?.severity) ? input.severity : 'warning';
    const title = String(input?.title ?? '').trim().slice(0, 140);
    if (!title) return 'No alert title given — nothing raised.';
    const orgId = await orgIdOf();
    const { error } = await supabase.from('attention_items').insert({
      org_id: orgId,
      dedupe_key: `ai:${Date.now()}`,
      severity,
      kind: 'ai',
      title,
      detail: `${String(input?.detail ?? '').slice(0, 400)} — raised via the AI assistant.`.trim(),
    });
    if (error) throw error;
    if (severity === 'critical') {
      pushToTeam({ kind: 'attention', title: `⚠ ${title}`, body: String(input?.detail ?? '').slice(0, 140), url: '/', tag: `ai-alert` });
    }
    logEvent('ai.action', { action: 'raise_alert', severity, title });
    return `Raised a ${severity} alert: "${title}"${severity === 'critical' ? ' — pushed to the team' : ''}.`;
  }

  return `Unknown action "${name}" — nothing done.`;
}

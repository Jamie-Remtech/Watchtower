import { supabase } from './supabase';
import { getOrgId } from './org';

// ============================================
// COMMS PLATFORM — the systems a company can plug into Watchtower.
// Each kind lists its settings (config, stored in the open), its secrets
// (write-only: the app can set them, nobody can read them back) and
// whether it can also bring messages IN.
// ============================================

export const GATEWAY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/comms-gateway`;

// field: [name, input type]   input: text | tel | email | url | password | list | groups | select:a|b
export const CONNECTOR_KINDS = [
  { id: 'twilio_sms', icon: '💬', family: 'people', config: [['from', 'tel'], ['recipients', 'list'], ['groups', 'groups']], secret: [['account_sid', 'text'], ['auth_token', 'password']], inbound: 'twilio' },
  { id: 'twilio_whatsapp', icon: '🟢', family: 'people', config: [['from', 'tel'], ['recipients', 'list'], ['groups', 'groups']], secret: [['account_sid', 'text'], ['auth_token', 'password']], inbound: 'twilio' },
  { id: 'resend', icon: '✉️', family: 'people', config: [['from', 'email'], ['recipients', 'list'], ['groups', 'groups']], secret: [['api_key', 'password']] },
  { id: 'sendgrid', icon: '📧', family: 'people', config: [['from', 'email'], ['recipients', 'list'], ['groups', 'groups']], secret: [['api_key', 'password']] },
  { id: 'teams', icon: '🟪', family: 'chat', config: [], secret: [['url', 'password']] },
  { id: 'slack', icon: '💼', family: 'chat', config: [], secret: [['url', 'password']] },
  { id: 'discord', icon: '🎮', family: 'chat', config: [], secret: [['url', 'password']] },
  { id: 'google_chat', icon: '🗨️', family: 'chat', config: [], secret: [['url', 'password']] },
  { id: 'telegram', icon: '✈️', family: 'chat', config: [['chat_id', 'text']], secret: [['bot_token', 'password']], inbound: 'telegram' },
  { id: 'pagerduty', icon: '📟', family: 'alerting', config: [], secret: [['routing_key', 'password']] },
  { id: 'radio', kind: 'webhook', icon: '📻', family: 'systems', preset: { source: 'radio' }, config: [], secret: [['url', 'url'], ['signing_secret', 'password'], ['header_name', 'text'], ['header_value', 'password']], inbound: 'key', secretOptional: true },
  { id: 'webhook', icon: '🔗', family: 'systems', config: [], secret: [['url', 'url'], ['signing_secret', 'password'], ['header_name', 'text'], ['header_value', 'password']], inbound: 'key', secretOptional: true },
  { id: 'cap', icon: '📢', family: 'alerting', config: [['hours', 'text']], secret: [], inbound: 'cap', noOutbound: true },
];
export const FAMILIES = ['people', 'chat', 'alerting', 'systems'];

// A stored connector row → its catalog entry (radio is a webhook preset)
export const kindOf = (c) => CONNECTOR_KINDS.find(k => k.id === (c.config?.source === 'radio' && c.kind === 'webhook' ? 'radio' : c.kind)) ?? CONNECTOR_KINDS.find(k => k.id === 'webhook');

export const randomKey = (prefix = 'wtc_') => {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return prefix + btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const sha256 = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');

export async function saveConnector({ id, kind, name, enabled, config, routes, inbound_enabled, inbound_channel }) {
  const org = await getOrgId();
  const row = { kind, name, enabled, config, routes, inbound_enabled, inbound_channel: inbound_channel || null };
  const res = id
    ? await supabase.from('connectors').update(row).eq('id', id).select().single()
    : await supabase.from('connectors').insert({ ...row, org_id: org }).select().single();
  if (res.error) throw res.error;
  return res.data;
}

export async function setSecret(connectorId, secret, hint) {
  const { error } = await supabase.rpc('set_connector_secret', { p_connector: connectorId, p_secret: secret, p_hint: hint ?? null });
  if (error) throw error;
}

// A fresh inbound key (webhooks, radio gateways) or CAP feed key — shown once.
export async function newInboundKey(connectorId) {
  const key = randomKey();
  const { error } = await supabase.from('connectors').update({ inbound_key_hash: await sha256(key), inbound_key_hint: key.slice(-4) }).eq('id', connectorId);
  if (error) throw error;
  return key;
}

export async function testConnector(connectorId) {
  const { data, error } = await supabase.functions.invoke('comms-dispatch', { body: { type: 'test', connector_id: connectorId } });
  if (error) throw error;
  return data;
}

export async function connectTelegram(connectorId) {
  const { data, error } = await supabase.functions.invoke('comms-dispatch', { body: { type: 'telegram_setup', connector_id: connectorId } });
  if (error) throw error;
  return data;
}

// Device-native ways to reach a contact
export const contactLinks = (c) => [
  c.phone && { k: 'call', href: `tel:${c.phone.replace(/[^\d+]/g, '')}` },
  c.phone && { k: 'sms', href: `sms:${c.phone.replace(/[^\d+]/g, '')}` },
  (c.whatsapp || c.phone) && { k: 'whatsapp', href: `https://wa.me/${String(c.whatsapp || c.phone).replace(/\D/g, '')}` },
  c.email && { k: 'email', href: `mailto:${c.email}` },
  c.telegram && { k: 'telegram', href: `https://t.me/${c.telegram.replace(/^@/, '')}` },
].filter(Boolean);

// "name,agency,role,phone,email,groups" with a header row → contact rows
export function parseContactsCsv(text) {
  const rows = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(splitCsv);
  if (!rows.length) return [];
  const head = rows[0].map(h => h.toLowerCase().trim());
  const has = head.includes('name');
  const cols = has ? head : ['name', 'agency', 'role', 'phone', 'email', 'groups'];
  return (has ? rows.slice(1) : rows).map(r => {
    const o = {};
    cols.forEach((c, i) => { o[c] = (r[i] ?? '').trim(); });
    return {
      name: o.name, agency: o.agency || o.organization || o.organisation || null, role: o.role || o.title || null,
      phone: o.phone || o.mobile || o.cell || null, email: o.email || null, whatsapp: o.whatsapp || null,
      telegram: o.telegram || null, radio: o.radio || o.callsign || null, notes: o.notes || null,
      groups: (o.groups || o.group || '').split(/[;|]/).map(g => g.trim()).filter(Boolean),
    };
  }).filter(c => c.name);
}

function splitCsv(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

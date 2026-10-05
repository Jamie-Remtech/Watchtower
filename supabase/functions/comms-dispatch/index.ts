// ============================================================
// Watchtower edge function: comms-dispatch
// Sends what happens in Watchtower out to each company's own systems.
//   POST {type:'message'|'broadcast'|'alert', id}   ← database triggers (0033)
//   POST {type:'test', connector_id}                 ← Settings → Integrations (coordinator+)
//   POST {type:'telegram_setup', connector_id}       ← registers the Telegram webhook (two-way)
// Every attempt is written to comms_deliveries; a connector never gets
// the same item twice, and never gets back what it sent in.
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'content-type': 'application/json' } });

type Row = Record<string, any>;
type Result = { target: string; ok: boolean; detail: string };

const SUPA = Deno.env.get('SUPABASE_URL')!;
const SVC = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const H = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' };
const q = async (path: string): Promise<any> => (await fetch(`${SUPA}/rest/v1/${path}`, { headers: H })).json();
const post = (table: string, body: unknown) => fetch(`${SUPA}/rest/v1/${table}`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body) });
const patch = (path: string, body: unknown) => fetch(`${SUPA}/rest/v1/${path}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body) });

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function hmac256(key: string, data: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)));
}
async function sha256(s: string) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); }

// "(514) 883-2224" → "+15148832224" (North American 10-digit numbers get +1)
function e164(n: string) {
  const s = String(n ?? '').trim().replace(/^whatsapp:/, '');
  const d = s.replace(/\D/g, '');
  if (s.startsWith('+')) return `+${d}`;
  if (d.length === 10) return `+1${d}`;
  return `+${d}`;
}

const PERSON_KINDS =['twilio_sms', 'twilio_whatsapp', 'resend', 'sendgrid'];
const SEV_ICON: Record<string, string> = { emergency: '🚨', urgent: '⚠️', info: 'ℹ️', critical: '🚨', warning: '⚠️' };

// ---------- what to say ----------
type Item = { refType: string; refId: string; orgId: string; subject: string; text: string; severity: string; data: Row; channelId?: string | null; fromConnector?: string | null; fromSource?: string; audience?: Row };

async function loadItem(type: string, id: string): Promise<Item | null> {
  if (type === 'message') {
    const [m] = await q(`messages?id=eq.${encodeURIComponent(id)}&select=*`);
    if (!m) return null;
    const [ch] = m.channel_id ? await q(`channels?id=eq.${m.channel_id}&select=name,kind`) : [null];
    // direct and group conversations are private — never relayed to outside systems
    if (ch && ch.kind && ch.kind !== 'channel') return null;
    let who = m.external_from as string | null;
    if (!who && m.sender) { const [p] = await q(`profiles?id=eq.${m.sender}&select=display_name`); who = p?.display_name ?? null; }
    const where = ch?.name ?? 'All hands';
    return {
      refType: 'message', refId: String(m.id), orgId: m.org_id, subject: `[${where}] ${who ?? 'Watchtower'}`,
      text: `[${where}] ${who ?? 'Watchtower'}: ${m.text}`, severity: m.source === 'broadcast' ? 'urgent' : 'info',
      data: { channel: where, channel_id: m.channel_id, from: who, text: m.text, source: m.source, at: m.at, meta: m.meta ?? null },
      channelId: m.channel_id, fromConnector: m.connector_id, fromSource: m.source,
    };
  }
  if (type === 'broadcast') {
    const [b] = await q(`broadcasts?id=eq.${encodeURIComponent(id)}&select=*`);
    if (!b) return null;
    const [p] = b.created_by ? await q(`profiles?id=eq.${b.created_by}&select=display_name`) : [null];
    const head = `${SEV_ICON[b.severity] ?? ''} ${b.severity === 'emergency' ? 'EMERGENCY' : b.severity === 'urgent' ? 'URGENT' : 'NOTICE'} — ${b.title}`.trim();
    const text = [head, b.body, b.lat != null ? `Location: ${Number(b.lat).toFixed(5)}, ${Number(b.lng).toFixed(5)}` : null, p?.display_name ? `— ${p.display_name}` : null, b.require_ack ? 'Reply OK to acknowledge.' : null].filter(Boolean).join('\n');
    return { refType: 'broadcast', refId: b.id, orgId: b.org_id, subject: head, text, severity: b.severity, data: { ...b, from: p?.display_name ?? null }, audience: b.audience ?? {} };
  }
  if (type === 'alert') {
    const [a] = await q(`attention_items?id=eq.${encodeURIComponent(id)}&select=*`);
    if (!a) return null;
    const head = `${SEV_ICON[a.severity] ?? ''} ${a.severity.toUpperCase()}: ${a.title}`.trim();
    return { refType: 'alert', refId: a.id, orgId: a.org_id, subject: head, text: [head, a.detail].filter(Boolean).join('\n'), severity: a.severity, data: { title: a.title, detail: a.detail, severity: a.severity, kind: a.kind, source: a.source, at: a.created_at } };
  }
  return null;
}

function routed(c: Row, item: Item): boolean {
  const r = c.routes ?? {};
  if (item.refType === 'test') return true;
  if (item.refType === 'broadcast') {
    const list = item.audience?.connectors;
    return Array.isArray(list) ? list.includes(c.id) : !!r.broadcasts;
  }
  if (item.refType === 'alert') return Array.isArray(r.alerts) && r.alerts.includes(item.severity);
  if (item.refType === 'message') {
    if (item.fromConnector && item.fromConnector === c.id) return false;          // never echo back
    if (item.fromSource === 'webhook' && c.kind === 'webhook') return false;      // no webhook ping-pong
    const chans: string[] = Array.isArray(r.channels) ? r.channels : [];
    return chans.includes('*') || chans.includes(item.channelId ?? 'general');
  }
  return false;
}

// people a person-addressed connector writes to
async function recipients(c: Row, item: Item): Promise<string[]> {
  const field = c.kind === 'twilio_sms' ? 'phone' : c.kind === 'twilio_whatsapp' ? 'whatsapp' : 'email';
  const out = new Set<string>();
  for (const r of (c.config?.recipients ?? []) as string[]) if (String(r).trim()) out.add(String(r).trim());
  const groups = new Set<string>([...(c.config?.groups ?? [])]);
  const ids = new Set<string>();
  if (item.refType === 'broadcast') {
    for (const g of item.audience?.groups ?? []) groups.add(g);
    for (const id of item.audience?.contacts ?? []) ids.add(id);
  }
  if (groups.size || ids.size) {
    const contacts: Row[] = await q(`contacts?org_id=eq.${item.orgId}&select=id,phone,whatsapp,email,groups`);
    for (const ct of contacts ?? []) {
      if (!(ids.has(ct.id) || (ct.groups ?? []).some((g: string) => groups.has(g)))) continue;
      const v = ct[field] || (field === 'whatsapp' ? ct.phone : null);
      if (v) out.add(String(v).trim());
    }
  }
  return [...out].slice(0, 200);
}

// ---------- senders ----------
async function send(c: Row, secret: Row, item: Item): Promise<Result[]> {
  const cfg = c.config ?? {};
  const short = item.text.length > 1500 ? item.text.slice(0, 1497) + '…' : item.text;
  const res = async (target: string, r: Response): Promise<Result> => {
    const body = await r.text().catch(() => '');
    return { target, ok: r.ok, detail: r.ok ? `HTTP ${r.status}` : `HTTP ${r.status} ${body.slice(0, 200)}` };
  };
  switch (c.kind) {
    case 'twilio_sms':
    case 'twilio_whatsapp': {
      const sid = secret.account_sid, tok = secret.auth_token;
      if (!sid || !tok || !cfg.from) return [{ target: '-', ok: false, detail: 'Account SID, auth token and From number are required' }];
      const wa = c.kind === 'twilio_whatsapp';
      const to = [...new Set((await recipients(c, item)).map(e164))];
      if (!to.length) return [{ target: '-', ok: false, detail: 'no recipients (add numbers or contact groups)' }];
      const from = e164(String(cfg.from).replace(/^whatsapp:/, ''));
      const out: Result[] = [];
      for (const n of to) {
        const form = new URLSearchParams({ To: wa ? `whatsapp:${n}` : n, From: wa ? `whatsapp:${from}` : from, Body: short });
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: 'POST', headers: { Authorization: `Basic ${btoa(`${sid}:${tok}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form,
        });
        out.push(await res(n, r));
      }
      return out;
    }
    case 'resend':
    case 'sendgrid': {
      if (!secret.api_key || !cfg.from) return [{ target: '-', ok: false, detail: 'API key and From address are required' }];
      const to = await recipients(c, item);
      if (!to.length) return [{ target: '-', ok: false, detail: 'no recipients (add addresses or contact groups)' }];
      const r = c.kind === 'resend'
        ? await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${secret.api_key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: cfg.from, to, subject: item.subject.slice(0, 200), text: item.text }) })
        : await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { Authorization: `Bearer ${secret.api_key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ personalizations: [{ to: to.map(email => ({ email })) }], from: { email: cfg.from }, subject: item.subject.slice(0, 200), content: [{ type: 'text/plain', value: item.text }] }) });
      return [await res(to.join(', ').slice(0, 200), r)];
    }
    case 'slack':
    case 'discord':
    case 'google_chat':
    case 'teams': {
      if (!secret.url) return [{ target: '-', ok: false, detail: 'webhook URL is required' }];
      const body = c.kind === 'slack' ? { text: item.text }
        : c.kind === 'discord' ? { content: item.text.slice(0, 1990), username: 'Watchtower' }
        : c.kind === 'google_chat' ? { text: item.text }
        : { type: 'message', attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: { $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', type: 'AdaptiveCard', version: '1.4', body: [{ type: 'TextBlock', text: item.subject, weight: 'Bolder', wrap: true, color: ['critical', 'emergency'].includes(item.severity) ? 'Attention' : 'Default' }, { type: 'TextBlock', text: item.text, wrap: true }] } }] };
      const r = await fetch(secret.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return [await res(new URL(secret.url).host, r)];
    }
    case 'telegram': {
      if (!secret.bot_token || !cfg.chat_id) return [{ target: '-', ok: false, detail: 'bot token and chat ID are required' }];
      const r = await fetch(`https://api.telegram.org/bot${secret.bot_token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: cfg.chat_id, text: item.text.slice(0, 4000) }) });
      return [await res(`chat ${cfg.chat_id}`, r)];
    }
    case 'pagerduty': {
      if (!secret.routing_key) return [{ target: '-', ok: false, detail: 'routing key is required' }];
      const sev = ['critical', 'emergency'].includes(item.severity) ? 'critical' : ['warning', 'urgent'].includes(item.severity) ? 'warning' : 'info';
      const r = await fetch('https://events.pagerduty.com/v2/enqueue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ routing_key: secret.routing_key, event_action: 'trigger', dedup_key: `watchtower:${item.refType}:${item.refId}`, payload: { summary: item.subject.slice(0, 1000), source: 'Watchtower', severity: sev, custom_details: item.data } }) });
      return [await res('PagerDuty', r)];
    }
    case 'webhook': {
      if (!secret.url) return [{ target: '-', ok: false, detail: 'URL is required' }];
      const payload = JSON.stringify({ event: item.refType, id: item.refId, org_id: item.orgId, sent_at: new Date().toISOString(), severity: item.severity, title: item.subject, text: item.text, data: item.data });
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'User-Agent': 'Watchtower-Webhook/1' };
      if (secret.signing_secret) headers['X-Watchtower-Signature'] = `sha256=${await hmac256(secret.signing_secret, payload)}`;
      if (secret.header_name && secret.header_value) headers[String(secret.header_name)] = String(secret.header_value);
      const r = await fetch(secret.url, { method: 'POST', headers, body: payload });
      return [await res(new URL(secret.url).host, r)];
    }
    default:
      return [{ target: '-', ok: false, detail: `nothing to send for ${c.kind}` }];
  }
}

async function deliver(c: Row, item: Item) {
  const [sec] = await q(`connector_secrets?connector_id=eq.${c.id}&select=secret`);
  let results: Result[];
  try { results = await send(c, sec?.secret ?? {}, item); }
  catch (e) { results = [{ target: '-', ok: false, detail: String(e).slice(0, 200) }]; }
  await post('comms_deliveries', results.map(r => ({ org_id: item.orgId, connector_id: c.id, ref_type: item.refType, ref_id: item.refId, target: r.target, status: r.ok ? 'sent' : 'failed', detail: r.detail })));
  const failed = results.filter(r => !r.ok);
  await patch(`connectors?id=eq.${c.id}`, failed.length
    ? { last_error: failed[0].detail, last_error_at: new Date().toISOString(), ...(failed.length < results.length ? { last_ok_at: new Date().toISOString() } : {}) }
    : { last_ok_at: new Date().toISOString(), last_error: null });
  return results;
}

// caller must be coordinator+ in the connector's company
async function authorize(req: Request, connectorId: string): Promise<Row | null> {
  const auth = req.headers.get('Authorization') ?? '';
  const u = await fetch(`${SUPA}/auth/v1/user`, { headers: { apikey: SVC, Authorization: auth } });
  if (!u.ok) return null;
  const user = await u.json();
  const [p] = await q(`profiles?id=eq.${user.id}&select=org_id,role`);
  const [c] = await q(`connectors?id=eq.${encodeURIComponent(connectorId)}&select=*`);
  if (!p || !c || c.org_id !== p.org_id || !['coordinator', 'admin'].includes(p.role)) return null;
  return c;
}

// any field+ member of a company (direct SMS, call bridge)
async function member(req: Request): Promise<Row | null> {
  const u = await fetch(`${SUPA}/auth/v1/user`, { headers: { apikey: SVC, Authorization: req.headers.get('Authorization') ?? '' } });
  if (!u.ok) return null;
  const user = await u.json();
  const [p] = await q(`profiles?id=eq.${user.id}&select=id,org_id,role,display_name,mobile`);
  return p && ['field', 'operator', 'coordinator', 'admin'].includes(p.role) ? p : null;
}
const xmlEsc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// SMS / WhatsApp to one contact from the company line, and the call bridge:
// Twilio rings the member's own mobile, then connects them to the contact
// with the company number as caller ID — works from any computer.
async function direct(req: Request, body: Row) {
  const me = await member(req);
  if (!me) return json({ error: 'not allowed' }, 403);
  const [ct] = await q(`contacts?id=eq.${encodeURIComponent(body.contact_id ?? '')}&org_id=eq.${me.org_id}&select=*`);
  if (!ct) return json({ error: 'contact not found' }, 404);
  const wa = body.via === 'whatsapp';
  const [c] = await q(`connectors?org_id=eq.${me.org_id}&enabled=eq.true&kind=eq.${wa ? 'twilio_whatsapp' : 'twilio_sms'}&secret_set=eq.true&order=created_at&limit=1&select=*`);
  if (!c) return json({ error: 'no_line' }, 400);
  const [sec] = await q(`connector_secrets?connector_id=eq.${c.id}&select=secret`);
  const sid = sec?.secret?.account_sid, tok = sec?.secret?.auth_token;
  if (!sid || !tok) return json({ error: 'no_line' }, 400);
  const from = e164(c.config?.from ?? '');
  const auth = { Authorization: `Basic ${btoa(`${sid}:${tok}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' };

  if (body.type === 'call') {
    const mine = me.mobile ? e164(me.mobile) : '';
    if (!/^\+\d{8,15}$/.test(mine)) return json({ error: 'no_mobile' }, 400);
    const to = e164(ct.phone ?? ct.whatsapp ?? '');
    if (!/^\+\d{8,15}$/.test(to)) return json({ error: 'no_number' }, 400);
    const twiml = `<Response><Say>Watchtower. Connecting you to ${xmlEsc(ct.name)}.</Say><Dial callerId="${from}" timeout="30">${to}</Dial></Response>`;
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, { method: 'POST', headers: auth, body: new URLSearchParams({ To: mine, From: from, Twiml: twiml }) });
    const detail = r.ok ? `HTTP ${r.status}` : `HTTP ${r.status} ${(await r.text()).slice(0, 200)}`;
    await post('comms_deliveries', { org_id: me.org_id, connector_id: c.id, ref_type: 'call', ref_id: ct.id, target: `${me.display_name ?? ''} → ${ct.name}`.slice(0, 200), status: r.ok ? 'sent' : 'failed', detail });
    await post('events', { org_id: me.org_id, actor_id: me.id, actor_kind: 'user', type: 'comms.call', payload: { contact_id: ct.id, contact: ct.name, ok: r.ok } });
    return json(r.ok ? { ok: true, ringing: mine.slice(-4) } : { error: detail }, r.ok ? 200 : 502);
  }

  const text = String(body.text ?? '').trim().slice(0, 1500);
  if (!text) return json({ error: 'empty' }, 400);
  const to = e164(wa ? (ct.whatsapp || ct.phone || '') : (ct.phone ?? ''));
  if (!/^\+\d{8,15}$/.test(to)) return json({ error: 'no_number' }, 400);
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST', headers: auth, body: new URLSearchParams({ To: wa ? `whatsapp:${to}` : to, From: wa ? `whatsapp:${from}` : from, Body: text }),
  });
  const detail = r.ok ? `HTTP ${r.status}` : `HTTP ${r.status} ${(await r.text()).slice(0, 200)}`;
  await post('comms_deliveries', { org_id: me.org_id, connector_id: c.id, ref_type: 'message', ref_id: `direct:${ct.id}`, target: to, status: r.ok ? 'sent' : 'failed', detail });
  if (!r.ok) return json({ error: detail }, 502);
  // the conversation keeps it, next to the replies (same channel the line brings replies into)
  await post('messages', {
    org_id: me.org_id, sender: me.id, text, source: wa ? 'whatsapp' : 'sms', external_from: `→ ${ct.name}`,
    contact_id: ct.id, connector_id: c.id, channel_id: c.inbound_channel ?? null, meta: { direction: 'out', to },
  });
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json();
    const { type, id, connector_id } = body;
    if (type === 'direct_sms' || type === 'call') return await direct(req, body);

    if (type === 'test' || type === 'telegram_setup') {
      const c = await authorize(req, connector_id);
      if (!c) return json({ error: 'not allowed' }, 403);
      if (type === 'telegram_setup') {
        const [sec] = await q(`connector_secrets?connector_id=eq.${c.id}&select=secret`);
        const tok = sec?.secret?.bot_token;
        if (!tok) return json({ error: 'save the bot token first' }, 400);
        const r = await fetch(`https://api.telegram.org/bot${tok}/setWebhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: `${SUPA}/functions/v1/comms-gateway?c=${c.id}`, secret_token: (await sha256(`${tok}:${c.id}`)).slice(0, 64), allowed_updates: ['message', 'channel_post'] }) });
        const j = await r.json().catch(() => ({}));
        return json({ ok: r.ok && j.ok, detail: j.description ?? `HTTP ${r.status}` });
      }
      const [org] = await q(`organizations?id=eq.${c.org_id}&select=name`);
      const item: Item = { refType: 'test', refId: crypto.randomUUID(), orgId: c.org_id, subject: 'Watchtower test', text: `✅ Watchtower test from ${org?.name ?? 'your company'} — this connection works.`, severity: 'info', data: { test: true } };
      const results = await deliver(c, item);
      return json({ results });
    }

    const item = await loadItem(type, String(id ?? ''));
    if (!item) return json({ error: 'not found' }, 404);
    const connectors: Row[] = await q(`connectors?org_id=eq.${item.orgId}&enabled=eq.true&kind=neq.cap&select=*`);
    const done: Row[] = await q(`comms_deliveries?org_id=eq.${item.orgId}&ref_type=eq.${item.refType}&ref_id=eq.${encodeURIComponent(item.refId)}&select=connector_id`);
    const already = new Set((done ?? []).map(d => d.connector_id));
    let targets = (connectors ?? []).filter(c => routed(c, item) && !already.has(c.id));
    // a broadcast to contacts goes out on the company's person-addressed connectors even if none was ticked
    if (item.refType === 'broadcast' && ((item.audience?.groups ?? []).length || (item.audience?.contacts ?? []).length) && !targets.some(c => PERSON_KINDS.includes(c.kind))) {
      targets = targets.concat((connectors ?? []).filter(c => PERSON_KINDS.includes(c.kind) && !already.has(c.id)));
    }
    const summary: Row[] = [];
    for (const c of targets) summary.push({ connector: c.name, results: await deliver(c, item) });
    return json({ item: item.refType, sent: summary });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

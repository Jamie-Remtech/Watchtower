import { useState, useEffect, useCallback } from 'react';
import { Plug, Plus, X, Loader2, Check, Copy, Trash2, Pencil, FlaskConical, History, KeyRound, Power } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getOrgId } from '../lib/org';
import { useAuth } from '../auth/AuthContext';
import { hasAtLeast } from '../auth/roles';
import { useChannels, useContacts } from '../hooks/useComms';
import { CONNECTOR_KINDS, FAMILIES, GATEWAY_URL, kindOf, saveConnector, setSecret, newInboundKey, testConnector, connectTelegram } from '../lib/comms';
import { useI18n } from '../i18n/index.jsx';

// Settings → Integrations: every company connects the systems its partners
// actually use. Secrets are write-only; each connector chooses what it sends
// (broadcasts, alerts, channel messages) and, where the system allows,
// brings replies back into a channel.

const blankRoutes = { broadcasts: true, alerts: ['critical'], channels: [] };

// What real keys look like — a saved login email/password fails these.
const SECRET_SHAPE = {
  account_sid: /^AC[0-9a-fA-F]{32}$/,
  auth_token: /^[0-9a-fA-F]{32}$/,
  bot_token: /^\d{5,}:[\w-]{30,}$/,
  routing_key: /^[0-9a-zA-Z]{32}$/,
  url: /^https:\/\/\S+$/,
};

// "(431) 400-7039" → "+14314007039"; North American 10-digit numbers get +1
function toE164(n) {
  const s = String(n ?? '').trim();
  if (!s) return s;
  const plus = s.startsWith('+');
  const d = s.replace(/\D/g, '');
  if (plus) return `+${d}`;
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return `+${d}`;
}

const Editor = ({ initial, channels, groups, onDone }) => {
  const { t } = useI18n();
  const kind = initial.catalog;
  const [name, setName] = useState(initial.name ?? t(`int.kind.${kind.id}`));
  const [config, setConfig] = useState(initial.config ?? { ...(kind.preset ?? {}) });
  const [routes, setRoutes] = useState(initial.routes ?? blankRoutes);
  const [inboundOn, setInboundOn] = useState(initial.inbound_enabled ?? !!kind.inbound);
  const [inboundChannel, setInboundChannel] = useState(initial.inbound_channel ?? '');
  const [secret, setSecretState] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const input = 'w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500';
  const hasSecretInput = kind.secret.some(([k]) => (secret[k] ?? '').trim());
  const needsSecret = kind.secret.length > 0 && !kind.secretOptional && !initial.secret_set;

  const toggleIn = (key, v) => setRoutes(r => ({ ...r, [key]: (r[key] ?? []).includes(v) ? r[key].filter(x => x !== v) : [...(r[key] ?? []), v] }));

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      // secrets are replaced as a whole, so required ones come all together
      if (!kind.secretOptional && (needsSecret || hasSecretInput) && !kind.secret.every(([k]) => (secret[k] ?? '').trim())) throw new Error(t('int.needSecret'));
      // catch browser autofill / wrong values before they are stored
      for (const [k] of kind.secret) {
        const v = (secret[k] ?? '').trim();
        if (v && SECRET_SHAPE[k] && !SECRET_SHAPE[k].test(v)) throw new Error(t(`int.bad.${k}`));
      }
      const cleanCfg = { ...config };
      const phones = kind.config.some(([, ty]) => ty === 'tel');
      for (const [k, ty] of kind.config) {
        if (ty === 'list' || ty === 'groups') cleanCfg[k] = (Array.isArray(cleanCfg[k]) ? cleanCfg[k] : String(cleanCfg[k] ?? '').split(/[,\n]/)).map(s => s.trim()).filter(Boolean);
        if (ty === 'tel' && cleanCfg[k]) cleanCfg[k] = toE164(cleanCfg[k]);
        if (ty === 'list' && phones) cleanCfg[k] = cleanCfg[k].map(toE164);
      }
      if (phones && cleanCfg.from && !/^\+\d{8,15}$/.test(cleanCfg.from)) throw new Error(t('int.bad.from'));
      const row = await saveConnector({
        id: initial.id, kind: kind.kind ?? kind.id, name: name.trim() || t(`int.kind.${kind.id}`), enabled: initial.enabled ?? true,
        config: cleanCfg, routes: kind.noOutbound ? {} : routes, inbound_enabled: !!kind.inbound && inboundOn, inbound_channel: inboundChannel || null,
      });
      if (hasSecretInput) {
        const s = Object.fromEntries(kind.secret.map(([k]) => [k, (secret[k] ?? '').trim()]).filter(([, v]) => v));
        const hintSrc = s.url ? new URL(s.url).host : (s.account_sid ?? s.api_key ?? s.bot_token ?? s.routing_key ?? '');
        await setSecret(row.id, s, s.url ? hintSrc : `…${String(hintSrc).slice(-4)}`);
      }
      let key = null;
      if ((kind.inbound === 'key' && inboundOn && !initial.inbound_key_hint) || (kind.inbound === 'cap' && !initial.inbound_key_hint)) key = await newInboundKey(row.id);
      onDone({ ...row, freshKey: key });
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const chip = (on) => `px-2 py-1 rounded-md border text-[11px] ${on ? 'bg-orange-500/20 border-orange-500/50 text-orange-200' : 'bg-slate-800 border-slate-700 text-slate-400'}`;

  return (
    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-white">{kind.icon} {t(`int.kind.${kind.id}`)}</p>
        <button onClick={() => onDone(null)} className="text-slate-400"><X className="w-4 h-4" /></button>
      </div>
      <p className="text-[11px] text-slate-400 whitespace-pre-line">{t(`int.help.${kind.id}`)}</p>
      <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder={t('int.namePh')} maxLength={80} />

      {kind.config.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-2">
          {kind.config.map(([k, ty]) => (
            <label key={k} className={ty === 'list' || ty === 'groups' ? 'sm:col-span-2' : ''}>
              <span className="block text-[10px] text-slate-400 mb-0.5">{t(`int.f.${k}`)}</span>
              {ty === 'groups' ? (
                <div className="flex flex-wrap gap-1">
                  {groups.length === 0 && <span className="text-[10px] text-slate-500">{t('int.noGroups')}</span>}
                  {groups.map(g => {
                    const on = (config.groups ?? []).includes(g);
                    return <button type="button" key={g} onClick={() => setConfig(c => ({ ...c, groups: on ? c.groups.filter(x => x !== g) : [...(c.groups ?? []), g] }))} className={chip(on)}>👥 {g}</button>;
                  })}
                </div>
              ) : ty === 'list' ? (
                <textarea rows={2} className={`${input} resize-y`} value={Array.isArray(config[k]) ? config[k].join(', ') : (config[k] ?? '')} onChange={e => setConfig(c => ({ ...c, [k]: e.target.value }))} placeholder={t(`int.ph.${k}`)} />
              ) : (
                <input className={input} type={ty === 'tel' ? 'tel' : ty === 'email' ? 'email' : 'text'} value={config[k] ?? ''} onChange={e => setConfig(c => ({ ...c, [k]: e.target.value }))} placeholder={t(`int.ph.${k}`)} />
              )}
            </label>
          ))}
        </div>
      )}

      {kind.secret.length > 0 && (
        <div className="space-y-1.5 p-2 rounded-lg border border-amber-500/30 bg-amber-500/5">
          <p className="text-[10px] text-amber-200 flex items-center gap-1"><KeyRound className="w-3 h-3" />
            {initial.secret_set ? t('int.secretSaved', { hint: initial.secret_hint ?? '' }) : t('int.secretNew')}
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {kind.secret.map(([k, ty]) => (
              <input key={k} className={input} type={ty === 'password' ? 'password' : ty === 'url' ? 'url' : 'text'}
                autoComplete={ty === 'password' ? 'new-password' : 'off'} name={`wt-${kind.id}-${k}`} data-lpignore="true" data-1p-ignore="true" data-form-type="other" spellCheck={false}
                value={secret[k] ?? ''} onChange={e => setSecretState(s => ({ ...s, [k]: e.target.value }))}
                placeholder={`${t(`int.f.${k}`)}${kind.secretOptional && k !== 'url' ? ` (${t('int.optional')})` : ''}`} />
            ))}
          </div>
        </div>
      )}

      {!kind.noOutbound && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase">{t('int.sends')}</p>
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => setRoutes(r => ({ ...r, broadcasts: !r.broadcasts }))} className={chip(routes.broadcasts)}>🚨 {t('int.r.broadcasts')}</button>
            {['critical', 'warning'].map(s => <button type="button" key={s} onClick={() => toggleIn('alerts', s)} className={chip((routes.alerts ?? []).includes(s))}>⚠️ {t(`int.r.alert.${s}`)}</button>)}
          </div>
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => toggleIn('channels', '*')} className={chip((routes.channels ?? []).includes('*'))}>💬 {t('int.r.allChannels')}</button>
            <button type="button" onClick={() => toggleIn('channels', 'general')} className={chip((routes.channels ?? []).includes('general'))}># {t('cx.allHands')}</button>
            {channels.map(c => <button type="button" key={c.id} onClick={() => toggleIn('channels', c.id)} className={chip((routes.channels ?? []).includes(c.id))}># {c.name}</button>)}
          </div>
        </div>
      )}

      {kind.inbound && kind.inbound !== 'cap' && (
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-xs text-slate-200">
            <input type="checkbox" className="accent-orange-500" checked={inboundOn} onChange={e => setInboundOn(e.target.checked)} />{t('int.inbound')}
          </label>
          {inboundOn && (
            <select value={inboundChannel} onChange={e => setInboundChannel(e.target.value)} className={input}>
              <option value="">{t('int.inboundTo', { ch: t('cx.allHands') })}</option>
              {channels.map(c => <option key={c.id} value={c.id}>{t('int.inboundTo', { ch: c.name })}</option>)}
            </select>
          )}
        </div>
      )}

      {err && <p className="text-xs text-red-400">{err}</p>}
      <button disabled={busy} onClick={submit} className="px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-50">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}{t('veh.save')}
      </button>
    </div>
  );
};

const CopyLine = ({ value }) => {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-start gap-1.5">
      <code className="flex-1 min-w-0 break-all px-2 py-1 rounded bg-slate-950 text-slate-200 text-[10px]">{value}</code>
      <button onClick={() => navigator.clipboard?.writeText(value).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); })} className="p-1.5 rounded bg-slate-800 text-slate-200 shrink-0">
        {ok ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
};

// What to paste into the other system so it can reach us
const InboundInfo = ({ c, freshKey, onNewKey }) => {
  const { t } = useI18n();
  const k = kindOf(c);
  const url = `${GATEWAY_URL}?c=${c.id}`;
  const lastLine = c.inbound_enabled && (c.lastIn
    ? <p className="text-[10px] text-green-300">{t('int.in.last', { when: new Date(c.lastIn).toLocaleString() })}</p>
    : <p className="text-[10px] text-amber-300">{t(k.inbound === 'twilio' ? 'int.in.neverTwilio' : 'int.in.never')}</p>);
  if (k.inbound === 'twilio' && c.inbound_enabled) return (
    <div className="space-y-1"><p className="text-[10px] text-slate-400">{t('int.in.twilio')}</p><CopyLine value={url} />{lastLine}</div>
  );
  if (k.inbound === 'telegram' && c.inbound_enabled) return lastLine;
  if (k.inbound === 'cap') return (
    <div className="space-y-1">
      <p className="text-[10px] text-slate-400">{t('int.in.cap')}</p>
      {freshKey ? <CopyLine value={`${GATEWAY_URL}?cap=${c.id}&key=${freshKey}`} /> : <p className="text-[10px] text-slate-500">{t('int.in.keyHidden', { hint: c.inbound_key_hint ?? '' })}</p>}
      <button onClick={onNewKey} className="text-[10px] text-sky-300 underline">{t('int.in.newKey')}</button>
    </div>
  );
  if (k.inbound === 'key' && c.inbound_enabled) return (
    <div className="space-y-1">
      <p className="text-[10px] text-slate-400">{t('int.in.webhook')}</p>
      <CopyLine value={url} />
      {freshKey
        ? <><p className="text-[10px] text-amber-200">{t('int.in.keyOnce')}</p><CopyLine value={freshKey} />
            <CopyLine value={`curl -X POST "${url}" -H "x-watchtower-key: ${freshKey}" -H "Content-Type: application/json" -d '{"text":"Unit 12 on scene","from":"Unit 12","lat":45.5,"lng":-73.6}'`} /></>
        : <p className="text-[10px] text-slate-500">{t('int.in.keyHidden', { hint: c.inbound_key_hint ?? '' })}</p>}
      <button onClick={onNewKey} className="text-[10px] text-sky-300 underline">{t('int.in.newKey')}</button>
      {lastLine}
    </div>
  );
  return null;
};

export const Integrations = () => {
  const { t } = useI18n();
  const { profile } = useAuth();
  const canManage = hasAtLeast(profile?.role, 'coordinator');
  const { channels } = useChannels();
  const { groups } = useContacts();
  const [list, setList] = useState([]);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(null);
  const [fresh, setFresh] = useState({}); // connector id → key shown once
  const [tests, setTests] = useState({});
  const [log, setLog] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    const org = await getOrgId();
    const [{ data }, { data: rec }] = await Promise.all([
      supabase.from('connectors').select('*').eq('org_id', org).order('created_at'),
      supabase.from('comms_deliveries').select('connector_id, at').eq('org_id', org).eq('status', 'received').order('at', { ascending: false }).limit(200),
    ]);
    const last = {};
    for (const r of rec ?? []) if (!last[r.connector_id]) last[r.connector_id] = r.at;
    setList((data ?? []).map(c => ({ ...c, lastIn: last[c.id] ?? null })));
  }, []);
  useEffect(() => { if (canManage) load(); }, [canManage, load]);
  if (!canManage) return null;

  const done = (row) => {
    setEditing(null);
    if (row?.freshKey) setFresh(f => ({ ...f, [row.id]: row.freshKey }));
    load();
  };
  const runTest = async (c) => {
    setTests(s => ({ ...s, [c.id]: { busy: true } }));
    try {
      const r = c.kind === 'telegram' && c.inbound_enabled ? await connectTelegram(c.id).then(async x => ({ setup: x, ...(await testConnector(c.id)) })) : await testConnector(c.id);
      setTests(s => ({ ...s, [c.id]: r }));
    } catch (e) { setTests(s => ({ ...s, [c.id]: { error: e.message } })); }
    load();
  };
  const openLog = async (c) => {
    if (log?.id === c.id) { setLog(null); return; }
    const { data } = await supabase.from('comms_deliveries').select('*').eq('connector_id', c.id).order('at', { ascending: false }).limit(25);
    setLog({ id: c.id, rows: data ?? [] });
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Plug className="w-4 h-4 text-orange-400" />{t('int.title')}</h3>
        {!picking && !editing && <button onClick={() => setPicking(true)} className="text-[11px] text-orange-300 flex items-center gap-1"><Plus className="w-3 h-3" />{t('int.add')}</button>}
      </div>
      <p className="text-[11px] text-slate-500">{t('int.lead')}</p>

      {picking && (
        <div className="space-y-2">
          {FAMILIES.map(f => (
            <div key={f}>
              <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">{t(`int.family.${f}`)}</p>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {CONNECTOR_KINDS.filter(k => k.family === f).map(k => (
                  <button key={k.id} onClick={() => { setPicking(false); setEditing({ catalog: k }); }} className="text-left p-2 rounded-lg border border-slate-700 bg-slate-800/50 hover:border-orange-500/50">
                    <span className="block text-xs text-white font-medium">{k.icon} {t(`int.kind.${k.id}`)}</span>
                    <span className="block text-[10px] text-slate-400">{t(`int.kind.${k.id}.d`)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => setPicking(false)} className="text-[11px] text-slate-400">{t('log.cancel')}</button>
        </div>
      )}

      {editing && <Editor key={editing.id ?? editing.catalog.id} initial={editing} channels={channels} groups={groups} onDone={done} />}

      {list.length === 0 && !picking && !editing && <p className="text-[11px] text-slate-500">{t('int.none')}</p>}
      <div className="space-y-1.5">
        {list.map(c => {
          const k = kindOf(c);
          const tr = tests[c.id];
          const healthy = c.last_ok_at && (!c.last_error_at || Date.parse(c.last_ok_at) > Date.parse(c.last_error_at));
          return (
            <div key={c.id} className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${!c.enabled ? 'bg-slate-600' : healthy ? 'bg-green-400' : c.last_error ? 'bg-red-400' : 'bg-slate-500'}`} />
                <span className="text-xs text-white flex-1 min-w-0 truncate">{k.icon} {c.name}</span>
                <span className="text-[10px] text-slate-400 hidden sm:inline">{t(`int.kind.${k.id}`)}</span>
                {!k.noOutbound && <button onClick={() => runTest(c)} className="p-1 text-slate-400 hover:text-sky-300" title={t('int.test')}>{tr?.busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}</button>}
                <button onClick={() => openLog(c)} className="p-1 text-slate-400 hover:text-white" title={t('int.log')}><History className="w-3.5 h-3.5" /></button>
                <button onClick={async () => { await supabase.from('connectors').update({ enabled: !c.enabled }).eq('id', c.id); load(); }} className={`p-1 ${c.enabled ? 'text-green-400' : 'text-slate-500'}`} title={c.enabled ? t('int.disable') : t('int.enable')}><Power className="w-3.5 h-3.5" /></button>
                <button onClick={() => setEditing({ ...c, catalog: k })} className="p-1 text-slate-400 hover:text-orange-300"><Pencil className="w-3.5 h-3.5" /></button>
                {confirmDel === c.id
                  ? <button onClick={async () => { const { error } = await supabase.from('connectors').delete().eq('id', c.id); if (error) setErr(error.message); setConfirmDel(null); load(); }} className="text-[10px] font-bold text-red-400">{t('tac.sure')}</button>
                  : <button onClick={() => setConfirmDel(c.id)} className="p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
              {c.last_error && !healthy && <p className="text-[10px] text-red-300 break-all">{c.last_error}</p>}
              {tr && !tr.busy && (
                <div className="text-[10px] space-y-0.5">
                  {tr.error && <p className="text-red-300">{tr.error}</p>}
                  {tr.setup && <p className={tr.setup.ok ? 'text-green-300' : 'text-red-300'}>{t('int.telegramLinked')}: {tr.setup.detail}</p>}
                  {(tr.results ?? []).map((r, i) => <p key={i} className={r.ok ? 'text-green-300' : 'text-red-300'}>{r.ok ? '✓' : '✗'} {r.target} — {r.detail}</p>)}
                </div>
              )}
              <InboundInfo c={c} freshKey={fresh[c.id]} onNewKey={async () => { const key = await newInboundKey(c.id); setFresh(f => ({ ...f, [c.id]: key })); load(); }} />
              {log?.id === c.id && (
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {log.rows.length === 0 && <p className="text-[10px] text-slate-500">{t('int.logEmpty')}</p>}
                  {log.rows.map(r => (
                    <p key={r.id} className="text-[10px] text-slate-300">
                      <span className="text-slate-500">{new Date(r.at).toLocaleString()} · </span>
                      <span className={r.status === 'failed' ? 'text-red-300' : r.status === 'received' ? 'text-sky-300' : 'text-green-300'}>{t(`int.st.${r.status}`)}</span>
                      {' · '}{t(`int.ref.${r.ref_type}`)} · {r.target}{r.detail ? ` — ${r.detail}` : ''}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  );
};

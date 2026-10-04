import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Phone, MessageSquare, Mail, Send, Pencil, Trash2, Upload, X, Loader2, Radio, Star, Copy, Check, PhoneCall } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getOrgId } from '../lib/org';
import { useAuth } from '../auth/AuthContext';
import { useContacts } from '../hooks/useComms';
import { contactLinks, parseContactsCsv } from '../lib/comms';
import { useI18n } from '../i18n/index.jsx';

const ICON = { call: Phone, sms: MessageSquare, whatsapp: MessageSquare, email: Mail, telegram: Send };
const EMPTY = { name: '', agency: '', role: '', phone: '', email: '', whatsapp: '', telegram: '', radio: '', notes: '', groups: [] };

// A phone has a dialer and an SMS app; a computer usually has neither, and
// tel:/sms: links there only open Windows' "pick an application" box.
const isPhone = () => {
  try { return navigator.userAgentData?.mobile ?? /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent); } catch { return false; }
};

// What the company line can do (booleans only), for every rank.
const useCaps = () => {
  const [caps, setCaps] = useState({ sms: false, whatsapp: false, voice: false });
  useEffect(() => { supabase.rpc('comms_capabilities').then(({ data }) => { if (data) setCaps(data); }); }, []);
  return caps;
};

const invokeDirect = async (body) => {
  const { data, error } = await supabase.functions.invoke('comms-dispatch', { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context?.json?.(); msg = j?.error ?? msg; } catch { /* not JSON */ }
    throw new Error(msg);
  }
  return data;
};

// Call / SMS / WhatsApp / email for one contact, native where it can be:
// phones use their own dialer; computers call through the company line
// (Watchtower rings your mobile, then connects you). Texts go out from the
// company number and the conversation stays in Watchtower.
const ContactActions = ({ c, caps }) => {
  const { t } = useI18n();
  const { profile, session, reloadProfile } = useAuth();
  const phone = isPhone();
  const [mode, setMode] = useState(null); // 'sms' | 'call'
  const [text, setText] = useState('');
  const [mobile, setMobile] = useState(profile?.mobile ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [copied, setCopied] = useState(false);
  const [thread, setThread] = useState([]);

  const loadThread = useCallback(async () => {
    const org = await getOrgId();
    const { data } = await supabase.from('messages').select('id, text, at, source, meta, sender').eq('org_id', org).eq('contact_id', c.id).is('deleted_at', null).order('at', { ascending: false }).limit(20);
    setThread((data ?? []).reverse());
  }, [c.id]);
  useEffect(() => { if (mode === 'sms') loadThread(); }, [mode, loadThread]);

  const fail = (e) => setMsg({ bad: true, text: ['no_mobile', 'no_number', 'no_line'].includes(e.message) ? t(`cx.ct.err.${e.message}`) : e.message });
  const sendSms = async () => {
    setBusy(true); setMsg(null);
    try { await invokeDirect({ type: 'direct_sms', contact_id: c.id, text }); setText(''); setMsg({ text: t('cx.ct.sent') }); loadThread(); }
    catch (e) { fail(e); }
    setBusy(false);
  };
  const call = async () => {
    setBusy(true); setMsg(null);
    try {
      if (mobile.trim() && mobile.trim() !== (profile?.mobile ?? '')) {
        const { error } = await supabase.from('profiles').update({ mobile: mobile.trim() }).eq('id', session.user.id);
        if (error) throw error;
        reloadProfile?.();
      }
      const r = await invokeDirect({ type: 'call', contact_id: c.id });
      setMsg({ text: t('cx.ct.ringing', { last: r?.ringing ?? '' }) });
      setMode(null);
    } catch (e) { fail(e); }
    setBusy(false);
  };
  const copy = (v) => navigator.clipboard?.writeText(v).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });

  const btn = 'px-2 py-1 rounded-md text-[11px] flex items-center gap-1 border';
  const links = contactLinks(c).filter(l => !['call', 'sms'].includes(l.k));
  const number = c.phone || c.whatsapp;
  const input = 'w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500';

  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {number && (phone
          ? <a href={`tel:${number.replace(/[^\d+]/g, '')}`} className={`${btn} bg-green-600/20 border-green-500/40 text-green-200`}><Phone className="w-3 h-3" />{t('cx.ct.do.call')}</a>
          : caps.voice
            ? <button onClick={() => { setMode(mode === 'call' ? null : 'call'); setMsg(null); }} className={`${btn} bg-green-600/20 border-green-500/40 text-green-200`}><PhoneCall className="w-3 h-3" />{t('cx.ct.do.call')}</button>
            : <button onClick={() => copy(number)} className={`${btn} bg-slate-800 border-slate-700 text-slate-200`} title={t('cx.ct.copyTitle')}>{copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}{number}</button>)}
        {number && (caps.sms
          ? <button onClick={() => { setMode(mode === 'sms' ? null : 'sms'); setMsg(null); }} className={`${btn} ${mode === 'sms' ? 'bg-sky-600/30 border-sky-500/50 text-sky-100' : 'bg-slate-800 border-slate-700 text-slate-200'}`}><MessageSquare className="w-3 h-3" />{t('cx.ct.do.sms')}</button>
          : phone && <a href={`sms:${number.replace(/[^\d+]/g, '')}`} className={`${btn} bg-slate-800 border-slate-700 text-slate-200`}><MessageSquare className="w-3 h-3" />{t('cx.ct.do.sms')}</a>)}
        {links.map(l => {
          const I = ICON[l.k];
          return (
            <a key={l.k} href={l.href} target={l.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={`${btn} bg-slate-800 border-slate-700 text-slate-200`}>
              <I className="w-3 h-3" />{t(`cx.ct.do.${l.k}`)}
            </a>
          );
        })}
      </div>

      {mode === 'call' && (
        <div className="p-2 rounded-lg bg-green-900/20 border border-green-700/40 space-y-1.5">
          <p className="text-[11px] text-green-100">{t('cx.ct.callHow', { name: c.name })}</p>
          <input className={input} type="tel" value={mobile} onChange={e => setMobile(e.target.value)} placeholder={t('cx.ct.myMobile')} />
          <button disabled={busy || !mobile.trim()} onClick={call} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PhoneCall className="w-3.5 h-3.5" />}{t('cx.ct.callNow')}
          </button>
        </div>
      )}

      {mode === 'sms' && (
        <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700 space-y-1.5">
          {thread.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {thread.map(m => {
                const out = m.meta?.direction === 'out' || (m.sender && m.source !== 'sms');
                return (
                  <div key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                    <p className={`max-w-[85%] px-2 py-1 rounded-lg text-[11px] whitespace-pre-wrap ${out ? 'bg-orange-500/20 text-orange-50' : 'bg-sky-950/70 text-sky-50'}`}>
                      {m.text}<span className="block text-[9px] opacity-60 text-right">{new Date(m.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex gap-1.5">
            <input className={input} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && text.trim() && !busy) sendSms(); }} placeholder={t('cx.ct.smsPh', { name: c.name })} maxLength={1500} />
            <button disabled={busy || !text.trim()} onClick={sendSms} className="px-3 rounded-lg bg-sky-600 text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-50">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-slate-500">{t('cx.ct.smsNote')}</p>
        </div>
      )}
      {msg && <p className={`text-[11px] ${msg.bad ? 'text-red-300' : 'text-green-300'}`}>{msg.text}</p>}
    </div>
  );
};

// Everyone outside the app the operation may need: other agencies,
// hospitals, utilities, volunteers. Tap to call / text / WhatsApp / email
// from the device; groups drive broadcasts and SMS/email connectors.
export const ContactsPanel = ({ canManage }) => {
  const { t } = useI18n();
  const { contacts, groups, save, importMany, remove } = useContacts();
  const caps = useCaps();
  const [qText, setQ] = useState('');
  const [group, setGroup] = useState(null);
  const [edit, setEdit] = useState(null);
  const [csv, setCsv] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const needle = qText.trim().toLowerCase();
  const shown = contacts.filter(c => (!group || (group === '★vip' ? c.vip : (c.groups ?? []).includes(group)))
    && (!needle || [c.name, c.agency, c.role, c.phone, c.email, c.radio, ...(c.groups ?? [])].some(v => (v ?? '').toLowerCase().includes(needle))))
    .sort((a, b) => Number(!!b.vip) - Number(!!a.vip)); // VIPs first

  const submit = async () => {
    setBusy(true); setErr(null);
    try { await save(edit); setEdit(null); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const runImport = async () => {
    setBusy(true); setErr(null);
    try { await importMany(csv.rows); setCsv(null); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const input = 'w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={qText} onChange={e => setQ(e.target.value)} placeholder={t('cx.ct.search')} className={`${input} pl-8`} />
        </div>
        {canManage && (
          <>
            <button onClick={() => { setEdit({ ...EMPTY }); setErr(null); }} className="px-2.5 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-semibold flex items-center gap-1"><Plus className="w-3.5 h-3.5" />{t('cx.ct.add')}</button>
            <label className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs flex items-center gap-1 cursor-pointer" title={t('cx.ct.importTitle')}>
              <Upload className="w-3.5 h-3.5" />CSV
              <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={async e => {
                const f = e.target.files?.[0]; e.target.value = '';
                if (f) setCsv({ name: f.name, rows: parseContactsCsv(await f.text()) });
              }} />
            </label>
          </>
        )}
      </div>
      {(groups.length > 0 || contacts.some(c => c.vip)) && (
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setGroup(null)} className={`px-2 py-0.5 rounded-md text-[11px] border ${!group ? 'bg-orange-500/20 border-orange-500/50 text-orange-200' : 'border-slate-700 text-slate-400'}`}>{t('cx.ct.all')}</button>
          {contacts.some(c => c.vip) && <button onClick={() => setGroup(group === '★vip' ? null : '★vip')} className={`px-2 py-0.5 rounded-md text-[11px] border ${group === '★vip' ? 'bg-amber-500/20 border-amber-400/60 text-amber-200' : 'border-slate-700 text-slate-400'}`}>⭐ VIP</button>}
          {groups.map(g => <button key={g} onClick={() => setGroup(group === g ? null : g)} className={`px-2 py-0.5 rounded-md text-[11px] border ${group === g ? 'bg-orange-500/20 border-orange-500/50 text-orange-200' : 'border-slate-700 text-slate-400'}`}>👥 {g}</button>)}
        </div>
      )}

      {csv && (
        <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 space-y-2">
          <p className="text-xs text-slate-200">{t('cx.ct.csvFound', { n: csv.rows.length, file: csv.name })}</p>
          <p className="text-[10px] text-slate-500">{t('cx.ct.csvHelp')}</p>
          <div className="flex gap-2">
            <button disabled={busy || !csv.rows.length} onClick={runImport} className="px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-semibold disabled:opacity-50">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('cx.ct.import')}</button>
            <button onClick={() => setCsv(null)} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300">{t('log.cancel')}</button>
          </div>
        </div>
      )}

      {edit && (
        <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-white">{edit.id ? t('cx.ct.edit') : t('cx.ct.add')}</p>
            <button onClick={() => setEdit(null)} className="text-slate-400"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {['name', 'agency', 'role', 'phone', 'whatsapp', 'email', 'telegram', 'radio'].map(k => (
              <input key={k} className={input} value={edit[k] ?? ''} onChange={e => setEdit(v => ({ ...v, [k]: e.target.value }))}
                placeholder={t(`cx.ct.f.${k}`)} type={k === 'email' ? 'email' : ['phone', 'whatsapp'].includes(k) ? 'tel' : 'text'} />
            ))}
          </div>
          <input className={input} value={(edit.groups ?? []).join(', ')} onChange={e => setEdit(v => ({ ...v, groups: e.target.value.split(',').map(s => s.trimStart()) }))} placeholder={t('cx.ct.f.groups')} />
          <textarea className={`${input} resize-y`} rows={2} value={edit.notes ?? ''} onChange={e => setEdit(v => ({ ...v, notes: e.target.value }))} placeholder={t('cx.ct.f.notes')} />
          <label className="flex items-center gap-2 text-xs text-amber-200">
            <input type="checkbox" className="accent-amber-400" checked={!!edit.vip} onChange={e => setEdit(v => ({ ...v, vip: e.target.checked }))} />⭐ {t('cx.ct.vip')}
          </label>
          <button disabled={busy || !edit.name?.trim()} onClick={submit} className="px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1">
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{t('veh.save')}
          </button>
        </div>
      )}
      {err && <p className="text-xs text-red-400">{err}</p>}

      {shown.length === 0 && !edit && (
        <p className="text-xs text-slate-500 text-center py-6">{contacts.length ? t('cx.ct.noMatch') : canManage ? t('cx.ct.emptyManage') : t('cx.ct.empty')}</p>
      )}
      <div className="space-y-1.5">
        {shown.map(c => (
          <div key={c.id} className={`p-2.5 rounded-lg bg-slate-900/60 border ${c.vip ? 'border-amber-400/50' : 'border-slate-800'}`}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{c.vip && <Star className="w-3.5 h-3.5 inline -mt-0.5 mr-1 fill-amber-300 text-amber-300" />}{c.name}{c.role && <span className="text-slate-400 font-normal"> · {c.role}</span>}</p>
                <p className="text-[11px] text-slate-400 truncate">
                  {[c.agency, c.phone, c.email].filter(Boolean).join(' · ')}
                  {c.radio && <span className="ml-1 inline-flex items-center gap-0.5"><Radio className="w-3 h-3" />{c.radio}</span>}
                </p>
                {(c.groups ?? []).length > 0 && <p className="text-[10px] text-slate-500 mt-0.5">{c.groups.map(g => `👥 ${g}`).join('  ')}</p>}
                {c.notes && <p className="text-[10px] text-slate-500 mt-0.5 whitespace-pre-wrap">{c.notes}</p>}
              </div>
              {canManage && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => save({ ...c, vip: !c.vip }).catch(e => setErr(e.message))} className={`p-1 ${c.vip ? 'text-amber-300' : 'text-slate-500 hover:text-amber-300'}`} title={t('cx.ct.vip')}><Star className={`w-3.5 h-3.5 ${c.vip ? 'fill-amber-300' : ''}`} /></button>
                  <button onClick={() => { setEdit({ ...EMPTY, ...c }); setErr(null); }} className="p-1 text-slate-500 hover:text-orange-300"><Pencil className="w-3.5 h-3.5" /></button>
                  {confirmDel === c.id
                    ? <button onClick={() => { remove(c.id).catch(e => setErr(e.message)); setConfirmDel(null); }} className="text-[10px] font-bold text-red-400 px-1">{t('tac.sure')}</button>
                    : <button onClick={() => setConfirmDel(c.id)} className="p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              )}
            </div>
            <ContactActions c={c} caps={caps} />
          </div>
        ))}
      </div>
    </div>
  );
};

import { useState, useEffect } from 'react';
import { Siren, X, Loader2, Check, MapPin, Send, Users, CheckCircle2, XCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getOrgId } from '../lib/org';
import { pushToTeam } from '../lib/push';
import { useAuth } from '../auth/AuthContext';
import { useBroadcasts } from '../hooks/useComms';
import { kindOf } from '../lib/comms';
import { useI18n } from '../i18n/index.jsx';

const SEV = {
  emergency: { cls: 'bg-red-600 border-red-400', soft: 'bg-red-500/15 border-red-500/40 text-red-100', push: 'critical' },
  urgent: { cls: 'bg-orange-600 border-orange-400', soft: 'bg-orange-500/15 border-orange-500/40 text-orange-100', push: 'warning' },
  info: { cls: 'bg-sky-700 border-sky-400', soft: 'bg-sky-500/15 border-sky-500/40 text-sky-100', push: 'info' },
};

// ---------- composer (coordinator+) ----------
export const BroadcastComposer = ({ channels, groups, onClose }) => {
  const { t, lang } = useI18n();
  const { session, profile } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState('emergency');
  const [requireAck, setRequireAck] = useState(true);
  const [withLoc, setWithLoc] = useState(false);
  const [team, setTeam] = useState(true);
  const [chans, setChans] = useState([]);
  const [grps, setGrps] = useState([]);
  const [conns, setConns] = useState(null); // ids; null until loaded
  const [connectors, setConnectors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      const org = await getOrgId();
      const { data } = await supabase.from('connectors').select('id, name, kind, config, routes, enabled').eq('org_id', org).eq('enabled', true).neq('kind', 'cap');
      setConnectors(data ?? []);
      setConns((data ?? []).filter(c => c.routes?.broadcasts).map(c => c.id));
    })();
  }, []);

  const toggle = (list, set, v) => set(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

  const send = async () => {
    if (!title.trim()) return;
    setBusy(true); setErr(null);
    try {
      const org = await getOrgId();
      let pos = null;
      if (withLoc && navigator.geolocation) {
        pos = await new Promise(res => navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { enableHighAccuracy: true, timeout: 6000 }));
      }
      const { data: b, error } = await supabase.from('broadcasts').insert({
        org_id: org, title: title.trim().slice(0, 200), body: body.trim() || null, severity, require_ack: requireAck,
        audience: { team, channels: chans, groups: grps, connectors: conns ?? [] }, lat: pos?.lat ?? null, lng: pos?.lng ?? null, created_by: session.user.id,
      }).select().single();
      if (error) throw error;
      // the broadcast also lands in the conversation(s)
      const targets = team ? [null, ...chans] : chans;
      const text = `${title.trim()}${body.trim() ? `\n${body.trim()}` : ''}`;
      if (targets.length) {
        await supabase.from('messages').insert(targets.map(ch => ({ org_id: org, sender: session.user.id, text, lang, source: 'broadcast', broadcast_id: b.id, channel_id: ch })));
      }
      if (team) {
        pushToTeam({ kind: 'broadcast', severity: SEV[severity].push, title: `${severity === 'emergency' ? '🚨 ' : ''}${title.trim()}`, body: body.trim().slice(0, 160) || (profile?.display_name ?? ''), url: '/?tab=comms', tag: `broadcast:${b.id}` });
      }
      onClose(true);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const chip = (on) => `px-2.5 py-1 rounded-lg border text-xs ${on ? 'bg-orange-500/20 border-orange-500/50 text-orange-200' : 'bg-slate-800 border-slate-700 text-slate-300'}`;
  const input = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3" onClick={() => onClose(false)}>
      <div className="bg-slate-900 border border-red-500/40 rounded-xl w-full max-w-lg p-4 max-h-[92dvh] overflow-y-auto space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Siren className="w-4 h-4 text-red-400" />{t('cx.bc.title')}</h3>
          <button onClick={() => onClose(false)} className="p-1 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex gap-1.5">
          {['emergency', 'urgent', 'info'].map(s => (
            <button key={s} onClick={() => setSeverity(s)} className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold text-white ${severity === s ? SEV[s].cls : 'bg-slate-800 border-slate-700 text-slate-300'}`}>{t(`cx.sev.${s}`)}</button>
          ))}
        </div>
        <input className={input} value={title} onChange={e => setTitle(e.target.value)} placeholder={t('cx.bc.titlePh')} maxLength={200} autoFocus />
        <textarea className={`${input} resize-y`} rows={3} value={body} onChange={e => setBody(e.target.value)} placeholder={t('cx.bc.bodyPh')} />
        <div className="flex flex-wrap gap-3 text-xs text-slate-300">
          <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-orange-500" checked={requireAck} onChange={e => setRequireAck(e.target.checked)} />{t('cx.bc.requireAck')}</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-orange-500" checked={withLoc} onChange={e => setWithLoc(e.target.checked)} /><MapPin className="w-3 h-3" />{t('cx.bc.withLoc')}</label>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase">{t('cx.bc.who')}</p>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setTeam(v => !v)} className={chip(team)}><Users className="w-3 h-3 inline mr-1" />{t('cx.bc.team')}</button>
            {channels.map(c => <button key={c.id} onClick={() => toggle(chans, setChans, c.id)} className={chip(chans.includes(c.id))}># {c.name}</button>)}
          </div>
          {groups.length > 0 && (
            <>
              <p className="text-[10px] text-slate-500">{t('cx.bc.groups')}</p>
              <div className="flex flex-wrap gap-1.5">{groups.map(g => <button key={g} onClick={() => toggle(grps, setGrps, g)} className={chip(grps.includes(g))}>👥 {g}</button>)}</div>
            </>
          )}
          {connectors.length > 0 && (
            <>
              <p className="text-[10px] text-slate-500">{t('cx.bc.systems')}</p>
              <div className="flex flex-wrap gap-1.5">{connectors.map(c => <button key={c.id} onClick={() => toggle(conns ?? [], setConns, c.id)} className={chip((conns ?? []).includes(c.id))}>{kindOf(c).icon} {c.name}</button>)}</div>
            </>
          )}
          {connectors.length === 0 && <p className="text-[10px] text-slate-500">{t('cx.bc.noSystems')}</p>}
        </div>

        {err && <p className="text-xs text-red-400">{err}</p>}
        <button onClick={send} disabled={busy || !title.trim() || (!team && !chans.length && !grps.length && !(conns ?? []).length)}
          className={`w-full py-2.5 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 ${SEV[severity].cls} border`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{t('cx.bc.send')}
        </button>
      </div>
    </div>
  );
};

// ---------- list with acknowledgements ----------
export const BroadcastList = ({ members, contacts, canManage }) => {
  const { t } = useI18n();
  const { session } = useAuth();
  const { broadcasts, acks, ack, close } = useBroadcasts();
  const [open, setOpen] = useState(null);
  const myId = session?.user?.id;
  if (!broadcasts.length) return <p className="text-xs text-slate-500 text-center py-8">{t('cx.bc.none')}</p>;
  return (
    <div className="space-y-2">
      {broadcasts.map(b => {
        const mine = acks.filter(a => a.broadcast_id === b.id);
        const ackedMembers = new Set(mine.filter(a => a.profile_id).map(a => a.profile_id));
        const ackedContacts = mine.filter(a => a.contact_id);
        const pending = b.audience?.team ? members.filter(m => m.role !== 'viewer' && !ackedMembers.has(m.id)) : [];
        const iAcked = ackedMembers.has(myId);
        return (
          <div key={b.id} className={`rounded-xl border p-3 ${b.status === 'closed' ? 'bg-slate-900/40 border-slate-800 opacity-70' : SEV[b.severity].soft}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">{b.severity === 'emergency' && '🚨 '}{b.title}</p>
                {b.body && <p className="text-xs whitespace-pre-wrap mt-0.5">{b.body}</p>}
                <p className="text-[10px] text-slate-400 mt-1">
                  {new Date(b.created_at).toLocaleString()} · {members.find(m => m.id === b.created_by)?.name ?? '—'}
                  {b.lat != null && <> · <a className="underline" href={`https://www.google.com/maps?q=${b.lat},${b.lng}`} target="_blank" rel="noreferrer">{t('cx.bc.map')}</a></>}
                  {b.status === 'closed' && <> · {t('cx.bc.closed')}</>}
                </p>
              </div>
              {b.require_ack && !iAcked && b.status === 'active' && (
                <button onClick={() => ack(b, myId)} className="px-3 py-1.5 rounded-lg bg-white text-slate-900 text-xs font-bold shrink-0">{t('cx.bc.ack')}</button>
              )}
            </div>
            {b.require_ack && (
              <button onClick={() => setOpen(open === b.id ? null : b.id)} className="mt-2 text-[11px] text-slate-200 underline">
                {t('cx.bc.ackCount', { n: ackedMembers.size, total: ackedMembers.size + pending.length })}{ackedContacts.length > 0 && ` · ${t('cx.bc.ackContacts', { n: ackedContacts.length })}`}
              </button>
            )}
            {open === b.id && (
              <div className="mt-2 grid sm:grid-cols-2 gap-1 text-[11px]">
                {[...ackedMembers].map(id => <span key={id} className="flex items-center gap-1 text-green-300"><CheckCircle2 className="w-3 h-3" />{members.find(m => m.id === id)?.name ?? '—'} · {new Date(mine.find(a => a.profile_id === id)?.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>)}
                {ackedContacts.map(a => <span key={a.id} className="flex items-center gap-1 text-green-300"><CheckCircle2 className="w-3 h-3" />{contacts.find(c => c.id === a.contact_id)?.name ?? '—'} ({a.via}) · {new Date(a.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>)}
                {pending.map(m => <span key={m.id} className="flex items-center gap-1 text-slate-400"><XCircle className="w-3 h-3" />{m.name}</span>)}
              </div>
            )}
            {canManage && b.status === 'active' && (
              <button onClick={() => close(b.id)} className="mt-2 text-[11px] text-slate-400 hover:text-white">{t('cx.bc.close')}</button>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ---------- banner on every screen until acknowledged ----------
export const BroadcastBanner = () => {
  const { t } = useI18n();
  const { session } = useAuth();
  const { broadcasts, acks, ack } = useBroadcasts();
  const [busy, setBusy] = useState(null);
  const myId = session?.user?.id;
  if (!isSupabaseConfigured || !myId) return null;
  const dayAgo = Date.now() - 24 * 3600e3;
  const open = broadcasts.filter(b => b.status === 'active' && b.require_ack && b.audience?.team && Date.parse(b.created_at) > dayAgo
    && !acks.some(a => a.broadcast_id === b.id && a.profile_id === myId));
  if (!open.length) return null;
  const b = open[0];
  return (
    <div className={`fixed inset-x-0 top-0 z-[140] border-b-2 ${SEV[b.severity].cls} text-white shadow-2xl`} role="alert">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-start gap-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <Siren className="w-6 h-6 shrink-0 animate-pulse" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">{t(`cx.sev.${b.severity}`)}{open.length > 1 && ` · ${t('cx.bc.more', { n: open.length - 1 })}`}</p>
          <p className="text-sm font-bold">{b.title}</p>
          {b.body && <p className="text-xs whitespace-pre-wrap opacity-95">{b.body}</p>}
        </div>
        <button disabled={busy === b.id} onClick={async () => { setBusy(b.id); try { await ack(b, myId); } finally { setBusy(null); } }}
          className="px-3 py-2 rounded-lg bg-white text-slate-900 text-xs font-bold shrink-0 flex items-center gap-1">
          {busy === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}{t('cx.bc.ack')}
        </button>
      </div>
    </div>
  );
};

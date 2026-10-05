import { useState } from 'react';
import { Hash, Users, Lock, Phone, Star, PenSquare, UserPlus, X, Check, Loader2, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../i18n/index.jsx';

const ago = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (now - d < 6 * 86400e3) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// The conversation picker: Groups, Direct, Outside contacts â€” each row with
// its last message and unread count. "New message" opens a direct
// conversation with one teammate; "New group" a private group.
export const ConversationList = ({ sections, activeKey, onOpen, titleOf, nameOf, myId, members, onlineIds, onCreated }) => {
  const { t } = useI18n();
  const [mode, setMode] = useState(null);   // null | 'dm' | 'group'
  const [picked, setPicked] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState('');
  const others = members.filter(m => m.id !== myId && m.role !== 'viewer' && (!q || m.name.toLowerCase().includes(q.toLowerCase())));

  const close = () => { setMode(null); setPicked([]); setGroupName(''); setErr(null); setQ(''); };
  const startDm = async (id) => {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('start_dm', { p_other: id });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    close();
    onCreated?.(`ch:${data}`);
  };
  const createGroup = async () => {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('create_group', { p_name: groupName.trim(), p_members: picked });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    close();
    onCreated?.(`ch:${data}`);
  };

  const preview = (c) => {
    const m = c.last;
    if (!m) return t('cx.cl.noMessages');
    const who = m.sender === myId ? t('cx.cl.you') : c.type === 'dm' || c.type === 'external' ? null : (m.external_from ?? nameOf[m.sender]);
    const text = c.type === 'external' && m.sender ? `${t('cx.cl.you')}: ${m.text}` : who ? `${who}: ${m.text}` : m.text;
    return text;
  };

  const icon = (c) => {
    if (c.type === 'channel') return <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `${c.color}26` }}><Hash className="w-4 h-4" style={{ color: c.color }} /></span>;
    if (c.type === 'group') return <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-sky-500/15"><Users className="w-4 h-4 text-sky-300" /></span>;
    if (c.type === 'dm') return (
      <span className="relative w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-emerald-500/15 text-emerald-200 text-xs font-bold">
        {(c.name ?? '?').slice(0, 1).toUpperCase()}
        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${onlineIds.has(c.other) ? 'bg-green-400' : 'bg-slate-600'}`} />
      </span>
    );
    return <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-sky-900/40"><Phone className="w-4 h-4 text-sky-300" /></span>;
  };

  const row = (c) => (
    <button key={c.key} onClick={() => onOpen(c.key)}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left ${activeKey === c.key ? 'bg-slate-800 border border-slate-600' : 'border border-transparent hover:bg-slate-800/60'}`}>
      {icon(c)}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <span className={`text-sm truncate ${c.unread ? 'font-bold text-white' : 'text-slate-200'}`}>{titleOf(c)}</span>
          {c.type === 'dm' && <Lock className="w-2.5 h-2.5 text-slate-500 shrink-0" />}
          {c.vip && <Star className="w-3 h-3 fill-amber-300 text-amber-300 shrink-0" />}
          <span className="flex-1" />
          <span className="text-[10px] text-slate-500 shrink-0">{ago(c.last?.at)}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className={`text-[11px] truncate flex-1 ${c.unread ? 'text-slate-200' : 'text-slate-500'}`}>{preview(c)}</span>
          {c.unread > 0 && <span className="px-1.5 min-w-[18px] text-center rounded-full bg-orange-500 text-white text-[10px] font-bold shrink-0">{c.unread > 99 ? '99+' : c.unread}</span>}
        </span>
      </span>
    </button>
  );

  const section = (key, list, empty) => (
    <div className="space-y-0.5">
      <p className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t(`cx.cl.${key}`)}</p>
      {list.length ? list.map(row) : <p className="px-2.5 py-1 text-[11px] text-slate-600">{empty}</p>}
    </div>
  );

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex gap-1.5 p-2 border-b border-slate-800 flex-shrink-0">
        <button onClick={() => (mode === 'dm' ? close() : (close(), setMode('dm')))} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold ${mode === 'dm' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>
          <PenSquare className="w-3.5 h-3.5" />{t('cx.cl.newDm')}
        </button>
        <button onClick={() => (mode === 'group' ? close() : (close(), setMode('group')))} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold ${mode === 'group' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>
          <UserPlus className="w-3.5 h-3.5" />{t('cx.cl.newGroup')}
        </button>
      </div>

      {mode && (
        <div className="p-2 border-b border-slate-800 space-y-1.5 flex-shrink-0 max-h-[55%] overflow-y-auto">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-white">{mode === 'dm' ? t('cx.cl.pickOne') : t('cx.cl.pickMany')}</p>
            <button onClick={close} className="text-slate-400"><X className="w-4 h-4" /></button>
          </div>
          {mode === 'group' && (
            <input value={groupName} onChange={e => setGroupName(e.target.value)} maxLength={60} autoFocus placeholder={t('cx.cl.groupNamePh')}
              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500" />
          )}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('cx.cl.searchPh')} autoFocus={mode === 'dm'}
              className="w-full pl-7 pr-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none" />
          </div>
          {others.length === 0 && <p className="text-[11px] text-slate-500">{t('cx.cl.nobody')}</p>}
          {others.map(m => {
            const on = picked.includes(m.id);
            return (
              <button key={m.id} disabled={busy}
                onClick={() => (mode === 'dm' ? startDm(m.id) : setPicked(p => (on ? p.filter(x => x !== m.id) : [...p, m.id])))}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs border ${on ? 'border-sky-500/60 bg-sky-500/10 text-white' : 'border-slate-800 text-slate-200 hover:border-slate-600'}`}>
                <span className={`w-2 h-2 rounded-full ${onlineIds.has(m.id) ? 'bg-green-400' : 'bg-slate-600'}`} />
                <span className="flex-1 truncate">{m.name}</span>
                <span className="text-[10px] text-slate-500">{t(`role.${m.role}`)}</span>
                {mode === 'group' && on && <Check className="w-3.5 h-3.5 text-sky-300" />}
              </button>
            );
          })}
          {mode === 'group' && (
            <button onClick={createGroup} disabled={busy || !groupName.trim() || picked.length === 0}
              className="w-full px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}{t('cx.cl.create', { n: picked.length + 1 })}
            </button>
          )}
          {err && <p className="text-[11px] text-red-400">{err}</p>}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-1">
        {section('groups', sections.group, '')}
        {section('direct', sections.direct, t('cx.cl.noDirect'))}
        {section('external', sections.external, t('cx.cl.noExternal'))}
      </div>
    </div>
  );
};

import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Loader2, Mic, MicOff, Siren, Archive, MapPin, Paperclip, Star, Trash2, RotateCcw, Copy, ArrowLeft, Users, UserPlus, LogOut, Lock, Hash, Phone, MessageSquare } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { getOrgId } from '../../lib/org';
import { useSpeech } from '../../hooks/useSpeech';
import { beep } from '../../lib/speechFeedback';
import { pushToTeam } from '../../lib/push';
import { hasAtLeast } from '../../auth/roles';
import { useI18n, langName } from '../../i18n/index.jsx';
import { useTranslations } from '../../lib/translate';
import { convKeyOf, EXTERNAL_SOURCES } from '../../hooks/useConversations';

const timeStr = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dayStr = (iso) => new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
const SOURCE_ICON = { sms: '📱', whatsapp: '🟢', telegram: '✈️', webhook: '🔗', radio: '📻', email: '✉️' };

// One conversation: a company channel, a private group, a direct
// conversation or an outside contact's SMS/WhatsApp thread.
export const Thread = ({ conv, myId, profile, members, nameOf, isCoord, onBack, onRead, convTitle }) => {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState([]);
  const [pinned, setPinned] = useState([]);
  const [filter, setFilter] = useState('live');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [actionFor, setActionFor] = useState(null);
  const [confirmArchiveAll, setConfirmArchiveAll] = useState(false);
  const [showOriginal, setShowOriginal] = useState(() => new Set());
  const [adding, setAdding] = useState(false);
  const scrollRef = useRef(null);
  const external = conv.type === 'external';
  const keyRef = useRef(conv.key);
  keyRef.current = conv.key;
  const filterRef = useRef(filter);
  filterRef.current = filter;

  // messages of this conversation only
  const scope = useCallback((q) => {
    if (external) {
      q = q.in('source', EXTERNAL_SOURCES);
      return conv.contactId ? q.eq('contact_id', conv.contactId) : q.is('contact_id', null).eq('external_from', conv.number);
    }
    q = conv.channelId ? q.eq('channel_id', conv.channelId) : q.is('channel_id', null);
    return q.not('source', 'in', `(${EXTERNAL_SOURCES.join(',')})`);
  }, [external, conv.contactId, conv.number, conv.channelId]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const org = await getOrgId();
    let query = scope(supabase.from('messages').select('*').eq('org_id', org)).order('at', { ascending: false }).limit(150);
    if (filter === 'live') query = query.is('archived_at', null).is('deleted_at', null);
    if (filter === 'vip') query = query.eq('vip', true).is('deleted_at', null);
    if (filter === 'archived') query = query.not('archived_at', 'is', null).is('deleted_at', null);
    if (filter === 'deleted') query = query.not('deleted_at', 'is', null);
    const [{ data, error: err }, { data: vip }] = await Promise.all([
      query,
      scope(supabase.from('messages').select('*').eq('org_id', org)).eq('vip', true).is('deleted_at', null).is('archived_at', null).order('vip_at', { ascending: false }).limit(3),
    ]);
    if (err) { setError(err.message); return; }
    setError(null);
    setMessages((data ?? []).reverse());
    setPinned(vip ?? []);
  }, [scope, filter]);

  useEffect(() => { setMessages([]); setFilter('live'); setActionFor(null); setNotice(null); setAdding(false); }, [conv.key]);
  useEffect(() => {
    refresh();
    onRead?.(conv.key);
    const ch = supabase
      .channel(`thread-${Math.random().toString(36).slice(2, 10)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        if (convKeyOf(payload.new) !== keyRef.current || filterRef.current !== 'live') return;
        setMessages(prev => (prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]));
        if (payload.new.sender !== myId) beep(true);
        onRead?.(keyRef.current);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        if (convKeyOf(payload.new) === keyRef.current) refresh();
      })
      .subscribe();
    const id = setInterval(refresh, 60000);
    return () => { clearInterval(id); supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, myId, conv.key]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

  const act = async (m, action) => {
    setActionFor(null);
    const { error: err } = await supabase.rpc('message_action', { p_id: m.id, p_action: action });
    if (err) setError(err.message); else refresh();
  };
  const archiveAll = async () => {
    setConfirmArchiveAll(false);
    const { data, error: err } = await supabase.rpc('archive_channel', { p_channel: conv.channelId });
    if (err) setError(err.message); else { setNotice(t('cx.m.archivedN', { n: data ?? 0 })); refresh(); }
  };
  const canEdit = (m) => m.sender === myId || isCoord;

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setError(null);
    try {
      if (external) {
        if (!conv.contactId) throw new Error(t('cx.th.saveFirst'));
        const { error: err, data } = await supabase.functions.invoke('comms-dispatch', { body: { type: 'direct_sms', contact_id: conv.contactId, text: body, via: conv.lastSource === 'whatsapp' ? 'whatsapp' : 'sms' } });
        if (err || data?.error) {
          let msg = data?.error ?? err?.message;
          try { const j = await err?.context?.json?.(); msg = j?.error ?? msg; } catch { /* not JSON */ }
          throw new Error(['no_line', 'no_number'].includes(msg) ? t(`cx.ct.err.${msg}`) : msg);
        }
      } else {
        const org = await getOrgId();
        const { error: err } = await supabase.from('messages').insert({ org_id: org, sender: myId, text: body, lang, channel_id: conv.channelId });
        if (err) throw err;
        // reach closed apps too — only the people in this conversation
        const audience = conv.type === 'channel'
          ? (conv.minRole && conv.minRole !== 'field' ? members.filter(m => hasAtLeast(m.role, conv.minRole)).map(m => m.id) : null)
          : (conv.members ?? []).filter(id => id !== myId);
        pushToTeam({
          kind: 'message',
          title: conv.type === 'dm' ? (profile?.display_name ?? 'Watchtower') : `${profile?.display_name ?? 'Watchtower'} (${convTitle})`,
          body: body.slice(0, 140), url: '/?tab=comms', tag: `comms:${conv.key}`,
          ...(audience ? { profile_ids: audience } : {}),
        });
      }
      setText('');
      refresh();
    } catch (e) { setError(e.message); }
    setSending(false);
  };

  const { supported: micSupported, listening, interim, start: micStart, stop: micStop } = useSpeech({
    onFinal: (s) => setText(prev => (prev ? prev + ' ' : '') + s.trim()),
  });

  const langOf = (m) => m.lang ?? (m.source && !['app', 'broadcast'].includes(m.source) ? '?' : 'en');
  const foreign = messages.filter(m => m.sender !== myId && m.source !== 'broadcast' && langOf(m) !== lang).map(m => m.text);
  const tr = useTranslations(foreign, lang, foreign.length > 0);
  const memberName = (id) => nameOf[id] ?? '—';
  const notMembers = members.filter(m => !(conv.members ?? []).includes(m.id) && m.role !== 'viewer');

  const header = (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 flex-shrink-0">
      <button onClick={onBack} className="md:hidden p-1 -ml-1 text-slate-300"><ArrowLeft className="w-5 h-5" /></button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
          {conv.type === 'channel' && <Hash className="w-3.5 h-3.5 shrink-0" style={{ color: conv.color }} />}
          {conv.type === 'group' && <Users className="w-3.5 h-3.5 shrink-0 text-sky-300" />}
          {conv.type === 'dm' && <Lock className="w-3.5 h-3.5 shrink-0 text-emerald-300" />}
          {external && <Phone className="w-3.5 h-3.5 shrink-0 text-sky-300" />}
          {convTitle}
        </p>
        <p className="text-[10px] text-slate-500 truncate">
          {conv.type === 'channel' && (conv.channelId ? (conv.description || t('cx.th.channelSub', { r: t(`role.${conv.minRole}`) })) : t('cx.th.allSub'))}
          {conv.type === 'group' && (conv.members ?? []).map(memberName).join(', ')}
          {conv.type === 'dm' && t('cx.th.dmSub')}
          {external && [conv.agency, conv.contact?.phone ?? conv.number].filter(Boolean).join(' · ')}
        </p>
      </div>
      {conv.type === 'group' && (
        <>
          <button onClick={() => setAdding(v => !v)} className="p-1.5 text-slate-400 hover:text-white" title={t('cx.th.addPeople')}><UserPlus className="w-4 h-4" /></button>
          <button onClick={async () => { const { error: err } = await supabase.rpc('group_update', { p_channel: conv.channelId, p_leave: true }); if (err) setError(err.message); else onBack?.(true); }} className="p-1.5 text-slate-400 hover:text-red-300" title={t('cx.th.leave')}><LogOut className="w-4 h-4" /></button>
        </>
      )}
    </div>
  );

  let lastDay = null;
  return (
    <div className="flex flex-col min-h-0 h-full">
      {header}
      {adding && (
        <div className="px-3 py-2 border-b border-slate-800 flex flex-wrap gap-1 flex-shrink-0">
          {notMembers.length === 0 && <span className="text-[11px] text-slate-500">{t('cx.th.everyoneIn')}</span>}
          {notMembers.map(m => (
            <button key={m.id} onClick={async () => { const { error: err } = await supabase.rpc('group_update', { p_channel: conv.channelId, p_add: [m.id] }); if (err) setError(err.message); }}
              className="px-2 py-1 rounded-md border border-slate-700 text-[11px] text-slate-200 hover:border-sky-500/50">+ {m.name}</button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 px-3 py-1.5 flex-shrink-0 flex-wrap">
        {['live', 'vip', 'archived', ...(isCoord ? ['deleted'] : [])].map(f => (
          <button key={f} onClick={() => { setFilter(f); setActionFor(null); }}
            className={`px-2 py-0.5 rounded-md text-[11px] border ${filter === f ? (f === 'vip' ? 'bg-amber-500/20 border-amber-400/60 text-amber-200' : 'bg-slate-700 border-slate-500 text-white') : 'border-slate-800 text-slate-400 hover:text-white'}`}>
            {f === 'vip' && '⭐ '}{f === 'archived' && '🗄 '}{f === 'deleted' && '🗑 '}{t(`cx.m.f.${f}`)}
          </button>
        ))}
        <div className="flex-1" />
        {isCoord && filter === 'live' && conv.type === 'channel' && (confirmArchiveAll
          ? <span className="flex items-center gap-1 text-[11px]">
              <span className="text-slate-300">{t('cx.m.archiveAllQ')}</span>
              <button onClick={archiveAll} className="px-2 py-0.5 rounded bg-slate-200 text-slate-900 font-semibold">{t('cx.m.yes')}</button>
              <button onClick={() => setConfirmArchiveAll(false)} className="px-2 py-0.5 rounded border border-slate-700 text-slate-300">{t('log.cancel')}</button>
            </span>
          : <button onClick={() => setConfirmArchiveAll(true)} className="text-[11px] text-slate-500 hover:text-white flex items-center gap-1"><Archive className="w-3 h-3" />{t('cx.m.archiveAll')}</button>)}
      </div>
      {notice && <p className="px-3 text-[11px] text-green-300 flex-shrink-0">{notice} <button onClick={() => setNotice(null)} className="text-slate-500 ml-1">✕</button></p>}
      {filter === 'live' && pinned.length > 0 && (
        <div className="px-3 pb-1 space-y-1 flex-shrink-0">
          {pinned.map(m => (
            <button key={m.id} onClick={() => document.getElementById(`msg-${m.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="w-full text-left px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-400/40 text-[11px] text-amber-100 flex items-center gap-1.5">
              <Star className="w-3 h-3 fill-amber-300 text-amber-300 shrink-0" />
              <span className="font-semibold shrink-0">{m.external_from ?? nameOf[m.sender] ?? t('cx.team')}:</span>
              <span className="truncate">{m.text}</span>
            </button>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 min-h-[140px] overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && !error && <p className="text-xs text-slate-500 text-center py-8">{filter === 'live' ? t(external ? 'cx.th.emptyExternal' : conv.type === 'dm' ? 'cx.th.emptyDm' : 'comms.empty') : t(`cx.m.empty.${filter}`)}</p>}
        {messages.map(m => {
          const out = external ? m.meta?.direction === 'out' : m.sender === myId && m.source !== 'broadcast';
          const fromOutside = !external && m.source && !['app', 'broadcast'].includes(m.source);
          const day = dayStr(m.at);
          const dayLine = day !== lastDay ? (lastDay = day, <p key={`d-${m.id}`} className="text-center text-[10px] text-slate-500 py-1">{day}</p>) : null;
          const actions = actionFor === m.id && (
            <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-white/10" onClick={e => e.stopPropagation()}>
              {!m.deleted_at && <button onClick={() => act(m, m.vip ? 'unvip' : 'vip')} className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 text-[11px] flex items-center gap-1"><Star className="w-3 h-3" />{m.vip ? t('cx.m.unvip') : t('cx.m.vip')}</button>}
              {!m.deleted_at && canEdit(m) && <button onClick={() => act(m, m.archived_at ? 'unarchive' : 'archive')} className="px-2 py-0.5 rounded bg-slate-700 text-slate-200 text-[11px] flex items-center gap-1"><Archive className="w-3 h-3" />{m.archived_at ? t('cx.m.unarchive') : t('cx.m.archive')}</button>}
              {!m.deleted_at && canEdit(m) && <button onClick={() => act(m, 'delete')} className="px-2 py-0.5 rounded bg-red-600/30 text-red-200 text-[11px] flex items-center gap-1"><Trash2 className="w-3 h-3" />{t('cx.m.delete')}</button>}
              {m.deleted_at && isCoord && <button onClick={() => act(m, 'restore')} className="px-2 py-0.5 rounded bg-slate-700 text-slate-200 text-[11px] flex items-center gap-1"><RotateCcw className="w-3 h-3" />{t('cx.m.restore')}</button>}
              <button onClick={() => navigator.clipboard?.writeText(m.text)} className="px-2 py-0.5 rounded bg-slate-700 text-slate-200 text-[11px] flex items-center gap-1"><Copy className="w-3 h-3" />{t('log.copy')}</button>
            </div>
          );
          const status = (m.deleted_at || m.archived_at) && (
            <p className="text-[9px] text-slate-400 mt-0.5">
              {m.deleted_at ? t('cx.m.deletedBy', { who: nameOf[m.deleted_by] ?? '—', when: new Date(m.deleted_at).toLocaleString() }) : t('cx.m.archivedBy', { who: nameOf[m.archived_by] ?? '—', when: new Date(m.archived_at).toLocaleString() })}
            </p>
          );
          const toggle = () => setActionFor(a => (a === m.id ? null : m.id));
          if (m.source === 'broadcast') return [dayLine, (
            <div key={m.id} id={`msg-${m.id}`} onClick={toggle} className={`rounded-xl border px-3 py-2 cursor-pointer ${m.vip ? 'border-amber-400/70' : 'border-red-500/50'} bg-red-500/15 ${m.deleted_at ? 'opacity-60' : ''}`}>
              <p className="text-[10px] font-bold text-red-300 uppercase flex items-center gap-1">{m.vip && <Star className="w-3 h-3 fill-amber-300 text-amber-300" />}<Siren className="w-3 h-3" />{t('cx.bc.label')} · {nameOf[m.sender] ?? '—'}</p>
              <p className={`text-sm text-white whitespace-pre-wrap break-words font-semibold ${m.deleted_at ? 'line-through' : ''}`}>{m.text}</p>
              <p className="text-[9px] text-slate-400 text-right">{timeStr(m.at)}</p>
              {status}{actions}
            </div>
          )];
          const isForeign = !out && langOf(m) !== lang;
          const translated = isForeign ? tr[m.text] : null;
          const original = showOriginal.has(m.id);
          const shown = translated && translated !== m.text && !original ? translated : m.text;
          const showName = !out && conv.type !== 'dm' && !external;
          return [dayLine, (
            <div key={m.id} id={`msg-${m.id}`} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
              <div onClick={toggle} className={`max-w-[82%] px-3 py-2 rounded-2xl cursor-pointer ${m.deleted_at ? 'opacity-60' : ''} ${m.vip ? 'ring-2 ring-amber-400/70' : ''} ${out ? 'bg-orange-500/20 border border-orange-500/30 rounded-br-md' : fromOutside || external ? 'bg-sky-950/60 border border-sky-800 rounded-bl-md' : 'bg-slate-800 border border-slate-700 rounded-bl-md'}`}>
                {m.vip && <p className="text-[9px] font-bold text-amber-300 flex items-center gap-0.5"><Star className="w-2.5 h-2.5 fill-amber-300" />VIP</p>}
                {(showName || fromOutside) && (
                  <p className={`text-[10px] font-semibold ${fromOutside ? 'text-sky-300' : 'text-orange-300'}`}>
                    {fromOutside ? `${SOURCE_ICON[m.source] ?? '🔗'} ${m.external_from ?? t(`cx.src.${m.source}`)}` : nameOf[m.sender] ?? t('cx.team')}
                    {fromOutside && <span className="font-normal text-slate-400"> · {t(`cx.src.${m.source}`)}</span>}
                  </p>
                )}
                {external && out && m.sender && <p className="text-[10px] text-orange-300">{nameOf[m.sender] ?? t('cx.team')} · {t(`cx.src.${m.source}`)}</p>}
                <p className={`text-sm text-slate-100 whitespace-pre-wrap break-words ${m.deleted_at ? 'line-through' : ''}`}>{shown}</p>
                {m.meta?.lat != null && (
                  <a onClick={e => e.stopPropagation()} href={`https://www.google.com/maps?q=${m.meta.lat},${m.meta.lng}`} target="_blank" rel="noreferrer" className="text-[10px] text-sky-300 underline flex items-center gap-0.5"><MapPin className="w-3 h-3" />{Number(m.meta.lat).toFixed(4)}, {Number(m.meta.lng).toFixed(4)}</a>
                )}
                {m.meta?.media && <a onClick={e => e.stopPropagation()} href={m.meta.media} target="_blank" rel="noreferrer" className="text-[10px] text-sky-300 underline flex items-center gap-0.5"><Paperclip className="w-3 h-3" />{t('cx.attachment')}</a>}
                <p className="text-[9px] text-slate-500 mt-0.5 text-right">
                  {translated && translated !== m.text && (
                    <button onClick={(e) => { e.stopPropagation(); setShowOriginal(prev => { const n = new Set(prev); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; }); }} className="mr-2 underline text-sky-400/80">
                      {original ? t('comms.showTranslation') : langOf(m) === '?' ? t('comms.showOriginal') : `${t('comms.translatedFrom', { lang: langName(langOf(m)) })} · ${t('comms.showOriginal')}`}
                    </button>
                  )}
                  {timeStr(m.at)}
                </p>
                {status}{actions}
              </div>
            </div>
          )];
        })}
      </div>

      {error && <p className="px-3 text-xs text-red-400 flex-shrink-0">{error}</p>}
      {interim && <p className="px-3 text-xs text-orange-300/80 italic flex-shrink-0">{interim}…</p>}
      <div className="flex items-center gap-2 p-2 border-t border-slate-800 flex-shrink-0">
        <button onClick={listening ? micStop : micStart} disabled={!micSupported}
          className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${listening ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-br from-orange-500 to-orange-600'} disabled:opacity-40`}
          title={micSupported ? t('cx.dictate') : t('log.mic.unsupported')}>
          {listening ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
        </button>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(); }}
          placeholder={listening ? t('comms.listening') : external ? t('cx.ct.smsPh', { name: convTitle }) : conv.type === 'channel' ? (conv.channelId ? t('cx.messageChannel', { ch: conv.name }) : t('comms.placeholder')) : t('cx.th.messagePh', { name: convTitle })}
          disabled={external && !conv.contactId}
          className="flex-1 min-w-0 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 disabled:opacity-50" />
        <button onClick={send} disabled={sending || !text.trim()} className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl text-white flex items-center justify-center disabled:opacity-50" title={t('cx.send')}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : external ? <MessageSquare className="w-4 h-4" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      {external && !conv.contactId && <p className="px-3 pb-2 text-[10px] text-slate-500">{t('cx.th.saveFirst')}</p>}
    </div>
  );
};

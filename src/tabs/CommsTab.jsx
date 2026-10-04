import { useState, useEffect, useCallback, useRef } from 'react';
import { Radio, Send, Loader2, Mic, MicOff, Siren, Settings2, Plus, X, Check, Archive, MapPin, Paperclip, MessagesSquare, Contact2, Megaphone } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getOrgId } from '../lib/org';
import { useAuth } from '../auth/AuthContext';
import { useTeam } from '../hooks/useTeam';
import { usePresence } from '../hooks/usePresence';
import { useSpeech } from '../hooks/useSpeech';
import { beep } from '../lib/speechFeedback';
import { pushToTeam } from '../lib/push';
import { allowedTabs, hasAtLeast, ROLES } from '../auth/roles';
import { CheckInBoard } from '../components/CheckInBoard';
import { useCheckinsShared } from '../hooks/useCheckins';
import { useChannels, useContacts, useBroadcasts } from '../hooks/useComms';
import { ContactsPanel } from '../components/ContactsPanel';
import { BroadcastComposer, BroadcastList } from '../components/Broadcasts';
import { useI18n, langName } from '../i18n/index.jsx';
import { useTranslations } from '../lib/translate';

// ============================================
// COMMS — channels, outside contacts, emergency broadcasts.
// "All hands" is the company-wide conversation; coordinators add channels
// (Command, TAC-1, Medical…) with a minimum rank. Messages from connected
// systems (SMS, WhatsApp, Telegram, radio/dispatch gateways) arrive in the
// channel their connector points to.
// ============================================

const timeStr = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const SOURCE_ICON = { sms: '📱', whatsapp: '🟢', telegram: '✈️', webhook: '🔗', radio: '📻', email: '✉️' };
const COLORS = ['#f97316', '#ef4444', '#eab308', '#22c55e', '#38bdf8', '#a855f7', '#ec4899', '#94a3b8'];

const ChannelManager = ({ channels, save, archive, onClose }) => {
  const { t } = useI18n();
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState(null);
  const input = 'w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500';
  const submit = async () => {
    try { await save(edit); setEdit(null); setErr(null); } catch (e) { setErr(e.message); }
  };
  return (
    <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-2 flex-shrink-0">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-white">{t('cx.ch.manage')}</p>
        <button onClick={onClose} className="text-slate-400"><X className="w-4 h-4" /></button>
      </div>
      {channels.map(c => (
        <div key={c.id} className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
          <span className="text-white flex-1 min-w-0 truncate"># {c.name}</span>
          <span className="text-[10px] text-slate-500">{t('cx.ch.minRole', { r: t(`role.${c.min_role}`) })}</span>
          <button onClick={() => setEdit({ ...c })} className="text-[11px] text-slate-400 hover:text-white">{t('cx.ch.edit')}</button>
          <button onClick={() => archive(c.id).catch(e => setErr(e.message))} className="p-1 text-slate-500 hover:text-red-400" title={t('cx.ch.archive')}><Archive className="w-3.5 h-3.5" /></button>
        </div>
      ))}
      {edit ? (
        <div className="space-y-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700">
          <input className={input} value={edit.name} onChange={e => setEdit(v => ({ ...v, name: e.target.value }))} placeholder={t('cx.ch.namePh')} maxLength={60} autoFocus />
          <input className={input} value={edit.description ?? ''} onChange={e => setEdit(v => ({ ...v, description: e.target.value }))} placeholder={t('cx.ch.descPh')} />
          <div className="flex items-center gap-1.5 flex-wrap">
            {COLORS.map(c => <button key={c} onClick={() => setEdit(v => ({ ...v, color: c }))} className={`w-6 h-6 rounded-full border-2 ${edit.color === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} />)}
          </div>
          <select className={input} value={edit.min_role} onChange={e => setEdit(v => ({ ...v, min_role: e.target.value }))}>
            {ROLES.filter(r => r !== 'viewer').map(r => <option key={r} value={r}>{t('cx.ch.whoCanSee', { r: t(`role.${r}`) })}</option>)}
          </select>
          <div className="flex gap-2">
            <button disabled={!edit.name?.trim()} onClick={submit} className="px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1"><Check className="w-3.5 h-3.5" />{t('veh.save')}</button>
            <button onClick={() => setEdit(null)} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300">{t('log.cancel')}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEdit({ name: '', color: COLORS[channels.length % COLORS.length], min_role: 'field', sort: channels.length })} className="text-[11px] text-orange-300 flex items-center gap-1"><Plus className="w-3 h-3" />{t('cx.ch.add')}</button>
      )}
      <p className="text-[10px] text-slate-500">{t('cx.ch.help')}</p>
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  );
};

export const CommsTab = () => {
  const { profile, session } = useAuth();
  const { liveMembers, teams } = useTeam();
  const onlineIds = usePresence();
  const checkinsShared = useCheckinsShared();
  const { t, lang } = useI18n();
  const { channels, save: saveChannel, archive: archiveChannel } = useChannels();
  const { contacts, groups } = useContacts();
  const { broadcasts, acks } = useBroadcasts();
  const [view, setView] = useState('messages'); // messages | contacts | broadcasts
  const [channelId, setChannelId] = useState(() => { try { return localStorage.getItem('wt-comms-channel') || null; } catch { return null; } });
  const [manage, setManage] = useState(false);
  const [composing, setComposing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(() => new Set());
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const myId = session?.user?.id;
  const isCoord = hasAtLeast(profile?.role, 'coordinator');
  const nameOf = Object.fromEntries(liveMembers.map(m => [m.id, m.name]));
  const channel = channels.find(c => c.id === channelId) ?? null;
  const chanRef = useRef(channelId);
  chanRef.current = channelId;

  // a channel that was archived or isn't visible any more → back to All hands
  useEffect(() => { if (channelId && channels.length && !channels.some(c => c.id === channelId)) setChannelId(null); }, [channels, channelId]);
  useEffect(() => { try { if (channelId) localStorage.setItem('wt-comms-channel', channelId); else localStorage.removeItem('wt-comms-channel'); } catch { /* storage unavailable */ } }, [channelId]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const org = await getOrgId();
    let query = supabase.from('messages').select('*').eq('org_id', org).order('at', { ascending: false }).limit(100);
    query = channelId ? query.eq('channel_id', channelId) : query.is('channel_id', null);
    const { data, error: err } = await query;
    if (err) { setError(err.message); return; }
    setError(null);
    setMessages((data ?? []).reverse());
  }, [channelId]);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel(`messages-live-${Math.random().toString(36).slice(2, 10)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        if ((payload.new.channel_id ?? null) !== (chanRef.current ?? null)) return;
        setMessages(prev => (prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]));
        if (payload.new.sender !== myId) beep(true);
      })
      .subscribe();
    const id = setInterval(refresh, 60 * 1000); // safety net
    return () => { clearInterval(id); supabase.removeChannel(ch); };
  }, [refresh, myId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, view]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const org = await getOrgId();
    const { error: err } = await supabase.from('messages').insert({ org_id: org, sender: myId, text: body, lang, channel_id: channelId });
    if (err) setError(err.message);
    else {
      setText('');
      setError(null);
      // reach closed apps too — only the people allowed in this channel
      const minRole = channel?.min_role ?? 'field';
      const audience = liveMembers.filter(m => hasAtLeast(m.role, minRole)).map(m => m.id);
      pushToTeam({
        kind: 'message',
        title: `${profile?.display_name ?? 'Watchtower'} (${channel ? `#${channel.name}` : t('comms.title')})`,
        body: body.slice(0, 140),
        url: '/?tab=comms',
        tag: `comms:${channelId ?? 'all'}`,
        ...(minRole !== 'field' ? { profile_ids: audience } : {}),
      });
    }
    setSending(false);
  };

  const { supported: micSupported, listening, interim, start: micStart, stop: micStop } = useSpeech({
    onFinal: (s) => setText(prev => (prev ? prev + ' ' : '') + s.trim()),
  });

  const onlineCount = liveMembers.filter(m => onlineIds.has(m.id)).length;
  // app messages without a language tag are English; outside systems' language is unknown
  const langOf = (m) => m.lang ?? (m.source && !['app', 'broadcast'].includes(m.source) ? '?' : 'en');
  const foreign = messages.filter(m => m.sender !== myId && m.source !== 'broadcast' && langOf(m) !== lang).map(m => m.text);
  const tr = useTranslations(foreign, lang, foreign.length > 0);
  const openBroadcasts = broadcasts.filter(b => b.status === 'active' && b.require_ack && !acks.some(a => a.broadcast_id === b.id && a.profile_id === myId)).length;
  const tabBtn = (v, Icon, label, badge) => (
    <button onClick={() => setView(v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${view === v ? 'bg-orange-500/20 text-orange-200 border border-orange-500/40' : 'text-slate-400 border border-transparent hover:text-white'}`}>
      <Icon className="w-3.5 h-3.5" />{label}{badge ? <span className="px-1.5 rounded-full bg-red-600 text-white text-[10px]">{badge}</span> : null}
    </button>
  );

  return (
    <div className="max-w-2xl mx-auto h-full flex flex-col gap-2">
      <div className="flex items-center justify-between flex-shrink-0 gap-2 flex-wrap">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Radio className="w-6 h-6 text-orange-400" />
          {t('comms.title')}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {liveMembers.slice(0, 8).map(m => (
            <span key={m.id} className="flex items-center gap-1 text-[10px] text-slate-400" title={m.name}>
              <span className={`w-2 h-2 rounded-full inline-block ${onlineIds.has(m.id) ? 'bg-green-400' : 'bg-slate-600'}`} />
              {m.name.split(' ')[0]}
            </span>
          ))}
          <span className="text-[10px] text-slate-600">{t('comms.online', { n: onlineCount })}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
        {tabBtn('messages', MessagesSquare, t('cx.v.messages'))}
        {tabBtn('contacts', Contact2, t('cx.v.contacts'))}
        {tabBtn('broadcasts', Megaphone, t('cx.v.broadcasts'), openBroadcasts)}
        <div className="flex-1" />
        {isCoord && (
          <button onClick={() => setComposing(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold">
            <Siren className="w-3.5 h-3.5" />{t('cx.bc.button')}
          </button>
        )}
      </div>

      {checkinsShared && !allowedTabs(profile?.role).includes('team') && view === 'messages' && (
        <div className="flex-shrink-0">
          <CheckInBoard members={liveMembers} teams={teams} checkins={checkinsShared.checkins} responses={checkinsShared.responses}
            requestCheckin={checkinsShared.requestCheckin} closeCheckin={checkinsShared.closeCheckin} />
        </div>
      )}

      {view === 'messages' && (
        <>
          <div className="flex items-center gap-1 overflow-x-auto flex-shrink-0 pb-0.5">
            <button onClick={() => setChannelId(null)} className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap border ${!channelId ? 'bg-slate-700 border-slate-500 text-white' : 'border-slate-800 text-slate-400 hover:text-white'}`}># {t('cx.allHands')}</button>
            {channels.map(c => (
              <button key={c.id} onClick={() => setChannelId(c.id)} title={c.description ?? ''}
                className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap border flex items-center gap-1.5 ${channelId === c.id ? 'bg-slate-700 border-slate-500 text-white' : 'border-slate-800 text-slate-400 hover:text-white'}`}>
                <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />{c.name}
              </button>
            ))}
            {isCoord && <button onClick={() => setManage(v => !v)} className="p-1.5 text-slate-500 hover:text-white" title={t('cx.ch.manage')}><Settings2 className="w-3.5 h-3.5" /></button>}
          </div>
          {manage && <ChannelManager channels={channels} save={saveChannel} archive={archiveChannel} onClose={() => setManage(false)} />}

          <div ref={scrollRef} className="flex-1 min-h-[160px] overflow-y-auto bg-slate-900/50 border border-slate-800 rounded-xl p-3 space-y-2">
            {messages.length === 0 && !error && <p className="text-xs text-slate-500 text-center py-8">{t('comms.empty')}</p>}
            {error && <p className="text-xs text-red-400 text-center py-4">{error}</p>}
            {messages.map(m => {
              const mine = m.sender === myId && m.source !== 'broadcast';
              const external = m.source && !['app', 'broadcast'].includes(m.source);
              if (m.source === 'broadcast') return (
                <div key={m.id} className="rounded-xl border border-red-500/50 bg-red-500/15 px-3 py-2">
                  <p className="text-[10px] font-bold text-red-300 uppercase flex items-center gap-1"><Siren className="w-3 h-3" />{t('cx.bc.label')} · {nameOf[m.sender] ?? '—'}</p>
                  <p className="text-sm text-white whitespace-pre-wrap break-words font-semibold">{m.text}</p>
                  <p className="text-[9px] text-slate-400 text-right">{timeStr(m.at)}</p>
                </div>
              );
              const isForeign = !mine && langOf(m) !== lang;
              const translated = isForeign ? tr[m.text] : null;
              const original = showOriginal.has(m.id);
              const shown = translated && translated !== m.text && !original ? translated : m.text;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl ${mine ? 'bg-orange-500/20 border border-orange-500/30' : external ? 'bg-sky-950/60 border border-sky-800' : 'bg-slate-800 border border-slate-700'}`}>
                    {!mine && (
                      <p className={`text-[10px] font-semibold ${external ? 'text-sky-300' : 'text-orange-300'}`}>
                        {external && `${SOURCE_ICON[m.source] ?? '🔗'} `}{external ? m.external_from ?? t(`cx.src.${m.source}`) : nameOf[m.sender] ?? t('cx.team')}
                        {external && <span className="font-normal text-slate-400"> · {t(`cx.src.${m.source}`)}</span>}
                      </p>
                    )}
                    <p className="text-sm text-slate-100 whitespace-pre-wrap break-words">{shown}</p>
                    {m.meta?.lat != null && (
                      <a href={`https://www.google.com/maps?q=${m.meta.lat},${m.meta.lng}`} target="_blank" rel="noreferrer" className="text-[10px] text-sky-300 underline flex items-center gap-0.5"><MapPin className="w-3 h-3" />{Number(m.meta.lat).toFixed(4)}, {Number(m.meta.lng).toFixed(4)}</a>
                    )}
                    {m.meta?.media && <a href={m.meta.media} target="_blank" rel="noreferrer" className="text-[10px] text-sky-300 underline flex items-center gap-0.5"><Paperclip className="w-3 h-3" />{t('cx.attachment')}</a>}
                    <p className="text-[9px] text-slate-500 mt-0.5 text-right">
                      {translated && translated !== m.text && (
                        <button onClick={() => setShowOriginal(prev => { const n = new Set(prev); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })} className="mr-2 underline text-sky-400/80">
                          {original ? t('comms.showTranslation') : langOf(m) === '?' ? t('comms.showOriginal') : `${t('comms.translatedFrom', { lang: langName(langOf(m)) })} · ${t('comms.showOriginal')}`}
                        </button>
                      )}
                      {timeStr(m.at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {interim && <p className="text-xs text-orange-300/80 italic flex-shrink-0">{interim}…</p>}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={listening ? micStop : micStart} disabled={!micSupported}
              className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all ${listening ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-br from-orange-500 to-orange-600 hover:scale-105'} disabled:opacity-40`}
              title={micSupported ? t('cx.dictate') : t('log.mic.unsupported')}>
              {listening ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
            </button>
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(); }}
              placeholder={listening ? t('comms.listening') : channel ? t('cx.messageChannel', { ch: channel.name }) : t('comms.placeholder')}
              className="flex-1 min-w-0 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500" />
            <button onClick={send} disabled={sending || !text.trim()}
              className="flex-shrink-0 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {t('cx.send')}
            </button>
          </div>
        </>
      )}

      {view === 'contacts' && <div className="flex-1 min-h-0 overflow-y-auto"><ContactsPanel canManage={isCoord} /></div>}
      {view === 'broadcasts' && <div className="flex-1 min-h-0 overflow-y-auto"><BroadcastList members={liveMembers} contacts={contacts} canManage={isCoord} /></div>}

      {composing && <BroadcastComposer channels={channels} groups={groups} onClose={(sent) => { setComposing(false); if (sent) setView('broadcasts'); }} />}
    </div>
  );
};

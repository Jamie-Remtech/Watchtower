import { useState, useEffect, useCallback, useRef } from 'react';
import { Radio, Send, Loader2, Mic, MicOff } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useTeam } from '../hooks/useTeam';
import { usePresence } from '../hooks/usePresence';
import { useSpeech } from '../hooks/useSpeech';
import { beep } from '../lib/speechFeedback';
import { pushToTeam } from '../lib/push';
import { allowedTabs } from '../auth/roles';
import { CheckInBoard } from '../components/CheckInBoard';
import { useCheckinsShared } from '../hooks/useCheckins';
import { useI18n, langName } from '../i18n/index.jsx';
import { useTranslations } from '../lib/translate';

// ============================================
// COMMS — the org channel
// Realtime team messaging inside the operational picture. One channel
// per organization (v1); everyone field-and-up can talk.
// ============================================

const timeStr = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const CommsTab = () => {
  const { profile, session } = useAuth();
  const { liveMembers, teams } = useTeam();
  const onlineIds = usePresence();
  const checkinsShared = useCheckinsShared();
  const { t, lang } = useI18n();
  const [showOriginal, setShowOriginal] = useState(() => new Set());
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const myId = session?.user?.id;
  const nameOf = Object.fromEntries(liveMembers.map(m => [m.id, m.name]));

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data, error: err } = await supabase
      .from('messages')
      .select('*')
      .order('at', { ascending: false })
      .limit(100);
    if (err) {
      if (/does not exist/i.test(err.message)) setError('Messages table missing — run migration 0010 in the Supabase SQL Editor.');
      return;
    }
    setError(null);
    setMessages((data ?? []).reverse());
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel('messages-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        if (payload.new.sender !== myId) beep(true);
      })
      .subscribe();
    const t = setInterval(refresh, 60 * 1000); // safety net
    return () => { clearInterval(t); supabase.removeChannel(channel); };
  }, [refresh, myId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const orgId = localStorage.getItem('watchtower-org-id');
    let org = orgId;
    if (!org) {
      const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', myId).single();
      org = prof?.org_id;
      if (org) localStorage.setItem('watchtower-org-id', org);
    }
    const { error: err } = await supabase.from('messages').insert({ org_id: org, sender: myId, text: body, lang });
    if (err) {
      setError(/does not exist/i.test(err.message)
        ? 'Messages table missing — run migration 0010 in the Supabase SQL Editor.'
        : err.message);
    } else {
      setText('');
      setError(null);
      // Reach closed apps too
      pushToTeam({
        kind: 'message',
        title: `${profile?.display_name ?? 'Watchtower'} (Comms)`,
        body: body.slice(0, 140),
        url: '/',
        tag: 'comms',
      });
    }
    setSending(false);
  };

  // Speak instead of typing — same engine as the Field Log.
  const { supported: micSupported, listening, interim, start: micStart, stop: micStop } = useSpeech({
    onFinal: (t) => setText(prev => (prev ? prev + ' ' : '') + t.trim()),
  });

  const onlineCount = liveMembers.filter(m => onlineIds.has(m.id)).length;

  // Others' messages written in another language are shown in mine
  const foreign = messages.filter(m => m.sender !== myId && (m.lang ?? 'en') !== lang).map(m => m.text);
  const tr = useTranslations(foreign, lang, foreign.length > 0);

  return (
    <div className="max-w-2xl mx-auto h-full flex flex-col gap-3">
      <div className="flex items-center justify-between flex-shrink-0">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Radio className="w-6 h-6 text-orange-400" />
          {t('comms.title')}
        </h2>
        <div className="flex items-center gap-2">
          {liveMembers.map(m => (
            <span key={m.id} className="flex items-center gap-1 text-[10px] text-slate-400" title={m.name}>
              <span className={`w-2 h-2 rounded-full inline-block ${onlineIds.has(m.id) ? 'bg-green-400' : 'bg-slate-600'}`} />
              {m.name.split(' ')[0]}
            </span>
          ))}
          <span className="text-[10px] text-slate-600">{t('comms.online', { n: onlineCount })}</span>
        </div>
      </div>

      {/* Field ranks can't open the Team tab; when their org lets them
          request check-ins, the board lives here too */}
      {checkinsShared && !allowedTabs(profile?.role).includes('team') && (
        <div className="flex-shrink-0">
          <CheckInBoard
            members={liveMembers}
            teams={teams}
            checkins={checkinsShared.checkins}
            responses={checkinsShared.responses}
            requestCheckin={checkinsShared.requestCheckin}
            closeCheckin={checkinsShared.closeCheckin}
          />
        </div>
      )}

      <div ref={scrollRef} className="flex-1 min-h-[160px] overflow-y-auto bg-slate-900/50 border border-slate-800 rounded-xl p-3 space-y-2">
        {messages.length === 0 && !error && (
          <p className="text-xs text-slate-500 text-center py-8">
            {t('comms.empty')}
          </p>
        )}
        {error && <p className="text-xs text-red-400 text-center py-4">{error}</p>}
        {messages.map(m => {
          const mine = m.sender === myId;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-xl ${
                mine ? 'bg-orange-500/20 border border-orange-500/30' : 'bg-slate-800 border border-slate-700'
              }`}>
                {!mine && (
                  <p className="text-[10px] font-semibold text-orange-300">{nameOf[m.sender] ?? 'Team'}</p>
                )}
                {(() => {
                  const isForeign = !mine && (m.lang ?? 'en') !== lang;
                  const translated = isForeign ? tr[m.text] : null;
                  const original = showOriginal.has(m.id);
                  const shown = translated && translated !== m.text && !original ? translated : m.text;
                  return (
                    <>
                      <p className="text-sm text-slate-100 whitespace-pre-wrap break-words">{shown}</p>
                      <p className="text-[9px] text-slate-500 mt-0.5 text-right">
                        {translated && translated !== m.text && (
                          <button
                            onClick={() => setShowOriginal(prev => { const n = new Set(prev); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })}
                            className="mr-2 underline text-sky-400/80"
                          >
                            {original ? t('comms.showTranslation') : `${t('comms.translatedFrom', { lang: langName(m.lang ?? 'en') })} · ${t('comms.showOriginal')}`}
                          </button>
                        )}
                        {timeStr(m.at)}
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>

      {interim && <p className="text-xs text-orange-300/80 italic flex-shrink-0">{interim}…</p>}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={listening ? micStop : micStart}
          disabled={!micSupported}
          className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
            listening ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-br from-orange-500 to-orange-600 hover:scale-105'
          } disabled:opacity-40`}
          title={micSupported ? 'Dictate a message' : 'Speech recognition not supported here'}
        >
          {listening ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
        </button>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(); }}
          placeholder={listening ? t('comms.listening') : t('comms.placeholder')}
          className="flex-1 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="flex-shrink-0 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Send
        </button>
      </div>
    </div>
  );
};

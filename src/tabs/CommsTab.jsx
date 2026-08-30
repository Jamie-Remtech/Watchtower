import { useState, useEffect, useCallback, useRef } from 'react';
import { Radio, Send, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useTeam } from '../hooks/useTeam';
import { usePresence } from '../hooks/usePresence';
import { beep } from '../lib/speechFeedback';

// ============================================
// COMMS — the org channel
// Realtime team messaging inside the operational picture. One channel
// per organization (v1); everyone field-and-up can talk.
// ============================================

const timeStr = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const CommsTab = () => {
  const { profile, session } = useAuth();
  const { liveMembers } = useTeam();
  const onlineIds = usePresence();
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
    const { error: err } = await supabase.from('messages').insert({ org_id: org, sender: myId, text: body });
    if (err) {
      setError(/does not exist/i.test(err.message)
        ? 'Messages table missing — run migration 0010 in the Supabase SQL Editor.'
        : err.message);
    } else {
      setText('');
      setError(null);
    }
    setSending(false);
  };

  const onlineCount = liveMembers.filter(m => onlineIds.has(m.id)).length;

  return (
    <div className="max-w-2xl mx-auto h-full flex flex-col gap-3">
      <div className="flex items-center justify-between flex-shrink-0">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Radio className="w-6 h-6 text-orange-400" />
          Comms
        </h2>
        <div className="flex items-center gap-2">
          {liveMembers.map(m => (
            <span key={m.id} className="flex items-center gap-1 text-[10px] text-slate-400" title={m.name}>
              <span className={`w-2 h-2 rounded-full inline-block ${onlineIds.has(m.id) ? 'bg-green-400' : 'bg-slate-600'}`} />
              {m.name.split(' ')[0]}
            </span>
          ))}
          <span className="text-[10px] text-slate-600">· {onlineCount} online</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-[300px] overflow-y-auto bg-slate-900/50 border border-slate-800 rounded-xl p-3 space-y-2">
        {messages.length === 0 && !error && (
          <p className="text-xs text-slate-500 text-center py-8">
            The org channel is open. Say something — everyone field-and-up sees it instantly, on every device.
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
                <p className="text-sm text-slate-100 whitespace-pre-wrap break-words">{m.text}</p>
                <p className="text-[9px] text-slate-500 mt-0.5 text-right">{timeStr(m.at)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(); }}
          placeholder={`Message the team${profile?.display_name ? ` as ${profile.display_name}` : ''}…`}
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

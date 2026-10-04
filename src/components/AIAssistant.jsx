import { useState, useRef, useEffect } from 'react';
import { Zap, XCircle, Mic, MicOff, Send, Loader2, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { gatherContext } from '../lib/aiContext';
import { useSpeech } from '../hooks/useSpeech';
import { say } from '../lib/speechFeedback';
import { logEvent } from '../lib/eventLog';
import { executeAiAction } from '../lib/aiActions';
import { useI18n } from '../i18n/index.jsx';

// ============================================
// WATCHTOWER AI — voice Q&A over the live operation
// Ask about crew, patients, devices, markers, weather, alerts.
// The assistant sees a fresh snapshot of YOUR org's state (via your
// own session, so permissions apply) and answers radio-style.
// ============================================

// translation keys (English in src/i18n/extra/ai.js); asked in the member's language
const SUGGESTIONS = [
  'ai.suggest.situation',
  'ai.suggest.patients',
  'ai.suggest.alerts',
  'ai.suggest.weather',
  'ai.suggest.checkin',
];

export const AIAssistant = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [speak, setSpeak] = useState(true);
  const speakRef = useRef(speak);
  speakRef.current = speak;
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const askRef = useRef(null);

  const ask = async (question) => {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    try {
      const context = await gatherContext();
      const history = messages.slice(-6);
      const { data, error } = await supabase.functions.invoke('field-assist', {
        body: { mode: 'ask', question: q, context, history, language: document.documentElement.lang || 'en' },
      });
      if (error || (!data?.answer && !data?.actions?.length)) throw error ?? new Error(data?.error ?? 'no answer');
      if (data.answer) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
        if (speakRef.current) say(data.answer);
      }
      // Execute any actions with THIS user's session — RLS applies,
      // and each outcome is confirmed in the chat (and spoken).
      for (const action of data.actions ?? []) {
        let outcome;
        try {
          outcome = await executeAiAction(action, q);
        } catch (e) {
          outcome = t('ai.actionFailed', { error: e.message ?? t('ai.unknownError') });
        }
        setMessages(prev => [...prev, { role: 'assistant', content: `⚡ ${outcome}`, action: true }]);
        if (speakRef.current) say(outcome);
      }
      logEvent('ai.asked', { question: q, actions: (data.actions ?? []).map(a => a.name) });
    } catch (err) {
      const msg = /ANTHROPIC_API_KEY|unknown mode/i.test(err?.message ?? '')
        ? t('ai.needsRedeploy')
        : t('ai.unreachable', { error: err?.message ?? t('ai.network') });
      setMessages(prev => [...prev, { role: 'assistant', content: msg, error: true }]);
    }
    setBusy(false);
  };
  askRef.current = ask;

  const { supported, listening, interim, start, stop } = useSpeech({
    onFinal: (t) => { stop(); askRef.current?.(t); },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 sm:inset-auto sm:bottom-4 sm:right-4 sm:w-[420px] bg-slate-900 sm:border sm:border-slate-700 sm:rounded-xl shadow-2xl z-50 flex flex-col sm:max-h-[min(600px,calc(100dvh-2rem))] h-full sm:h-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">{t('ai.title')}</h3>
            <p className="text-[10px] text-slate-500">{t('ai.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setSpeak(s => !s); if (speak) window.speechSynthesis?.cancel(); }}
            className={`p-2 rounded-lg hover:bg-slate-800 ${speak ? 'text-orange-400' : 'text-slate-500'}`}
            title={speak ? t('ai.voiceOn') : t('ai.voiceOff')}
          >
            {speak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg">
            <XCircle className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[120px]">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400">
              {t('ai.intro')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => ask(t(s))}
                  className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-[11px] text-slate-300 hover:border-orange-500/40 hover:text-orange-300 text-left"
                >
                  {t(s)}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-orange-500/20 border border-orange-500/30 text-orange-100'
                : m.error
                  ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                  : m.action
                    ? 'bg-purple-500/10 border border-purple-500/30 text-purple-200'
                    : 'bg-slate-800 border border-slate-700 text-slate-100'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700">
              <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
            </div>
          </div>
        )}
        {interim && <p className="text-xs text-orange-300/80 italic">{interim}…</p>}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-700 flex items-center gap-2 flex-shrink-0">
        <button
          onClick={listening ? stop : start}
          disabled={!supported || busy}
          className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${
            listening ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-br from-orange-500 to-orange-600 hover:scale-105'
          } disabled:opacity-40 transition-all`}
          title={supported ? t('ai.askVoice') : t('ai.noSpeech')}
        >
          {listening ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
        </button>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') ask(input); }}
          placeholder={listening ? t('comms.listening') : t('ai.placeholder')}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
        />
        <button
          onClick={() => ask(input)}
          disabled={busy || !input.trim()}
          className="flex-shrink-0 p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-orange-400 disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

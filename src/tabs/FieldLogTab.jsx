import { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, Send, Loader2, MapPin, ClipboardList, Radio, Info } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logEvent } from '../lib/eventLog';
import { useSpeech } from '../hooks/useSpeech';
import { usePositions } from '../hooks/usePositions';

// ============================================
// FIELD LOG — hands-free action recording
// Medics and field crews dictate what they're doing ("administering
// 5 mg of X, patient unresponsive"); every entry is saved to the
// events log with time and GPS position. Admin work shrinks to
// speaking; the record builds itself.
// ============================================

const quickPosition = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 30000 }
    );
  });

const timeAgo = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleString();
};

export const FieldLogTab = () => {
  const isLive = isSupabaseConfigured;
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [reports, setReports] = useState([]);
  const [names, setNames] = useState({});
  const { sharing, startSharing, stopSharing, lastSent, shareError } = usePositions();

  const { supported, listening, interim, start, stop } = useSpeech({
    onFinal: (t) => setText(prev => (prev ? prev + ' ' : '') + t),
  });

  const refresh = useCallback(async () => {
    if (!isLive) return;
    const [{ data: events }, { data: profiles }] = await Promise.all([
      supabase.from('events').select('*').eq('type', 'field.report').order('at', { ascending: false }).limit(50),
      supabase.from('profiles').select('id, display_name'),
    ]);
    setReports(events ?? []);
    setNames(Object.fromEntries((profiles ?? []).map(p => [p.id, p.display_name])));
  }, [isLive]);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    const body = text.trim();
    if (!body) return;
    setSaving(true);
    if (listening) stop();
    const pos = await quickPosition();
    await logEvent('field.report', { text: body, ...(pos ?? {}) });
    setText('');
    await refresh();
    setSaving(false);
  };

  const list = reports;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-orange-400" />
          Field Log
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Speak your actions — they're recorded with time and position. Paperwork writes itself.
        </p>
      </div>

      {/* Dictation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <button
            onClick={listening ? stop : start}
            disabled={!supported}
            className={`flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
              listening
                ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/40'
                : 'bg-gradient-to-br from-orange-500 to-orange-600 hover:scale-105'
            } disabled:opacity-40 disabled:hover:scale-100`}
            title={supported ? (listening ? 'Stop dictation' : 'Start dictation') : 'Speech recognition not supported in this browser'}
          >
            {listening ? <MicOff className="w-7 h-7 text-white" /> : <Mic className="w-7 h-7 text-white" />}
          </button>
          <div className="flex-1 min-w-0">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={4}
              placeholder={supported
                ? 'Tap the mic and speak: "Administering 5 mg of adrenaline, patient unresponsive, starting CPR" — or type here.'
                : 'Type your report here (or use your keyboard’s mic dictation key).'}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500 resize-none"
            />
            {interim && <p className="text-xs text-orange-300/80 italic mt-1">{interim}…</p>}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-500 flex items-center gap-1">
            <MapPin className="w-3 h-3" />Position and time are attached automatically
          </p>
          <button
            onClick={save}
            disabled={saving || !text.trim()}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Log entry
          </button>
        </div>

        {!supported && (
          <p className="text-[10px] text-yellow-500/90 flex items-start gap-1.5">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
            This browser has no built-in speech recognition — Chrome and Android work best. On iPhone, tap the mic key on the keyboard to dictate into the box.
          </p>
        )}
      </div>

      {/* Live location sharing */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white flex items-center gap-2">
            <Radio className={`w-4 h-4 ${sharing ? 'text-green-400' : 'text-slate-500'}`} />
            Share my live position
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {sharing
              ? `Broadcasting to the tactical map${lastSent ? ` · last fix ${timeAgo(lastSent.toISOString())}` : ''} · keep the app open`
              : isLive ? 'Your team sees you on the tactical map while this is on' : 'Available in live mode'}
          </p>
          {shareError && <p className="text-[10px] text-red-400 mt-0.5">{shareError}</p>}
        </div>
        <button
          onClick={sharing ? stopSharing : startSharing}
          disabled={!isLive}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex-shrink-0 disabled:opacity-40 ${
            sharing ? 'bg-green-500/20 border border-green-500/40 text-green-400' : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {sharing ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* History */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-white">
          Recent entries {list.length > 0 && <span className="text-slate-500 font-normal">({list.length})</span>}
        </h3>
        {list.length === 0 ? (
          <p className="text-xs text-slate-500">
            No entries yet. Every logged action becomes part of the incident record — searchable, timestamped, located.
          </p>
        ) : (
          list.map(r => (
            <div key={r.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
              <p className="text-sm text-slate-100 whitespace-pre-wrap">{r.payload?.text}</p>
              <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-2 flex-wrap">
                <span>{names[r.actor_id] ?? 'You'}</span>
                <span>·</span>
                <span>{timeAgo(r.at)}</span>
                {r.payload?.lat != null && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" />
                      {Number(r.payload.lat).toFixed(4)}, {Number(r.payload.lng).toFixed(4)}
                    </span>
                  </>
                )}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

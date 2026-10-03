import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Truck, ShieldCheck, LifeBuoy, Mic, Send, AlertTriangle, Navigation, X, Volume2, VolumeX,
  Moon, Sun, SunMoon, LocateFixed, Pin, Wifi, WifiOff, Pencil, Loader2, Layers,
} from 'lucide-react';
import TacticalMap from '../components/TacticalMap';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/index.jsx';
import { useCheckinsShared } from '../hooks/useCheckins';
import { usePositions } from '../hooks/usePositions';
import { useTeam } from '../hooks/useTeam';
import { useMarkers, markerMeta } from '../hooks/useMarkers';
import { useSpeech } from '../hooks/useSpeech';
import { getLastCoords, subscribeTracker } from '../lib/tracker';
import { getOrgId } from '../lib/org';
import { pushToTeam } from '../lib/push';
import { logEvent } from '../lib/eventLog';
import { say, beep } from '../lib/speechFeedback';
import { translateMany, useTranslations } from '../lib/translate';

// ============================================
// VEHICLE MODE — one glanceable screen for a cab tablet / MDT.
// Map + the newest alert + glove-sized actions + team messages, read
// aloud so nobody reads while driving. Screen stays awake; dims at
// night. Landscape puts the controls beside the map, portrait below.
// ============================================

const AUTO_KEY = 'wt-vehicle-screen';
const VOICE_KEY = 'wt-veh-voice';
const DIM_KEY = 'wt-veh-dim';
const FRESH_MS = 10 * 60 * 1000;
const MAX_CHECKIN_AGE = 3 * 3600e3;
const HAZARD_KINDS = ['hazard', 'blocked', 'fire', 'medical', 'water'];
const HOLD_MS = 1000;

export const vehicleAutoStart = () => {
  try { return localStorage.getItem(AUTO_KEY) === '1'; } catch { return false; }
};
const setVehicleAutoStart = (on) => {
  try { on ? localStorage.setItem(AUTO_KEY, '1') : localStorage.removeItem(AUTO_KEY); } catch { /* private mode */ }
};
const readPref = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const writePref = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

const km = (a, b) => {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
const wazeUrl = (p) => `https://waze.com/ul?ll=${p.lat.toFixed(6)},${p.lng.toFixed(6)}&navigate=yes`;
const hhmm = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const VehicleMode = ({ attentionItems = [], onExit }) => {
  const { profile, session, reloadProfile } = useAuth();
  const { t, lang } = useI18n();
  const myId = session?.user?.id;
  const ck = useCheckinsShared();
  const { latest: positions } = usePositions();
  const { liveMembers } = useTeam();
  const { markers, createMarker } = useMarkers();

  // ---------- my position ----------
  const [me, setMe] = useState(() => getLastCoords());
  useEffect(() => subscribeTracker(s => { if (s?.lastFix) setMe({ lat: s.lastFix.lat, lng: s.lastFix.lng }); }), []);
  useEffect(() => {
    if (me || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(p => setMe({ lat: p.coords.latitude, lng: p.coords.longitude }), () => {}, { timeout: 10000, maximumAge: 60000 });
  }, [me]);
  const [camKey, setCamKey] = useState(0);
  const centeredOnce = useRef(false);
  useEffect(() => { if (me && !centeredOnce.current) { centeredOnce.current = true; setCamKey(k => k + 1); } }, [me]);

  // ---------- screen: awake, clock, signal, dim ----------
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(id); }, []);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => {
    let lock = null;
    const grab = async () => { try { lock = await navigator.wakeLock?.request('screen'); } catch { /* not allowed */ } };
    const onVis = () => { if (document.visibilityState === 'visible') grab(); };
    grab();
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); lock?.release?.().catch(() => {}); };
  }, []);
  const [dimMode, setDimMode] = useState(() => readPref(DIM_KEY, 'auto'));
  const nightHours = now.getHours() >= 20 || now.getHours() < 6;
  const dimmed = dimMode === 'dim' || (dimMode === 'auto' && nightHours);
  const cycleDim = () => {
    const next = { auto: 'day', day: 'dim', dim: 'auto' }[dimMode];
    setDimMode(next); writePref(DIM_KEY, next);
  };
  const [voice, setVoice] = useState(() => readPref(VOICE_KEY, '1') === '1');
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const toggleVoice = () => { setVoice(v => { writePref(VOICE_KEY, v ? '0' : '1'); return !v; }); };
  const [autoStart, setAutoStart] = useState(vehicleAutoStart());
  const [mapMode, setMapMode] = useState('hybrid');

  // ---------- unit name (profile callsign) ----------
  const unit = profile?.callsign?.trim() || profile?.display_name || t('veh.unit');
  const [editingUnit, setEditingUnit] = useState(false);
  const [unitDraft, setUnitDraft] = useState('');
  const saveUnit = async () => {
    const v = unitDraft.trim().slice(0, 40);
    setEditingUnit(false);
    if (!myId) return;
    await supabase.from('profiles').update({ callsign: v || null }).eq('id', myId);
    reloadProfile?.();
    logEvent('vehicle.unit_named', { unit: v });
  };

  // ---------- toasts ----------
  const [toast, setToast] = useState(null);
  const flash = useCallback((text, tone = 'ok') => {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ---------- messages ----------
  const nameOf = useMemo(() => Object.fromEntries(liveMembers.map(m => [m.id,
    m.radioCallsign && m.radioCallsign !== '—' ? `${m.radioCallsign} · ${m.name}` : m.name])), [liveMembers]);
  const nameRef = useRef(nameOf);
  nameRef.current = nameOf;
  const [messages, setMessages] = useState([]);
  useEffect(() => {
    let channel;
    let cancelled = false;
    (async () => {
      const orgId = await getOrgId();
      if (!orgId || cancelled) return;
      const { data } = await supabase.from('messages').select('*').eq('org_id', orgId).order('at', { ascending: false }).limit(25);
      if (!cancelled) setMessages(data ?? []);
      channel = supabase.channel('messages-vehicle')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `org_id=eq.${orgId}` }, async (payload) => {
          const m = payload.new;
          setMessages(prev => [m, ...prev.filter(x => x.id !== m.id)].slice(0, 25));
          if (m.sender === myId || !voiceRef.current) return;
          let text = m.text ?? '';
          if ((m.lang ?? 'en') !== lang && text) {
            try { text = (await translateMany([text], lang))[0] ?? text; } catch { /* speak original */ }
          }
          say(`${nameRef.current[m.sender] ?? t('veh.someone')}: ${text}`);
        })
        .subscribe();
    })();
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, [myId, lang, t]);
  const foreign = messages.filter(m => m.sender !== myId && (m.lang ?? 'en') !== lang).map(m => m.text);
  const msgTr = useTranslations(foreign, lang, foreign.length > 0);

  // ---------- alerts: newest important one, spoken once ----------
  // only what is live: open (not acknowledged) and from the last 12 hours
  const important = attentionItems.filter(i => i.status === 'open' && i.severity !== 'info'
    && Date.now() - Date.parse(i.created_at) < 12 * 3600e3);
  const top = important[0] ?? null;
  const alertTexts = lang === 'en' ? [] : important.slice(0, 5).flatMap(i => [i.title, i.detail]).filter(Boolean);
  const alertTr = useTranslations(alertTexts, lang, alertTexts.length > 0);
  const A = (s) => (s ? alertTr[s] ?? s : s);
  const spoken = useRef(null);
  useEffect(() => {
    if (spoken.current === null) { spoken.current = new Set(attentionItems.map(i => i.id)); return; }
    for (const i of important) {
      if (spoken.current.has(i.id)) continue;
      spoken.current.add(i.id);
      if (voiceRef.current) say(`${i.severity === 'critical' ? t('veh.critical') : t('veh.warning')}. ${A(i.title)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attentionItems]);
  const locOf = (i) => (i?.source?.lat != null && i?.source?.lng != null ? { lat: Number(i.source.lat), lng: Number(i.source.lng) } : null);

  // ---------- check-in waiting for me ----------
  const pending = useMemo(() => {
    if (!ck || !myId) return null;
    return (ck.checkins ?? []).find(c => c.status === 'open'
      && Date.now() - Date.parse(c.created_at) < MAX_CHECKIN_AGE
      && c.requested_by !== myId
      && (!c.team_id || c.team_id === profile?.team_id)
      && !(ck.responses ?? []).some(r => r.checkin_id === c.id && r.profile_id === myId)) ?? null;
  }, [ck, myId, profile?.team_id]);

  // ---------- actions ----------
  const [busy, setBusy] = useState(null);
  const sendMessage = async (text) => {
    const orgId = await getOrgId();
    const { error } = await supabase.from('messages').insert({ org_id: orgId, sender: myId, text, lang });
    if (error) throw error;
    pushToTeam({ kind: 'message', title: unit, body: text.slice(0, 140), url: '/', tag: 'comms' });
  };

  const sayOk = async () => {
    setBusy('ok');
    try {
      if (pending) await ck.respond(pending.id, 'ok');
      else await sendMessage(`✅ ${unit} — ${t('veh.okMsg')}`);
      beep(true);
      flash(t('veh.okSent'));
    } catch (e) { flash(e.message ?? t('veh.failed'), 'err'); }
    setBusy(null);
  };

  const raiseHelp = async () => {
    setBusy('help');
    try {
      if (pending) await ck.respond(pending.id, 'help', t('veh.helpNote', { unit }));
      else {
        const orgId = await getOrgId();
        const fix = me ?? getLastCoords();
        const stamp = Date.now();
        await supabase.from('attention_items').insert({
          org_id: orgId, dedupe_key: `veh-help:${myId}:${stamp}`, severity: 'critical', kind: 'hazard',
          title: `${unit} NEEDS HELP (vehicle)`,
          detail: fix ? `At ${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}.` : 'Position unknown.',
          source: fix ? { lat: fix.lat, lng: fix.lng } : null,
        });
        pushToTeam({
          kind: 'attention', category: 'hazard', severity: 'critical',
          title: `🆘 ${unit} NEEDS HELP`, body: t('veh.helpPush'), url: '/', tag: `veh-help:${myId}:${stamp}`,
        });
        logEvent('vehicle.help', { unit, lat: fix?.lat ?? null, lng: fix?.lng ?? null });
      }
      beep(false);
      flash(t('veh.helpSent'), 'err');
    } catch (e) { flash(e.message ?? t('veh.failed'), 'err'); }
    setBusy(null);
  };

  // hold-to-send for NEED HELP: a bump on a rough road must not send it
  const [holdPct, setHoldPct] = useState(0);
  const holdTimer = useRef(null);
  const holdStart = useRef(0);
  const startHold = () => {
    if (busy) return;
    holdStart.current = Date.now();
    clearInterval(holdTimer.current);
    holdTimer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - holdStart.current) / HOLD_MS);
      setHoldPct(p);
      if (p >= 1) { clearInterval(holdTimer.current); setHoldPct(0); raiseHelp(); }
    }, 40);
  };
  const endHold = () => { clearInterval(holdTimer.current); setHoldPct(0); };

  // TALK: dictate, tap again to send
  const [spokenText, setSpokenText] = useState('');
  const { supported: canTalk, listening, interim, start, stop } = useSpeech({
    onFinal: (txt) => setSpokenText(s => (s ? `${s} ${txt}` : txt).trim()),
  });
  const talk = async () => {
    if (!listening) { setSpokenText(''); start(); return; }
    stop();
    const text = `${spokenText} ${interim ?? ''}`.trim();
    setSpokenText('');
    if (!text) return;
    setBusy('talk');
    try { await sendMessage(text); beep(true); flash(t('veh.msgSent')); } catch (e) { flash(e.message ?? t('veh.failed'), 'err'); }
    setBusy(null);
  };

  const [hazardOpen, setHazardOpen] = useState(false);
  const markHazard = async (kind) => {
    setHazardOpen(false);
    const fix = me ?? getLastCoords();
    if (!fix) { flash(t('veh.noFix'), 'err'); return; }
    setBusy('hazard');
    try {
      await createMarker({ kind, label: `${markerMeta(kind).label} — ${unit}`, lat: fix.lat, lng: fix.lng, notes: t('veh.markedFromCab') });
      beep(true);
      flash(t('veh.hazardMarked'));
    } catch (e) { flash(e.message ?? t('veh.failed'), 'err'); }
    setBusy(null);
  };

  const [navOpen, setNavOpen] = useState(false);
  const destinations = useMemo(() => {
    const out = [];
    for (const i of important) { const p = locOf(i); if (p) out.push({ id: `a-${i.id}`, icon: i.severity === 'critical' ? '🚨' : '⚠️', label: A(i.title), pos: p }); }
    const openIds = new Set((ck?.checkins ?? []).filter(c => c.status === 'open').map(c => c.id));
    for (const r of ck?.responses ?? []) {
      if (r.status === 'help' && r.lat != null && openIds.has(r.checkin_id)) out.push({ id: `h-${r.checkin_id}-${r.profile_id}`, icon: '🆘', label: `${nameOf[r.profile_id] ?? t('veh.someone')} — ${t('veh.needsHelp')}`, pos: { lat: r.lat, lng: r.lng } });
    }
    for (const m of markers) out.push({ id: `m-${m.id}`, icon: markerMeta(m.kind).icon, label: m.label || markerMeta(m.kind).label, pos: { lat: m.lat, lng: m.lng } });
    const seen = new Set();
    return out
      .filter(d => (seen.has(d.id) ? false : seen.add(d.id)))
      .map(d => ({ ...d, km: me ? km(me, d.pos) : null }))
      .sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9))
      .slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [important, ck?.responses, markers, me, nameOf]);
  const navigate = (pos) => { setNavOpen(false); window.open(wazeUrl(pos), '_blank', 'noopener'); };

  // ---------- map layers ----------
  const crew = positions
    .filter(p => p.profile_id !== myId && Date.now() - new Date(p.at) < FRESH_MS)
    .map(p => ({ id: `pos-${p.profile_id}`, name: `${nameOf[p.profile_id] ?? t('veh.someone')} (${hhmm(new Date(p.at))})`, type: 'person', status: 'live', position: { lat: p.lat, lng: p.lng }, icon: '🚒' }));
  const mapDevices = [...crew, ...(me ? [{ id: 'me', name: unit, type: 'person', status: 'here', position: me, icon: '📍' }] : [])];
  const mapMarkers = [
    ...markers.map(m => ({ id: m.id, name: m.label || markerMeta(m.kind).label, icon: markerMeta(m.kind).icon, position: { lat: m.lat, lng: m.lng }, notes: m.notes, kindLabel: markerMeta(m.kind).label })),
    ...important.map(i => ({ i, p: locOf(i) })).filter(x => x.p).map(({ i, p }) => ({ id: `alert-${i.id}`, name: A(i.title), icon: i.severity === 'critical' ? '🚨' : '⚠️', position: p, notes: A(i.detail) })),
  ];
  const center = me ?? crew[0]?.position ?? { lat: 46.8, lng: -71.2 };

  const bigBtn = 'rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50 select-none';
  const chip = 'h-11 px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-1.5 text-sm';

  return (
    <div className="fixed inset-0 z-[110] bg-slate-950 text-slate-100 flex flex-col h-dvh wt-safe-x"
      style={dimmed ? { filter: 'brightness(0.62)' } : undefined}>
      {/* ---------- top bar ---------- */}
      <div className="flex items-center gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 bg-slate-900 border-b border-slate-800">
        <Truck className="w-6 h-6 text-orange-400 shrink-0" />
        {editingUnit ? (
          <form onSubmit={e => { e.preventDefault(); saveUnit(); }} className="flex gap-1.5 min-w-0">
            <input autoFocus value={unitDraft} onChange={e => setUnitDraft(e.target.value)} placeholder={t('veh.unitPh')} maxLength={40}
              className="h-10 px-3 rounded-lg bg-slate-800 border border-orange-500/50 text-base text-white w-40 sm:w-56" />
            <button className="h-10 px-3 rounded-lg bg-orange-500 text-white text-sm font-semibold">{t('veh.save')}</button>
          </form>
        ) : (
          <button onClick={() => { setUnitDraft(profile?.callsign ?? ''); setEditingUnit(true); }} className="flex items-center gap-1.5 min-w-0">
            <span className="text-lg font-bold text-white truncate">{unit}</span>
            <Pencil className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          </button>
        )}
        <span className="ml-auto text-lg font-mono text-slate-300 tabular-nums">{hhmm(now)}</span>
        {online ? <Wifi className="w-5 h-5 text-green-400" aria-label={t('veh.online')} /> : <WifiOff className="w-5 h-5 text-red-400" aria-label={t('veh.offline')} />}
        <button onClick={toggleVoice} className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center" aria-label={voice ? t('veh.voiceOn') : t('veh.voiceOff')} title={voice ? t('veh.voiceOn') : t('veh.voiceOff')}>
          {voice ? <Volume2 className="w-5 h-5 text-green-300" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
        </button>
        <button onClick={cycleDim} className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center" title={t(`veh.dim.${dimMode}`)} aria-label={t(`veh.dim.${dimMode}`)}>
          {dimMode === 'auto' ? <SunMoon className="w-5 h-5 text-slate-300" /> : dimMode === 'dim' ? <Moon className="w-5 h-5 text-sky-300" /> : <Sun className="w-5 h-5 text-yellow-300" />}
        </button>
        <button onClick={() => { const v = !autoStart; setAutoStart(v); setVehicleAutoStart(v); flash(v ? t('veh.autoOn') : t('veh.autoOff')); }}
          className={`w-11 h-11 rounded-xl flex items-center justify-center ${autoStart ? 'bg-orange-500/20 border border-orange-500/50' : 'bg-slate-800'}`}
          title={t('veh.autoStart')} aria-label={t('veh.autoStart')}>
          <Pin className={`w-5 h-5 ${autoStart ? 'text-orange-300' : 'text-slate-500'}`} />
        </button>
        <button onClick={onExit} className="h-11 px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-1.5 text-sm font-semibold">
          <X className="w-5 h-5" /><span className="hidden sm:inline">{t('veh.exit')}</span>
        </button>
      </div>

      {/* ---------- newest alert ---------- */}
      {top && (
        <div className={`flex items-center gap-3 px-3 py-2 ${top.severity === 'critical' ? 'bg-red-600 text-white' : 'bg-amber-500 text-black'}`} role="alert">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-base sm:text-lg leading-tight truncate">{A(top.title)}</p>
            {top.detail && <p className="text-xs sm:text-sm opacity-90 truncate">{A(top.detail)}</p>}
          </div>
          {locOf(top) && (
            <button onClick={() => navigate(locOf(top))} className="h-11 px-3 rounded-xl bg-black/25 font-semibold text-sm flex items-center gap-1.5 shrink-0">
              <Navigation className="w-5 h-5" />{t('veh.go')}
            </button>
          )}
          {important.length > 1 && <span className="text-xs font-bold opacity-80 shrink-0">+{important.length - 1}</span>}
        </div>
      )}

      {/* ---------- map + controls: side by side in landscape, stacked in portrait ---------- */}
      <div className="flex-1 min-h-0 flex flex-col landscape:flex-row">
        <div className="relative flex-1 min-h-[38%] landscape:min-h-0">
          <TacticalMap
            key={camKey}
            mapMode={mapMode}
            center={center}
            zoom={14}
            devices={mapDevices}
            markers={mapMarkers}
            showGeofences={false}
            showFlightPaths={false}
          />
          <div className="absolute left-2 bottom-2 flex flex-col gap-2">
            <button onClick={() => setCamKey(k => k + 1)} className="w-12 h-12 rounded-xl bg-slate-900/90 border border-slate-700 flex items-center justify-center" aria-label={t('veh.centerMe')}>
              <LocateFixed className="w-6 h-6 text-sky-300" />
            </button>
            <button onClick={() => setMapMode(m => (m === 'hybrid' ? 'roadmap' : 'hybrid'))} className="w-12 h-12 rounded-xl bg-slate-900/90 border border-slate-700 flex items-center justify-center" aria-label={t('veh.mapType')}>
              <Layers className="w-6 h-6 text-slate-200" />
            </button>
          </div>
          {!me && <p className="absolute top-2 left-1/2 -translate-x-1/2 text-xs bg-slate-900/90 px-3 py-1.5 rounded-lg text-slate-300">{t('veh.waitingFix')}</p>}
        </div>

        <div className="flex flex-col gap-2 p-2 min-h-0 max-h-[55%] landscape:max-h-none landscape:w-[min(400px,44vw)] border-t landscape:border-t-0 landscape:border-l border-slate-800 bg-slate-950">
          {pending && (
            <p className="text-center text-sm font-bold text-orange-300 bg-orange-500/10 border border-orange-500/40 rounded-xl py-1.5">{t('veh.checkinAsked')}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={sayOk} disabled={!!busy} className={`${bigBtn} h-20 short:h-16 bg-green-600 hover:bg-green-500 text-white text-xl`}>
              {busy === 'ok' ? <Loader2 className="w-7 h-7 animate-spin" /> : <ShieldCheck className="w-7 h-7" />}{t('veh.ok')}
            </button>
            <button
              onPointerDown={startHold} onPointerUp={endHold} onPointerLeave={endHold} onPointerCancel={endHold}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); raiseHelp(); } }}
              onContextMenu={e => e.preventDefault()}
              disabled={!!busy}
              className={`${bigBtn} relative overflow-hidden h-20 short:h-16 bg-red-600 text-white text-xl touch-none`}
              aria-label={t('veh.helpHold')}>
              <span className="absolute inset-y-0 left-0 bg-red-400/60" style={{ width: `${holdPct * 100}%` }} aria-hidden="true" />
              <span className="relative flex items-center gap-2">
                {busy === 'help' ? <Loader2 className="w-7 h-7 animate-spin" /> : <LifeBuoy className="w-7 h-7" />}
                <span className="flex flex-col leading-none">{t('veh.help')}<span className="text-[10px] font-semibold opacity-80 mt-1">{t('veh.hold')}</span></span>
              </span>
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={talk} disabled={!canTalk || (busy && busy !== 'talk')}
              className={`${bigBtn} h-16 short:h-14 text-base ${listening ? 'bg-sky-500 text-white animate-pulse' : 'bg-slate-800 border border-slate-700 text-slate-100'}`}>
              {listening ? <Send className="w-6 h-6" /> : <Mic className="w-6 h-6" />}{listening ? t('veh.send') : t('veh.talk')}
            </button>
            <button onClick={() => setHazardOpen(v => !v)} disabled={!!busy}
              className={`${bigBtn} h-16 short:h-14 text-base bg-amber-500/15 border border-amber-500/50 text-amber-200`}>
              <AlertTriangle className="w-6 h-6" />{t('veh.hazard')}
            </button>
            <button onClick={() => setNavOpen(true)}
              className={`${bigBtn} h-16 short:h-14 text-base bg-sky-500/15 border border-sky-500/50 text-sky-200`}>
              <Navigation className="w-6 h-6" />{t('veh.navigate')}
            </button>
          </div>
          {listening && (
            <p className="text-base text-sky-200 bg-sky-500/10 border border-sky-500/30 rounded-xl px-3 py-2 min-h-[2.5rem]">
              {`${spokenText} ${interim ?? ''}`.trim() || t('veh.listening')}
            </p>
          )}
          {hazardOpen && (
            <div className="flex flex-wrap gap-2">
              {HAZARD_KINDS.map(k => (
                <button key={k} onClick={() => markHazard(k)} className={chip}>
                  <span className="text-lg" aria-hidden="true">{markerMeta(k).icon}</span>{markerMeta(k).label}
                </button>
              ))}
            </div>
          )}

          {/* ---------- team messages, newest first ---------- */}
          <div className="flex-1 min-h-[5rem] overflow-y-auto space-y-1.5 pr-0.5">
            {messages.length === 0 && <p className="text-sm text-slate-500 text-center py-4">{t('veh.noMessages')}</p>}
            {messages.map(m => {
              const mine = m.sender === myId;
              const text = !mine && (m.lang ?? 'en') !== lang ? msgTr[m.text] ?? m.text : m.text;
              return (
                <div key={m.id} className={`rounded-xl px-3 py-2 ${mine ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-slate-800/70'}`}>
                  <p className="text-[11px] text-slate-400 flex justify-between gap-2">
                    <span className="truncate font-semibold">{mine ? unit : nameOf[m.sender] ?? t('veh.someone')}</span>
                    <span className="tabular-nums shrink-0">{hhmm(new Date(m.at))}</span>
                  </p>
                  <p className="text-base text-white leading-snug break-words">{text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---------- navigate sheet ---------- */}
      {navOpen && (
        <div className="fixed inset-0 z-[115] bg-black/70 flex items-end sm:items-center justify-center p-2" onClick={() => setNavOpen(false)}>
          <div className="w-full max-w-lg max-h-[85dvh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-3 space-y-2" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Navigation className="w-5 h-5 text-sky-300" />{t('veh.navTitle')}</h3>
              <button onClick={() => setNavOpen(false)} className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>
            {destinations.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">{t('veh.noDest')}</p>}
            {destinations.map(d => (
              <button key={d.id} onClick={() => navigate(d.pos)} className="w-full min-h-[3.5rem] flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-left">
                <span className="text-2xl" aria-hidden="true">{d.icon}</span>
                <span className="flex-1 min-w-0 text-base text-white truncate">{d.label}</span>
                {d.km != null && <span className="text-sm text-slate-400 tabular-nums shrink-0">{d.km < 10 ? d.km.toFixed(1) : Math.round(d.km)} km</span>}
              </button>
            ))}
            <p className="text-[11px] text-slate-500">{t('veh.navNote')}</p>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed left-1/2 -translate-x-1/2 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[116] px-4 py-3 rounded-xl text-base font-semibold shadow-2xl ${toast.tone === 'err' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
};

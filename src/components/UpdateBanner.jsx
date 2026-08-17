import { useState, useEffect, useRef } from 'react';
import { RefreshCw, CheckCircle } from 'lucide-react';

// Polls /version.json (emitted at build time) and compares it against the
// build id baked into this running bundle. A mismatch means a newer build
// was deployed. With the PWA service worker, offering "Refresh" immediately
// is a trap: the new build is still downloading, so a reload just serves
// the old cached app and the banner returns. Instead we start the update
// right away, show progress, and only offer Refresh once the new version
// has actually taken control — then one tap always lands on the new build.
const CHECK_INTERVAL = 5 * 60 * 1000;

export const UpdateBanner = () => {
  const [phase, setPhase] = useState('idle'); // idle | downloading | ready
  const startedRef = useRef(false);

  useEffect(() => {
    if (import.meta.env.DEV) return; // dev server hot-reloads; no need

    let stopped = false;

    const ensureReady = async () => {
      if (startedRef.current) return;
      startedRef.current = true;

      if (!('serviceWorker' in navigator)) { setPhase('ready'); return; }
      const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
      if (!reg || !navigator.serviceWorker.controller) { setPhase('ready'); return; }

      let settled = false;
      const ready = () => { if (!settled && !stopped) { settled = true; setPhase('ready'); } };

      // The moment the new worker takes control, the precache is the new build
      navigator.serviceWorker.addEventListener('controllerchange', ready, { once: true });

      try { await reg.update(); } catch { /* offline — timeout below */ }

      const incoming = reg.installing || reg.waiting;
      if (incoming) {
        incoming.addEventListener('statechange', () => { if (incoming.state === 'activated') ready(); });
      } else {
        // nothing installing → the new worker already took over before we looked
        ready();
      }
      setTimeout(ready, 30000); // never strand the user in "downloading"
    };

    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const { build } = await res.json();
        if (!stopped && build && build !== __BUILD_ID__) {
          setPhase(p => (p === 'idle' ? 'downloading' : p));
          ensureReady();
        }
      } catch { /* offline or file missing — try again later */ }
    };

    const timer = setInterval(check, CHECK_INTERVAL);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    check();
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  if (phase === 'idle') return null;

  const ready = phase === 'ready';

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-2.5 bg-slate-900 border border-orange-500/50 rounded-xl shadow-2xl shadow-orange-500/10">
      {ready
        ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
        : <RefreshCw className="w-4 h-4 text-orange-400 flex-shrink-0 animate-spin" />}
      <span className="text-xs text-slate-200">
        {ready ? 'Update ready.' : 'Downloading update…'}
      </span>
      {ready && (
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white text-xs font-semibold hover:opacity-90 flex-shrink-0"
        >
          Refresh
        </button>
      )}
    </div>
  );
};

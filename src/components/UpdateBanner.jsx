import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

// Polls /version.json (emitted at build time) and compares it against the
// build id baked into this running bundle. A mismatch means a newer build
// was deployed — tell the user to refresh. Checks every 5 minutes and
// whenever the tab regains focus (the moment people come back to a stale tab).
const CHECK_INTERVAL = 5 * 60 * 1000;

// With the PWA service worker, a plain reload serves the OLD cached app
// (that's its job) while the new build is still downloading — so the banner
// would come straight back. Instead: nudge the service worker to fetch the
// new build, wait until it has taken control, then reload once, cleanly.
const applyUpdateAndReload = async () => {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update().catch(() => {});
        const newWorker = reg.installing || reg.waiting;
        if (newWorker && navigator.serviceWorker.controller) {
          await new Promise((resolve) => {
            const done = () => resolve();
            navigator.serviceWorker.addEventListener('controllerchange', done, { once: true });
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') done();
            });
            setTimeout(done, 10000); // never trap the user — reload anyway
          });
        }
      }
    }
  } catch { /* no SW or it failed — plain reload below */ }
  window.location.reload();
};

export const UpdateBanner = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) return; // dev server hot-reloads; no need

    let stopped = false;
    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const { build } = await res.json();
        if (!stopped && build && build !== __BUILD_ID__) setUpdateAvailable(true);
      } catch { /* offline or file missing — try again later */ }
    };

    const timer = setInterval(check, CHECK_INTERVAL);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    check();
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-2.5 bg-slate-900 border border-orange-500/50 rounded-xl shadow-2xl shadow-orange-500/10">
      <RefreshCw className={`w-4 h-4 text-orange-400 flex-shrink-0 ${updating ? 'animate-spin' : ''}`} />
      <span className="text-xs text-slate-200">
        {updating ? 'Updating Watchtower…' : 'A new version of Watchtower is available.'}
      </span>
      <button
        onClick={() => { setUpdating(true); applyUpdateAndReload(); }}
        disabled={updating}
        className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white text-xs font-semibold hover:opacity-90 disabled:opacity-60 flex-shrink-0"
      >
        {updating ? 'Please wait' : 'Refresh'}
      </button>
    </div>
  );
};

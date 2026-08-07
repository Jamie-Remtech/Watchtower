import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

// Polls /version.json (emitted at build time) and compares it against the
// build id baked into this running bundle. A mismatch means a newer build
// was deployed — tell the user to refresh. Checks every 5 minutes and
// whenever the tab regains focus (the moment people come back to a stale tab).
const CHECK_INTERVAL = 5 * 60 * 1000;

export const UpdateBanner = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);

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
      <RefreshCw className="w-4 h-4 text-orange-400 flex-shrink-0" />
      <span className="text-xs text-slate-200">A new version of Watchtower is available.</span>
      <button
        onClick={() => window.location.reload()}
        className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white text-xs font-semibold hover:opacity-90 flex-shrink-0"
      >
        Refresh
      </button>
    </div>
  );
};

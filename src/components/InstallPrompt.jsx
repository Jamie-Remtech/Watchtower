import { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

// Explicit PWA install affordance. Browsers' automatic prompts are
// unreliable (engagement heuristics, suppressed when an old shortcut
// exists) and iOS never prompts — so we offer our own button:
//  - Android/desktop Chrome: captures beforeinstallprompt and triggers
//    the real install dialog on tap
//  - iOS Safari: shows the Share → Add to Home Screen instructions
const DISMISS_KEY = 'watchtower-install-dismissed';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

export const InstallPrompt = () => {
  const [deferred, setDeferred] = useState(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || dismissed) return null;

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, '1'); setDismissed(true); };

  const install = async () => {
    if (deferred) {
      deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    } else if (isIOS()) {
      setShowIOSHelp(true);
    }
  };

  // Nothing actionable yet (Android before the event fires, desktop Firefox…)
  if (!deferred && !isIOS()) return null;

  return (
    <>
      <div className="fixed bottom-4 left-4 z-[90] flex items-center gap-2 pl-3 pr-1.5 py-1.5 bg-slate-900 border border-orange-500/40 rounded-xl shadow-2xl">
        <button onClick={install} className="flex items-center gap-2 text-xs text-slate-100 font-medium">
          <Download className="w-4 h-4 text-orange-400" />
          Install Watchtower
        </button>
        <button onClick={dismiss} className="p-1 text-slate-500 hover:text-slate-300" title="Dismiss">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {showIOSHelp && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6" onClick={() => setShowIOSHelp(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-xs" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-3">Install on iPhone</h3>
            <ol className="text-xs text-slate-300 space-y-2.5 list-decimal list-inside">
              <li className="flex items-center gap-1.5">
                <span>1. Tap the</span><Share className="w-4 h-4 text-sky-400 inline" /><span><b>Share</b> button in Safari</span>
              </li>
              <li><span>2. Scroll and tap <b>Add to Home Screen</b></span></li>
              <li><span>3. Tap <b>Add</b> — done</span></li>
            </ol>
            <button
              onClick={() => setShowIOSHelp(false)}
              className="mt-4 w-full py-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white text-xs font-semibold"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

import { useEffect, Fragment } from 'react';
import { Loader2 } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from './AuthContext';
import { LoginScreen } from './LoginScreen';
import { Landing } from '../public/Landing';
import { Tour } from '../public/Tour';
import { publicView, usePath } from '../public/nav';

// Gates the app behind auth. Watchtower runs on real data only —
// without Supabase configuration there is nothing to show.
// Public homepage and tutorial sit in front for visitors; members who
// are signed in go straight to the app.

// Renders a translated sentence whose {name} slots are filled with elements.
const rich = (s, parts) => s.split(/(\{\w+\})/).map((seg, i) => {
  const m = /^\{(\w+)\}$/.exec(seg);
  return m && m[1] in parts ? <Fragment key={i}>{parts[m[1]]}</Fragment> : seg;
});

export const AuthGate = ({ children }) => {
  const { session, loading, isConfigured } = useAuth();
  const { t } = useI18n();
  // English stays readable even if no translation context is available
  const tt = (k, en) => { const v = t(k); return v === k ? en : v; };
  usePath();
  const view = loading ? null : publicView(!!session);

  // Signed in from /signin → the app lives at /
  useEffect(() => {
    if (session && window.location.pathname === '/signin') window.history.replaceState({}, '', '/');
  }, [session]);

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <p className="text-white font-bold">{tt('shell.x.notConfigured', 'Watchtower is not configured')}</p>
          <p className="text-slate-400 text-sm mt-2">
            {rich(tt('shell.x.configHelp', 'Set {url} and {key} in the build environment, then rebuild.'), {
              url: <code className="text-orange-300">VITE_SUPABASE_URL</code>,
              key: <code className="text-orange-300">VITE_SUPABASE_ANON_KEY</code>,
            })}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (view === 'home') return <Landing signedIn={!!session} />;
  if (view === 'tour') return <Tour signedIn={!!session} />;
  if (!session) return <LoginScreen />;

  return children;
};

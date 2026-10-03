import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { LoginScreen } from './LoginScreen';
import { Landing } from '../public/Landing';
import { Tour } from '../public/Tour';
import { publicView, usePath } from '../public/nav';

// Gates the app behind auth. Watchtower runs on real data only —
// without Supabase configuration there is nothing to show.
// Public homepage and tutorial sit in front for visitors; members who
// are signed in go straight to the app.
export const AuthGate = ({ children }) => {
  const { session, loading, isConfigured } = useAuth();
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
          <p className="text-white font-bold">Watchtower is not configured</p>
          <p className="text-slate-400 text-sm mt-2">
            Set <code className="text-orange-300">VITE_SUPABASE_URL</code> and{' '}
            <code className="text-orange-300">VITE_SUPABASE_ANON_KEY</code> in the build environment, then rebuild.
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

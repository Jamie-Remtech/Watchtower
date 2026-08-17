import { Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { LoginScreen } from './LoginScreen';

// Gates the app behind auth. Watchtower runs on real data only —
// without Supabase configuration there is nothing to show.
export const AuthGate = ({ children }) => {
  const { session, loading, isConfigured } = useAuth();

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

  if (!session) return <LoginScreen />;

  return children;
};

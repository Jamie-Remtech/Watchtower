import { Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { LoginScreen } from './LoginScreen';

// Gates the app behind auth when Supabase is configured.
// In demo mode (no keys) the app is open with simulated data.
export const AuthGate = ({ children }) => {
  const { session, loading, isConfigured } = useAuth();

  if (!isConfigured) return children;

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

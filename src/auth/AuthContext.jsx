import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// In demo mode (no Supabase keys) everyone is a coordinator on the simulated org.
const DEMO_PROFILE = {
  id: 'demo-user',
  display_name: 'Demo Coordinator',
  callsign: 'WATCH-1',
  role: 'coordinator',
  org_id: 'demo-org',
  demo: true,
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(isSupabaseConfigured ? null : DEMO_PROFILE);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const loadProfile = useCallback(async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signInWithPassword = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const signInWithMagicLink = (email) =>
    supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });

  // Invitation-code onboarding: the code travels in user metadata; a database
  // trigger attaches the new user to the inviting org with the invited role.
  const signUpWithInvite = (email, password, inviteCode, displayName) =>
    supabase.auth.signUp({
      email,
      password,
      options: { data: { invite_code: inviteCode, display_name: displayName } },
    });

  const signOut = () => (isSupabaseConfigured ? supabase.auth.signOut() : null);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        isConfigured: isSupabaseConfigured,
        isDemo: !isSupabaseConfigured,
        signInWithPassword,
        signInWithMagicLink,
        signUpWithInvite,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

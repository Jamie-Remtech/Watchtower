import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { setCachedOrgId, effectiveOrgOf } from '../lib/org';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const loadProfile = useCallback(async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    // Platform staff viewing another company (0040): every screen works in
    // that company (org_id); home_org_id keeps their own.
    const prof = data ? { ...data, home_org_id: data.org_id, org_id: effectiveOrgOf(data), viewing: effectiveOrgOf(data) !== data.org_id } : null;
    // Cache the company before anything renders that queries it
    if (prof?.org_id) setCachedOrgId(prof.org_id);
    setProfile(prof);
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

  // Existing members only: accounts are created by invitation, never by a link
  const signInWithMagicLink = (email) =>
    supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin, shouldCreateUser: false } });

  // Invitation-code onboarding: the join function checks the code and creates
  // the account (no confirmation email); the database trigger attaches the
  // person to the inviting company with the invited role. Then we sign in.
  const signUpWithInvite = async (email, password, inviteCode, displayName, language) => {
    const { error } = await supabase.functions.invoke('join', {
      body: { code: inviteCode, email, password, display_name: displayName, language },
    });
    if (error) {
      let code = 'join_failed';
      try { code = (await error.context?.json())?.error ?? code; } catch { /* not JSON */ }
      return { error: { code } };
    }
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = () => (isSupabaseConfigured ? supabase.auth.signOut() : null);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        isConfigured: isSupabaseConfigured,
        signInWithPassword,
        signInWithMagicLink,
        signUpWithInvite,
        signOut,
        reloadProfile: () => (session ? loadProfile(session.user.id) : null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

import { useAuth } from './auth/AuthContext';
import { allowedTabs } from './auth/roles';
import { TacticalMapTab } from './tabs/TacticalMapTab';

// Standalone tactical map window (?pop=tactical): same login, same
// realtime data as the main app — markers, crew positions, and saved
// views all stay in sync across every window.
export const PopTactical = () => {
  const { profile } = useAuth();

  if (profile && !allowedTabs(profile.role).includes('tactical')) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Your role doesn't include the tactical map.</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 text-slate-100 p-2 flex flex-col">
      <TacticalMapTab />
    </div>
  );
};

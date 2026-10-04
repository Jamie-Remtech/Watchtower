import { useAuth } from './auth/AuthContext';
import { allowedTabs } from './auth/roles';
import { TacticalMapTab } from './tabs/TacticalMapTab';
import { useI18n } from './i18n/index.jsx';

// Standalone tactical map window (?pop=tactical): same login, same
// realtime data as the main app — markers, crew positions, and saved
// views all stay in sync across every window.
export const PopTactical = () => {
  const { profile } = useAuth();
  const { t } = useI18n();

  if (profile && !allowedTabs(profile.role).includes('tactical')) {
    return (
      <div className="h-dvh bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400 text-sm">{t('shell.x.noTactical')}</p>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-slate-950 text-slate-100 p-2 flex flex-col">
      <TacticalMapTab />
    </div>
  );
};

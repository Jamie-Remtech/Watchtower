import { Palette, Check, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/index.jsx';
import { THEMES, ACCENTS, DEFAULT_APPEARANCE, saveAppearance, useAppearance } from '../theme/theme';

// Theme + accent colour. Applies instantly on this device and is saved
// to the profile so a new device starts with the same look.
export const AppearanceSettings = () => {
  const { session } = useAuth();
  const { t } = useI18n();
  const appearance = useAppearance();

  const set = (patch) => {
    const next = { ...appearance, ...patch };
    saveAppearance(next);
    if (session?.user?.id) supabase.from('profiles').update({ ui_prefs: next }).eq('id', session.user.id).then(() => {});
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Palette className="w-4 h-4 text-orange-400" />{t('ap.title')}</h3>
        <button onClick={() => set(DEFAULT_APPEARANCE)} className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1">
          <RotateCcw className="w-3 h-3" />{t('ap.reset')}
        </button>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] text-slate-500 uppercase tracking-wide">{t('ap.theme')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {THEMES.map(th => {
            const on = appearance.theme === th.id;
            return (
              <button key={th.id} onClick={() => set({ theme: th.id })}
                className={`text-left p-2.5 rounded-lg border flex gap-2.5 items-start ${on ? 'border-orange-500/60 bg-orange-500/10' : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'}`}>
                <span className="w-8 h-8 rounded-md shrink-0 overflow-hidden border border-slate-600 flex" aria-hidden="true"
                  style={th.id === 'system' ? { background: `linear-gradient(135deg, ${th.swatch[0]} 50%, ${th.swatch[1]} 50%)` } : { background: th.swatch[0] }}>
                  {th.id !== 'system' && <span className="m-auto w-4 h-1.5 rounded-full" style={{ background: th.swatch[1] }} />}
                </span>
                <span className="min-w-0">
                  <span className="text-xs text-white font-medium flex items-center gap-1">{t(`ap.t.${th.id}`)}{on && <Check className="w-3 h-3 text-orange-400" />}</span>
                  <span className="block text-[10px] text-slate-500 leading-snug">{t(`ap.t.${th.id}.d`)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] text-slate-500 uppercase tracking-wide">{t('ap.accent')}</p>
        <div className="flex flex-wrap gap-2 items-center">
          {ACCENTS.map(a => {
            const on = !appearance.custom && appearance.accent === a.id;
            return (
              <button key={a.id} onClick={() => set({ accent: a.id, custom: null })} title={t(`ap.c.${a.id}`)} aria-label={t(`ap.c.${a.id}`)}
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${on ? 'border-white' : 'border-transparent'}`}
                style={{ background: a.hex }}>
                {on && <Check className="w-4 h-4 text-paper" />}
              </button>
            );
          })}
          <label className={`h-8 px-2.5 rounded-full border-2 flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300 ${appearance.custom ? 'border-white' : 'border-slate-700'}`}>
            <input type="color" value={appearance.custom ?? '#f97316'} onChange={e => set({ custom: e.target.value })}
              className="w-5 h-5 rounded-full bg-transparent border-0 p-0 cursor-pointer" aria-label={t('ap.custom')} />
            {t('ap.custom')}
          </label>
        </div>
        <p className="text-[10px] text-slate-500">{t('ap.accentNote')}</p>
      </div>
    </div>
  );
};

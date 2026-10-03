import { useState, useEffect, useRef } from 'react';
import {
  Video, Users, CreditCard, Settings, Flame, Building2, CheckCircle, Zap, Menu, X, MessageSquare, Radio, Map, Globe, Bell, Mic, Activity, ClipboardList, CloudSun, AlertTriangle, Truck
} from 'lucide-react';
import { VehicleMode, vehicleAutoStart } from './vehicle/VehicleMode';
import { AIAssistant } from './components/AIAssistant';
import { Logo } from './components/common';
import { useAuth } from './auth/AuthContext';
import { allowedTabs } from './auth/roles';
import { useOrg } from './hooks/useOrg';
import { useDevices } from './hooks/useDevices';
import { useAttention } from './hooks/useAttention';
import { usePresence } from './hooks/usePresence';
import { startTracking, isTrackingPaused } from './lib/tracker';
import { supabase } from './lib/supabase';
import { enableNotifications, ensureSubscribed, notificationPermission, localNotify } from './lib/push';
import { findProtocolForItem, startProtocolRun } from './lib/protocols';
import { AttentionPanel } from './components/AttentionPanel';
import { CheckInPrompt } from './components/CheckInPrompt';
import { NotificationSettings } from './components/NotificationSettings';
import { AppearanceSettings } from './components/AppearanceSettings';
import { saveAppearance, hasLocalAppearance, DEFAULT_APPEARANCE } from './theme/theme';
import { playAlert } from './lib/alertSound';
import { shouldDeliver, categoryOfItem, withDefaults } from './lib/notifyPrefs';
import { cachedOrgId } from './lib/org';
import { go } from './public/nav';
import { useI18n } from './i18n/index.jsx';
import { useCheckins, CheckinsContext } from './hooks/useCheckins';
import { RequestAccess } from './components/RequestAccess';
import { alertAnimationStyles } from './styles/alertAnimations';
import { BillingTab } from './tabs/BillingTab';
import { CommsTab } from './tabs/CommsTab';
import { SettingsTab } from './tabs/SettingsTab';
import { StreamsTab } from './tabs/StreamsTab';
import { TacticalMapTab } from './tabs/TacticalMapTab';
import { TeamTab } from './tabs/TeamTab';
import { WorldTab } from './tabs/WorldTab';
import { FieldLogTab } from './tabs/FieldLogTab';
import { ActivityTab } from './tabs/ActivityTab';
import { ProtocolsTab } from './tabs/ProtocolsTab';
import { PlatformTab } from './tabs/PlatformTab';
import { ForecastsTab } from './tabs/ForecastsTab';



// ============================================
// WATCHTOWER — MAIN SHELL
// Tactical coordination hub: nav + tab routing.
// Each tab lives in src/tabs/, shared pieces in
// src/components/. Real data only — no mock layer.
// ============================================

const WatchtowerPortal = () => {
  const { profile, signOut, session, reloadProfile } = useAuth();
  const { t, lang } = useI18n();

  // First sign-in: remember this device's language on the profile so the
  // tower can alert this member in their language too.
  useEffect(() => {
    if (profile && !profile.language && session?.user?.id) {
      supabase.from('profiles').update({ language: lang }).eq('id', session.user.id).then(() => reloadProfile?.());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);
  // A new device starts with the look this member chose elsewhere
  useEffect(() => {
    if (profile?.ui_prefs?.theme && !hasLocalAppearance()) saveAppearance({ ...DEFAULT_APPEARANCE, ...profile.ui_prefs });
  }, [profile?.id, profile?.ui_prefs]);
  const org = useOrg();
  const { devices } = useDevices();
  const attention = useAttention();
  const checkins = useCheckins();
  usePresence(); // register this session as online for the whole team

  // Automatic position tracking for operational roles — no toggle needed.
  // Viewers are never tracked; an explicit pause (Field Log) is honored.
  useEffect(() => {
    const role = profile?.role;
    if (['field', 'operator', 'coordinator', 'admin'].includes(role) && !isTrackingPaused()) {
      startTracking();
    }
  }, [profile?.role]);

  const [attnOpen, setAttnOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const prefsRef = useRef(profile?.notification_prefs);
  prefsRef.current = profile?.notification_prefs;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  // A notification can open a given tab (?tab=platform); the param is consumed
  const [activeTab, setActiveTab] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const tab = p.get('tab');
    if (!tab) return 'world';
    p.delete('tab');
    window.history.replaceState({}, '', window.location.pathname + (p.toString() ? `?${p}` : ''));
    return /^[a-z]+$/.test(tab) ? tab : 'world';
  });
  const [newRequests, setNewRequests] = useState(0);
  // Vehicle mode: a cab screen can be pinned to open straight into it
  const canVehicle = !!profile?.role && profile.role !== 'viewer';
  const [vehicleOpen, setVehicleOpen] = useState(() => vehicleAutoStart());
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [tendedAlerts, setTendedAlerts] = useState(0);

  // Notifications: re-register this device for push whenever permission
  // is already granted; show incoming-message alerts + unread badge.
  const [notifPerm, setNotifPerm] = useState(notificationPermission());
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  useEffect(() => {
    if (notifPerm === 'granted') ensureSubscribed();
  }, [notifPerm]);

  useEffect(() => {
    const channel = supabase
      .channel('messages-shell')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (payload.new.sender === user?.id) return;
        if (payload.new.org_id && payload.new.org_id !== cachedOrgId()) return;
        if (activeTabRef.current !== 'comms') {
          // Chat is never siren-loud: the siren must stay rare to stay heard
          if (shouldDeliver(prefsRef.current, 'comms', 'info').deliver) {
            playAlert(withDefaults(prefsRef.current).sound === 'vibrate' ? 'vibrate' : 'chime');
          }
          setUnreadMsgs(n => n + 1);
          localNotify('Watchtower — new message', payload.new.text?.slice(0, 120) ?? '', '/');
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Live alerts while the app is open: play the member's own sound
  useEffect(() => {
    const channel = supabase
      .channel('attention-shell')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attention_items' }, (payload) => {
        const item = payload.new;
        if (item.org_id !== cachedOrgId()) return;
        const { deliver, silent } = shouldDeliver(prefsRef.current, categoryOfItem(item), item.severity);
        if (deliver && !silent && item.severity !== 'info') playAlert(withDefaults(prefsRef.current).sound);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (activeTab === 'comms') setUnreadMsgs(0);
  }, [activeTab]);

  // Platform staff: new homepage contact requests — badge + chime, live.
  // (The push itself comes from the contact-notify function.)
  const isStaff = ['owner', 'staff'].includes(profile?.platform_role);
  useEffect(() => {
    if (!isStaff) return;
    const count = () => supabase.from('contact_requests').select('id', { count: 'exact', head: true }).eq('status', 'new')
      .then(({ count: n }) => setNewRequests(n ?? 0));
    count();
    const channel = supabase
      .channel('contact-requests-shell')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_requests' }, (payload) => {
        if (payload.eventType === 'INSERT') playAlert('chime');
        count();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isStaff]);

  // Platform staff: the tower's heartbeat. A stale tower means no automatic alerts.
  const [towerAgeMin, setTowerAgeMin] = useState(null);
  useEffect(() => {
    if (!isStaff) return;
    const check = () => supabase.from('system_heartbeats').select('at').eq('name', 'tower-sweep').maybeSingle()
      .then(({ data, error }) => { if (!error) setTowerAgeMin(data ? (Date.now() - Date.parse(data.at)) / 60000 : Infinity); });
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [isStaff]);

  // Listen for alert count updates from StreamsTab
  useEffect(() => {
    const handler = (e) => {
      setActiveAlerts(e.detail.unattended);
      setTendedAlerts(e.detail.tended);
    };
    window.addEventListener('watchtower-alerts', handler);
    return () => window.removeEventListener('watchtower-alerts', handler);
  }, []);
  
  // Inject alert animation styles
  useEffect(() => {
    const styleId = 'watchtower-alert-styles';
    if (!document.getElementById(styleId)) {
      const styleTag = document.createElement('style');
      styleTag.id = styleId;
      styleTag.textContent = alertAnimationStyles;
      document.head.appendChild(styleTag);
    }
    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) existingStyle.remove();
    };
  }, []);
  
  // Keep the cached org id in sync with the profile — moving a member
  // to another company must not leave stale ids behind.
  useEffect(() => {
    if (profile?.org_id) localStorage.setItem('watchtower-org-id', profile.org_id);
  }, [profile?.org_id]);

  // Tabs are filtered by role — e.g. viewers see the World tab only.
  // The platform portal is for system admins (owner + staff) only.
  const isPlatformStaff = ['owner', 'staff'].includes(profile?.platform_role) || profile?.platform_owner === true;
  const allowed = [
    ...allowedTabs(profile?.role),
    ...(isPlatformStaff ? ['platform'] : []),
  ];
  const navItems = [
    { id: 'streams', name: t('nav.streams'), icon: Video },
    { id: 'tactical', name: t('nav.tactical'), icon: Map },
    { id: 'world', name: t('nav.world'), icon: Globe },
    { id: 'forecasts', name: t('nav.forecasts'), icon: CloudSun },
    { id: 'log', name: t('nav.log'), icon: Mic },
    { id: 'protocols', name: t('nav.protocols'), icon: ClipboardList },
    { id: 'comms', name: t('nav.comms'), icon: Radio },
    { id: 'activity', name: t('nav.activity'), icon: Activity },
    { id: 'team', name: t('nav.team'), icon: Users },
    { id: 'billing', name: t('nav.billing'), icon: CreditCard },
    { id: 'settings', name: t('nav.settings'), icon: Settings },
    { id: 'platform', name: t('nav.platform'), icon: Building2 },
  ].filter(item => allowed.includes(item.id));

  // Never leave someone on a tab their role can't open
  useEffect(() => {
    if (!allowed.includes(activeTab)) setActiveTab(allowed[0] ?? 'world');
  }, [allowed, activeTab]);

  const renderTab = () => {
    if (!allowed.includes(activeTab)) return <WorldTab />;
    switch(activeTab) {
      case 'streams': return <StreamsTab />;
      case 'tactical': return <TacticalMapTab />;
      case 'world': return <WorldTab />;
      case 'forecasts': return <ForecastsTab />;
      case 'log': return <FieldLogTab />;
      case 'protocols': return <ProtocolsTab />;
      case 'comms': return <CommsTab />;
      case 'activity': return <ActivityTab />;
      case 'team': return <TeamTab />;
      case 'billing': return <BillingTab />;
      case 'settings': return <SettingsTab />;
      case 'platform': return <PlatformTab />;
      default: return <WorldTab />;
    }
  };

  return (
    <CheckinsContext.Provider value={checkins}>
    <CheckInPrompt checkins={checkins.checkins} responses={checkins.responses} respond={checkins.respond} />
    {vehicleOpen && canVehicle && <VehicleMode attentionItems={attention.items} onExit={() => setVehicleOpen(false)} />}
    <div className="h-dvh bg-slate-950 text-slate-100 flex overflow-hidden wt-safe-x">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-slate-900 border-b border-slate-800 py-3 short:py-1.5 wt-safe-top wt-safe-x-pad z-40 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-800 rounded-lg">
          <Menu className="w-6 h-6 text-slate-300" />
        </button>
        <Logo />
        <div className="flex items-center gap-1">
        {canVehicle && (
          <button onClick={() => setVehicleOpen(true)} className="p-2 hover:bg-slate-800 rounded-lg" aria-label={t('veh.open')} title={t('veh.open')}>
            <Truck className="w-5 h-5 text-slate-300" />
          </button>
        )}
        {(
          <button onClick={() => setAttnOpen(true)} className="relative p-2 hover:bg-slate-800 rounded-lg">
            <Bell className={`w-5 h-5 ${attention.hasCritical ? 'text-red-400' : attention.openItems.length ? 'text-orange-400' : 'text-slate-300'}`} />
            {attention.openItems.length > 0 && (
              <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white ${attention.hasCritical ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`}>
                {attention.openItems.length}
              </span>
            )}
          </button>
        )}
        {/* Alert Status Indicator — Red: unattended | Orange: tended | Green: clear */}
        {activeAlerts > 0 ? (
          <button 
            onClick={() => setActiveTab('streams')}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-500 rounded-lg animate-pulse"
          >
            <Flame className="w-5 h-5 text-white" />
            <span className="text-white font-bold text-sm">{activeAlerts}</span>
          </button>
        ) : tendedAlerts > 0 ? (
          <button 
            onClick={() => setActiveTab('streams')}
            className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 rounded-lg"
          >
            <Flame className="w-5 h-5 text-white" />
            <span className="text-white font-bold text-sm">{tendedAlerts}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-lg">
            <div className="w-2 h-2 bg-green-400 rounded-full" />
            <span className="text-green-400 text-xs font-medium">OK</span>
          </div>
        )}
        </div>
      </header>

      {sidebarOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-56 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col`}>
        <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
          <Logo />
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-slate-800 rounded"><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        
        <div className="px-3 py-2 border-b border-slate-800">
          <div className="px-2 py-1.5 bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-medium text-white text-xs">{org.name}</span>
              {org.region && <span className="text-xs text-slate-500">· {org.region}</span>}
            </div>
          </div>
        </div>
        
        <nav className="flex-1 px-2 py-1.5 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium mb-0.5 transition-all ${
                activeTab === item.id ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <item.icon className="w-3.5 h-3.5" />{item.name}
              {item.id === 'streams' && activeAlerts > 0 && (
                <span className="ml-auto px-1.5 py-0.5 bg-red-500 rounded text-xs font-bold animate-pulse">{activeAlerts}</span>
              )}
              {item.id === 'streams' && activeAlerts === 0 && tendedAlerts > 0 && (
                <span className="ml-auto px-1.5 py-0.5 bg-orange-500 rounded text-xs font-bold">{tendedAlerts}</span>
              )}
              {item.id === 'comms' && unreadMsgs > 0 && (
                <span className="ml-auto px-1.5 py-0.5 bg-orange-500 rounded text-xs font-bold">{unreadMsgs}</span>
              )}
              {item.id === 'platform' && newRequests > 0 && (
                <span className="ml-auto px-1.5 py-0.5 bg-orange-500 rounded text-xs font-bold">{newRequests}</span>
              )}
            </button>
          ))}
        </nav>
        
        <div className="px-2 py-2 border-t border-slate-800 space-y-1">
          <RequestAccess />
          {notifPerm === 'default' && (
            <button
              onClick={async () => { await enableNotifications(); setNotifPerm(notificationPermission()); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-medium"
            >
              <Bell className="w-3.5 h-3.5" />{t('shell.enableNotifications')}
            </button>
          )}
          {canVehicle && (
            <button onClick={() => { setVehicleOpen(true); setSidebarOpen(false); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 text-xs font-medium hover:text-white">
              <Truck className="w-3.5 h-3.5" />{t('veh.open')}
            </button>
          )}
          <button onClick={() => setNotifOpen(true)} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 text-xs font-medium hover:text-white">
            <Bell className="w-3.5 h-3.5" />{t('shell.mySettings')}
          </button>
          <button onClick={() => setAiOpen(true)} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-orange-500/20 to-orange-600/20 border border-orange-500/30 text-orange-400 text-xs font-medium">
            <Zap className="w-3.5 h-3.5" />{t('shell.aiAssistant')}
          </button>
          <div className="flex gap-3 px-2.5 pt-1 text-[10px]">
            <button onClick={() => go('/about')} className="text-slate-500 hover:text-orange-300">{t('pub.about')}</button>
            <button onClick={() => go('/tour')} className="text-slate-500 hover:text-orange-300">{t('pub.tour')}</button>
          </div>
        </div>

        {/* Signed-in user */}
        <div className="px-2 py-2 border-t border-slate-800">
          <div className="flex items-center justify-between px-2 py-1.5 bg-slate-800/50 rounded-lg">
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{profile?.display_name ?? t('shell.signedIn')}</p>
              <p className="text-[10px] text-slate-500">
                {profile?.role ? t(`role.${profile.role}`) : ''}
              </p>
            </div>
            {(
              <button onClick={signOut} className="text-[10px] text-slate-400 hover:text-orange-400 font-medium ml-2 flex-shrink-0">
                {t('shell.signOut')}
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 wt-under-header lg:pt-0">
        {isStaff && towerAgeMin != null && towerAgeMin > 15 && (
          <div className="bg-red-600 text-white text-xs font-semibold px-4 py-2 flex items-center gap-2 flex-shrink-0" role="alert">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {towerAgeMin === Infinity
              ? 'The tower has not reported a sweep yet — automatic alerts may not be running.'
              : `The tower has not swept for ${Math.round(towerAgeMin)} min — automatic alerts are paused. Check the tower-sweep schedule in Supabase.`}
          </div>
        )}
        <header className="hidden lg:flex bg-slate-900/80 border-b border-slate-800 px-4 py-2 items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-sm font-bold text-white">{navItems.find(n => n.id === activeTab)?.name}</h1>
            <p className="text-xs text-slate-500">{org.name}{org.region && ` — ${org.region}`}</p>
          </div>
          <div className="flex items-center gap-3">
            {(
              <button onClick={() => setAttnOpen(true)} className="relative p-1.5 hover:bg-slate-800 rounded-lg" title={t('shell.attentionQueue')}>
                <Bell className={`w-4 h-4 ${attention.hasCritical ? 'text-red-400' : attention.openItems.length ? 'text-orange-400' : 'text-slate-400'}`} />
                {attention.openItems.length > 0 && (
                  <span className={`absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center text-white ${attention.hasCritical ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`}>
                    {attention.openItems.length}
                  </span>
                )}
              </button>
            )}
            {/* Alert Status — Red: unattended | Orange: tended | Green: clear */}
            {activeAlerts > 0 ? (
              <button 
                onClick={() => setActiveTab('streams')}
                className="flex items-center gap-2 px-3 py-1 bg-red-500 rounded-lg animate-pulse cursor-pointer hover:bg-red-600 transition-colors"
              >
                <Flame className="w-4 h-4 text-white" />
                <span className="text-white font-bold text-xs">{t('shell.alerts', { n: activeAlerts })}</span>
              </button>
            ) : tendedAlerts > 0 ? (
              <button 
                onClick={() => setActiveTab('streams')}
                className="flex items-center gap-2 px-3 py-1 bg-orange-500 rounded-lg cursor-pointer hover:bg-orange-600 transition-colors"
              >
                <Flame className="w-4 h-4 text-white" />
                <span className="text-white font-bold text-xs">{t('shell.tended', { n: tendedAlerts })}</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-lg">
                <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                <span className="text-green-400 text-xs font-medium">{t('shell.noActiveAlerts')}</span>
              </div>
            )}
            {/* Active devices */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-lg">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400 text-xs font-medium">
                {t('shell.online', { n: devices.filter(d => d.status === "active").length })}
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 p-1.5 sm:p-2 overflow-auto" style={{ containerType: 'inline-size' }}>{renderTab()}</div>
      </main>

      <AIAssistant isOpen={aiOpen} onClose={() => setAiOpen(false)} />

      {notifOpen && (
        <div className="fixed inset-0 bg-black/70 z-[90] flex items-start sm:items-center justify-center p-3 overflow-y-auto" onClick={() => setNotifOpen(false)}>
          <div className="w-full max-w-2xl my-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-end mb-1">
              <button onClick={() => setNotifOpen(false)} className="p-1.5 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <AppearanceSettings />
              <NotificationSettings />
            </div>
          </div>
        </div>
      )}

      <AttentionPanel
        open={attnOpen}
        onClose={() => setAttnOpen(false)}
        items={attention.items}
        sweeping={attention.sweeping}
        lastSweep={attention.lastSweep}
        onSweep={attention.sweep}
        onAcknowledge={attention.acknowledge}
        canRunProtocols={['field', 'operator', 'coordinator', 'admin'].includes(profile?.role)}
        onRunProtocol={async (item) => {
          // One tap from alert to action: start the matching playbook
          // with the alert attached as context, then show the checklist.
          const protocol = await findProtocolForItem(item);
          if (protocol) {
            await startProtocolRun(protocol, {
              attention: { title: item.title, severity: item.severity, key: item.dedupe_key },
            });
          }
          setAttnOpen(false);
          setActiveTab('protocols');
          if (!protocol) throw new Error('No playbook matches this alert yet — create one in the library');
        }}
      />
      
      {!aiOpen && (
        <button onClick={() => setAiOpen(true)} className="fixed bottom-4 right-4 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform z-30">
          <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </button>
      )}
    </div>
    </CheckinsContext.Provider>
  );
};

export default WatchtowerPortal;


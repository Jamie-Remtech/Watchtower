import { useState, useEffect, useRef } from 'react';
import {
  Video, Users, CreditCard, Settings, Flame, Building2, CheckCircle, Zap, Menu, X, MessageSquare, Radio, Map, Globe, Bell, Mic
} from 'lucide-react';
import { AIAssistant } from './components/AIAssistant';
import { Logo } from './components/common';
import { useAuth } from './auth/AuthContext';
import { ROLE_LABELS, allowedTabs } from './auth/roles';
import { useOrg } from './hooks/useOrg';
import { useDevices } from './hooks/useDevices';
import { useAttention } from './hooks/useAttention';
import { usePresence } from './hooks/usePresence';
import { startTracking, isTrackingPaused } from './lib/tracker';
import { supabase } from './lib/supabase';
import { enableNotifications, ensureSubscribed, notificationPermission, localNotify } from './lib/push';
import { AttentionPanel } from './components/AttentionPanel';
import { alertAnimationStyles } from './styles/alertAnimations';
import { BillingTab } from './tabs/BillingTab';
import { CommsTab } from './tabs/CommsTab';
import { SettingsTab } from './tabs/SettingsTab';
import { StreamsTab } from './tabs/StreamsTab';
import { TacticalMapTab } from './tabs/TacticalMapTab';
import { TeamTab } from './tabs/TeamTab';
import { WorldTab } from './tabs/WorldTab';
import { FieldLogTab } from './tabs/FieldLogTab';



// ============================================
// WATCHTOWER — MAIN SHELL
// Tactical coordination hub: nav + tab routing.
// Each tab lives in src/tabs/, shared pieces in
// src/components/. Real data only — no mock layer.
// ============================================

const WatchtowerPortal = () => {
  const { profile, signOut } = useAuth();
  const org = useOrg();
  const { devices } = useDevices();
  const attention = useAttention();
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('world');
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
        if (activeTabRef.current !== 'comms') {
          setUnreadMsgs(n => n + 1);
          localNotify('Watchtower — new message', payload.new.text?.slice(0, 120) ?? '', '/');
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (activeTab === 'comms') setUnreadMsgs(0);
  }, [activeTab]);

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
  
  // Tabs are filtered by role — e.g. viewers see the World tab only.
  const allowed = allowedTabs(profile?.role);
  const navItems = [
    { id: 'streams', name: 'Live Streams', icon: Video },
    { id: 'tactical', name: 'Tactical Map', icon: Map },
    { id: 'world', name: 'World', icon: Globe },
    { id: 'log', name: 'Field Log', icon: Mic },
    { id: 'comms', name: 'Comms & Tracking', icon: Radio },
    { id: 'team', name: 'Team', icon: Users },
    { id: 'billing', name: 'Billing', icon: CreditCard },
    { id: 'settings', name: 'Settings', icon: Settings },
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
      case 'log': return <FieldLogTab />;
      case 'comms': return <CommsTab />;
      case 'team': return <TeamTab />;
      case 'billing': return <BillingTab />;
      case 'settings': return <SettingsTab />;
      default: return <WorldTab />;
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex overflow-hidden">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-slate-900 border-b border-slate-800 px-4 py-3 z-40 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-800 rounded-lg">
          <Menu className="w-6 h-6 text-slate-300" />
        </button>
        <Logo />
        <div className="flex items-center gap-1">
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
            </button>
          ))}
        </nav>
        
        <div className="px-2 py-2 border-t border-slate-800 space-y-1">
          {notifPerm === 'default' && (
            <button
              onClick={async () => { await enableNotifications(); setNotifPerm(notificationPermission()); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-medium"
            >
              <Bell className="w-3.5 h-3.5" />Enable notifications
            </button>
          )}
          <button onClick={() => setAiOpen(true)} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-orange-500/20 to-orange-600/20 border border-orange-500/30 text-orange-400 text-xs font-medium">
            <Zap className="w-3.5 h-3.5" />AI Assistant
          </button>
        </div>

        {/* Signed-in user */}
        <div className="px-2 py-2 border-t border-slate-800">
          <div className="flex items-center justify-between px-2 py-1.5 bg-slate-800/50 rounded-lg">
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{profile?.display_name ?? 'Signed in'}</p>
              <p className="text-[10px] text-slate-500">
                {ROLE_LABELS[profile?.role] ?? profile?.role}
              </p>
            </div>
            {(
              <button onClick={signOut} className="text-[10px] text-slate-400 hover:text-orange-400 font-medium ml-2 flex-shrink-0">
                Sign out
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 pt-16 lg:pt-0">
        <header className="hidden lg:flex bg-slate-900/80 border-b border-slate-800 px-4 py-2 items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-sm font-bold text-white">{navItems.find(n => n.id === activeTab)?.name}</h1>
            <p className="text-xs text-slate-500">{org.name}{org.region && ` — ${org.region}`}</p>
          </div>
          <div className="flex items-center gap-3">
            {(
              <button onClick={() => setAttnOpen(true)} className="relative p-1.5 hover:bg-slate-800 rounded-lg" title="Attention queue">
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
                <span className="text-white font-bold text-xs">{activeAlerts} ALERT{activeAlerts > 1 ? 'S' : ''}</span>
              </button>
            ) : tendedAlerts > 0 ? (
              <button 
                onClick={() => setActiveTab('streams')}
                className="flex items-center gap-2 px-3 py-1 bg-orange-500 rounded-lg cursor-pointer hover:bg-orange-600 transition-colors"
              >
                <Flame className="w-4 h-4 text-white" />
                <span className="text-white font-bold text-xs">{tendedAlerts} TENDED</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-lg">
                <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                <span className="text-green-400 text-xs font-medium">No active alerts</span>
              </div>
            )}
            {/* Active devices */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-lg">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400 text-xs font-medium">
                {devices.filter(d => d.status === "active").length} online
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 p-1.5 sm:p-2 overflow-auto" style={{ containerType: 'inline-size' }}>{renderTab()}</div>
      </main>

      <AIAssistant isOpen={aiOpen} onClose={() => setAiOpen(false)} />

      <AttentionPanel
        open={attnOpen}
        onClose={() => setAttnOpen(false)}
        items={attention.items}
        sweeping={attention.sweeping}
        lastSweep={attention.lastSweep}
        onSweep={attention.sweep}
        onAcknowledge={attention.acknowledge}
      />
      
      {!aiOpen && (
        <button onClick={() => setAiOpen(true)} className="fixed bottom-4 right-4 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform z-30">
          <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </button>
      )}
    </div>
  );
};

export default WatchtowerPortal;


import { CommsQualityBoard } from '../components/CommsQualityBoard';
import { useState, useEffect, Fragment } from 'react';
import QRCode from 'qrcode';
import {
  Users, AlertTriangle, Eye, Camera, CheckCircle, X, UserPlus, MapPin, Mail, Phone, Shield, ChevronRight, Activity, Radio, Grid, List, Navigation, Map, Copy, Ticket, Loader2
} from 'lucide-react';
import { useTeam } from '../hooks/useTeam';
import { usePresence } from '../hooks/usePresence';
import { useAuth } from '../auth/AuthContext';
import { CheckInBoard } from '../components/CheckInBoard';
import { useCheckinsShared } from '../hooks/useCheckins';
import { ROLES as ROLE_OPTIONS_ALL, ROLE_LABELS, invitableRoles } from '../auth/roles';
import { useI18n } from '../i18n/index.jsx';

// Renders a translated sentence whose {name} slots are filled with elements.
const rich = (s, parts) => s.split(/(\{\w+\})/).map((seg, i) => {
  const m = /^\{(\w+)\}$/.exec(seg);
  return m && m[1] in parts ? <Fragment key={i}>{parts[m[1]]}</Fragment> : seg;
});

// ============================================
// OTHER TABS
// ============================================

export const TeamTab = () => {
  const { t } = useI18n();
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // list, grid, map

  // Live team only, with REAL presence: online = has Watchtower open now.
  const { isLive, liveMembers, invitations, teams, createInvitation, revokeInvitation, dropMember, setMemberRole, updateContact, createTeam, removeTeam, setMemberTeam } = useTeam();
  const onlineIds = usePresence();
  const checkinsShared = useCheckinsShared();
  const { profile, session } = useAuth();
  const myId = session?.user?.id;
  const isAdmin = profile?.role === 'admin';
  const [confirmDropId, setConfirmDropId] = useState(null);
  // Who the current user may stand down: admins → anyone but admins;
  // coordinators → the field ranks. Mirrors the drop_member function.
  const canDrop = (targetRole) =>
    isAdmin ? targetRole !== 'admin'
    : profile?.role === 'coordinator' ? ['viewer', 'field', 'operator'].includes(targetRole)
    : false;
  const canManageTeams = ['coordinator', 'admin'].includes(profile?.role);
  const [newTeamName, setNewTeamName] = useState('');
  const [teamBusy, setTeamBusy] = useState(false);
  const [confirmTeamDelete, setConfirmTeamDelete] = useState(null);
  const teamName = (id) => teams.find(t => t.id === id)?.name ?? null;
  // The hook fills title with the English role label — show it translated.
  const roleTitle = (u) => (u.title === ROLE_LABELS[u.role] ? t(`role.${u.role}`) : u.title);
  const teamMembers = liveMembers.map(m => ({
    ...m,
    status: onlineIds.has(m.id) ? 'online' : 'offline',
    lastActive: onlineIds.has(m.id) ? 'now' : m.lastActive,
  }));

  // Role configurations (covers demo roles and the live role ladder)
  const roleConfigs = {
    admin: { label: t('team.role.admin'), color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Shield },
    coordinator: { label: t('team.role.coordinator'), color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: Activity },
    operator: { label: t('team.role.operator'), color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: Radio },
    pilot: { label: t('team.role.pilot'), color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Navigation },
    field: { label: t('team.role.field'), color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: MapPin },
    viewer: { label: t('team.role.viewer'), color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: Eye },
  };
  
  // Status configurations
  const statusConfigs = {
    online: { label: t('team.status.online'), color: 'bg-green-500', dotColor: 'bg-green-500' },
    offline: { label: t('team.status.offline'), color: 'bg-slate-500', dotColor: 'bg-slate-500' },
    busy: { label: t('team.status.busy'), color: 'bg-red-500', dotColor: 'bg-red-500' },
    away: { label: t('team.status.away'), color: 'bg-yellow-500', dotColor: 'bg-yellow-500' },
  };
  // Open user modal
  const openUserModal = (user) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };
  
  // Get online team members for map
  const onlineMembers = teamMembers.filter(m => m.location && m.locatorEnabled);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-orange-400" />
            {t('team.title')}
          </h2>
          <p className="text-sm text-slate-400 mt-1">{t('team.summary', { n: teamMembers.length, o: teamMembers.filter(m => m.status === 'online').length })}</p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-800 rounded-lg p-1">
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`p-2 rounded ${viewMode === 'map' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Map className="w-4 h-4" />
            </button>
          </div>
          
          <button 
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            {t('team.inviteUser')}
          </button>
        </div>
      </div>
      
      {/* Communications quality — the control centre's view of every link */}
      <CommsQualityBoard />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-green-400">{teamMembers.filter(m => m.status === 'online').length}</p>
              <p className="text-sm text-slate-400">{t('team.stat.onlineNow')}</p>
            </div>
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-orange-400">{teamMembers.filter(m => m.role === 'operator').length}</p>
              <p className="text-sm text-slate-400">{t('team.stat.operators')}</p>
            </div>
            <Radio className="w-8 h-8 text-orange-400/50" />
          </div>
        </div>
        <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-blue-400">{onlineMembers.length}</p>
              <p className="text-sm text-slate-400">{t('team.stat.locatable')}</p>
            </div>
            <MapPin className="w-8 h-8 text-blue-400/50" />
          </div>
        </div>
        <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-white">{teamMembers.reduce((acc, m) => acc + m.alertsHandled, 0)}</p>
              <p className="text-sm text-slate-400">{t('team.stat.totalAlerts')}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-slate-400/50" />
          </div>
        </div>
      </div>
      
      {/* CHECK-IN / PAR — personnel accountability */}
      {checkinsShared && (
        <CheckInBoard
          members={teamMembers}
          teams={teams}
          checkins={checkinsShared.checkins}
          responses={checkinsShared.responses}
          requestCheckin={checkinsShared.requestCheckin}
          closeCheckin={checkinsShared.closeCheckin}
        />
      )}

      {/* TEAMS — parallel operations inside the company */}
      {canManageTeams && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />{t('team.teams.title')}
              <span className="text-[10px] font-normal text-slate-500">{t('team.teams.hint')}</span>
            </h3>
            <div className="flex items-center gap-2">
              <input
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && newTeamName.trim() && !teamBusy) {
                    setTeamBusy(true);
                    try { await createTeam(newTeamName.trim()); setNewTeamName(''); } catch { /* surfaced via hook error */ }
                    setTeamBusy(false);
                  }
                }}
                placeholder={t('team.teams.newPh')}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 w-36"
              />
              <button
                onClick={async () => {
                  if (!newTeamName.trim() || teamBusy) return;
                  setTeamBusy(true);
                  try { await createTeam(newTeamName.trim()); setNewTeamName(''); } catch { /* surfaced via hook error */ }
                  setTeamBusy(false);
                }}
                disabled={teamBusy || !newTeamName.trim()}
                className="px-3 py-1.5 bg-sky-500/20 border border-sky-500/40 text-sky-300 rounded-lg text-xs font-medium disabled:opacity-50"
              >
                {t('team.teams.add')}
              </button>
            </div>
          </div>
          {teams.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {teams.map(tm => {
                const count = teamMembers.filter(m => m.teamId === tm.id).length;
                return (
                  <span key={tm.id} className="flex items-center gap-1.5 pl-2.5 pr-1 py-1 bg-sky-500/10 border border-sky-500/30 rounded-lg text-xs text-sky-200">
                    {tm.name} <span className="text-sky-400/70">({count})</span>
                    {confirmTeamDelete === tm.id ? (
                      <button onClick={() => { removeTeam(tm.id).catch(() => {}); setConfirmTeamDelete(null); }}
                        className="px-1 text-[10px] font-bold text-red-400">{t('team.teams.sure')}</button>
                    ) : (
                      <button onClick={() => { setConfirmTeamDelete(tm.id); setTimeout(() => setConfirmTeamDelete(c => (c === tm.id ? null : c)), 2500); }}
                        className="p-0.5 text-sky-500/60 hover:text-red-400"><X className="w-3 h-3" /></button>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PENDING INVITATIONS (live mode) */}
      {isLive && invitations.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Ticket className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-bold text-white">{t('team.inv.pending')}</h3>
            <span className="text-xs text-slate-500">{invitations.length}</span>
          </div>
          <div className="space-y-2">
            {invitations.map(inv => (
              <div key={inv.id} className="flex items-center justify-between px-3 py-2 bg-slate-800/50 rounded-lg">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-orange-300">{inv.code}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(inv.code)}
                      className="text-slate-500 hover:text-orange-400" title={t('team.inv.copyCode')}
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {ROLE_LABELS[inv.role] ? t(`role.${inv.role}`) : inv.role}
                    {inv.email && t('team.inv.restricted', { email: inv.email })}
                    {t('team.inv.expires', { date: new Date(inv.expires_at).toLocaleDateString() })}
                  </p>
                </div>
                <button
                  onClick={() => revokeInvitation(inv.id)}
                  className="text-xs text-slate-400 hover:text-red-400 flex-shrink-0 ml-3"
                >
                  {t('team.inv.revoke')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl divide-y divide-slate-800">
          {teamMembers.map(user => (
            <div 
              key={user.id} 
              className="p-4 flex items-center justify-between hover:bg-slate-800/30 cursor-pointer transition-all"
              onClick={() => openUserModal(user)}
            >
              <div className="flex items-center gap-4">
                {/* Avatar with status */}
                <div className="relative">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                    user.role === 'admin' ? 'bg-gradient-to-br from-purple-500 to-purple-700' :
                    user.role === 'operator' ? 'bg-gradient-to-br from-orange-500 to-orange-700' :
                    'bg-gradient-to-br from-slate-500 to-slate-700'
                  }`}>
                    {user.initials}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-slate-900 ${statusConfigs[user.status].dotColor}`} />
                </div>
                
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white">{user.name}</p>
                    <span className={`px-2 py-0.5 rounded text-xs border ${roleConfigs[user.role].color}`}>
                      {roleConfigs[user.role].label}
                    </span>
                    {teamName(user.teamId) && (
                      <span className="px-2 py-0.5 bg-sky-500/15 text-sky-300 border border-sky-500/30 rounded text-xs">
                        {teamName(user.teamId)}
                      </span>
                    )}
                    {user.locatorEnabled && user.location && (
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {t('team.live')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">{user.email}</p>
                  <p className="text-xs text-slate-500">{roleTitle(user)} • {user.radioCallsign}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                {/* Devices */}
                <div className="hidden md:flex items-center gap-1">
                  {user.devices.slice(0, 3).map((device, idx) => (
                    <div key={idx} className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      device.type === 'drone' ? 'bg-purple-500/20' : 'bg-blue-500/20'
                    }`}>
                      {device.type === 'drone' ? (
                        <Navigation className="w-4 h-4 text-purple-400" />
                      ) : (
                        <Camera className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                  ))}
                  {user.devices.length > 3 && (
                    <span className="text-xs text-slate-500">+{user.devices.length - 3}</span>
                  )}
                  {user.devices.length === 0 && (
                    <span className="text-xs text-slate-500">{t('team.noDevices')}</span>
                  )}
                </div>
                
                {/* Lifecycle controls: stand down / restore */}
                {user.id !== myId && canDrop(user.role) && user.role !== 'viewer' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirmDropId === user.id) {
                        dropMember(user.id).catch(() => {});
                        setConfirmDropId(null);
                      } else {
                        setConfirmDropId(user.id);
                        setTimeout(() => setConfirmDropId(c => (c === user.id ? null : c)), 3000);
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs border ${
                      confirmDropId === user.id
                        ? 'bg-red-500/20 border-red-500/40 text-red-400 font-bold'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-red-400'
                    }`}
                    title={t('team.standDownTitle')}
                  >
                    {confirmDropId === user.id ? t('team.confirmStandDown') : t('team.standDown')}
                  </button>
                )}
                {isAdmin && user.id !== myId && (
                  <select
                    value={user.role}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => { e.stopPropagation(); setMemberRole(user.id, e.target.value).catch(() => {}); }}
                    className="text-xs px-2 py-1.5 rounded-lg border bg-slate-900 border-slate-700 text-slate-300 focus:outline-none"
                    title={t('team.setRole')}
                  >
                    {ROLE_OPTIONS_ALL.map(r => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
                  </select>
                )}
                {canManageTeams && teams.length > 0 && user.role !== 'viewer' && (
                  <select
                    value={user.teamId ?? ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => { e.stopPropagation(); setMemberTeam(user.id, e.target.value || null).catch(() => {}); }}
                    className="text-xs px-2 py-1.5 rounded-lg border bg-slate-900 border-slate-700 text-sky-300 focus:outline-none hidden sm:block"
                    title={t('team.assignTeam')}
                  >
                    <option value="">{t('team.noTeam')}</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}

                {/* Stats */}
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-white">{t('team.alerts', { n: user.alertsHandled })}</p>
                  <p className="text-xs text-slate-500">{user.lastActive === 'now' ? t('sig.now') : user.lastActive}</p>
                </div>
                
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamMembers.map(user => (
            <div 
              key={user.id}
              className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 hover:border-orange-500/50 cursor-pointer transition-all"
              onClick={() => openUserModal(user)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                      user.role === 'admin' ? 'bg-gradient-to-br from-purple-500 to-purple-700' :
                      user.role === 'operator' ? 'bg-gradient-to-br from-orange-500 to-orange-700' :
                      'bg-gradient-to-br from-slate-500 to-slate-700'
                    }`}>
                      {user.initials}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-slate-900 ${statusConfigs[user.status].dotColor}`} />
                  </div>
                  <div>
                    <p className="font-bold text-white">{user.name}</p>
                    <p className="text-sm text-slate-400">{roleTitle(user)}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs border ${roleConfigs[user.role].color}`}>
                  {roleConfigs[user.role].label}
                </span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <Radio className="w-4 h-4" />
                  <span>{user.radioCallsign} • {user.radioFrequency}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Phone className="w-4 h-4" />
                  <span>{user.mobile}</span>
                </div>
                {user.location && user.locatorEnabled && (
                  <div className="flex items-center gap-2 text-blue-400">
                    <MapPin className="w-4 h-4" />
                    <span>{t('team.locationActive', { time: user.location.lastUpdate })}</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800">
                <div className="flex items-center gap-1">
                  {user.devices.map((device, idx) => (
                    <div key={idx} className={`w-6 h-6 rounded flex items-center justify-center ${
                      device.type === 'drone' ? 'bg-purple-500/20' : 'bg-blue-500/20'
                    }`}>
                      {device.type === 'drone' ? (
                        <Navigation className="w-3 h-3 text-purple-400" />
                      ) : (
                        <Camera className="w-3 h-3 text-blue-400" />
                      )}
                    </div>
                  ))}
                </div>
                <span className="text-xs text-slate-500">{t('team.alertsHandled', { n: user.alertsHandled })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* MAP VIEW */}
      {viewMode === 'map' && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="h-[min(24rem,60dvh)] bg-slate-800 relative">
            {/* Map placeholder */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Map className="w-24 h-24 text-slate-700" />
            </div>
            
            {/* Team member markers */}
            {onlineMembers.map((member, idx) => (
              <div 
                key={member.id}
                className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 group"
                style={{ 
                  left: `${20 + (idx * 15)}%`, 
                  top: `${30 + (idx * 12)}%` 
                }}
                onClick={() => openUserModal(member)}
              >
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm border-2 border-white shadow-lg ${
                    member.role === 'admin' ? 'bg-purple-500' :
                    member.role === 'operator' ? 'bg-orange-500' :
                    'bg-slate-500'
                  }`}>
                    {member.initials}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusConfigs[member.status].dotColor}`} />
                </div>
                
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  <p className="text-white font-medium text-sm">{member.name}</p>
                  <p className="text-xs text-slate-400">{member.radioCallsign}</p>
                  <p className="text-xs text-blue-400">{member.location?.lastUpdate}</p>
                </div>
              </div>
            ))}
            
            {/* Legend */}
            <div className="absolute bottom-4 left-4 p-3 bg-slate-900/90 border border-slate-700 rounded-lg">
              <p className="text-xs text-slate-400 mb-2">{t('team.map.title')}</p>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-slate-300">{statusConfigs.online.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-slate-300">{statusConfigs.away.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-slate-300">{statusConfigs.busy.label}</span>
                </div>
              </div>
            </div>
            
            {/* Stats */}
            <div className="absolute top-4 right-4 p-3 bg-slate-900/90 border border-slate-700 rounded-lg">
              <p className="text-white font-bold">{onlineMembers.length}</p>
              <p className="text-xs text-slate-400">{t('team.stat.locatable')}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* MEMBER MODAL — real fields, editable by the member or an admin */}
      {showUserModal && selectedUser && (
        <MemberModal
          member={selectedUser}
          canEdit={isAdmin || selectedUser.id === myId}
          onSave={updateContact}
          onClose={() => setShowUserModal(false)}
        />
      )}

      {/* INVITE MODAL */}
      {showInviteModal && (
        <InviteModal
          isLive={isLive}
          onClose={() => setShowInviteModal(false)}
          onCreate={createInvitation}
        />
      )}
    </div>
  );
};

// Member detail — real profile fields only. The member edits their own
// card; admins can edit anyone's. Everything else (role, stand-down)
// lives on the roster list.
const raw = (v) => (v && v !== '—' ? v : '');

const MemberModal = ({ member, canEdit, onSave, onClose }) => {
  const { t } = useI18n();
  const [form, setForm] = useState({
    display_name: raw(member.name === 'Unnamed' ? '' : member.name),
    callsign: raw(member.radioCallsign),
    frequency: raw(member.radioFrequency),
    phone: raw(member.phone),
    mobile: raw(member.mobile),
    emergency_phone: raw(member.emergencyPhone),
    emergency_contact: raw(member.emergencyContact),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const set = (k) => (e) => { setSaved(false); setForm(f => ({ ...f, [k]: e.target.value })); };

  const FIELDS = [
    ['display_name', t('team.f.name'), t('team.f.name.h')],
    ['callsign', t('team.f.callsign'), t('team.f.callsign.h')],
    ['frequency', t('team.f.frequency'), t('team.f.frequency.h')],
    ['phone', t('team.f.phone'), ''],
    ['mobile', t('team.f.mobile'), ''],
    ['emergency_phone', t('team.f.emergencyPhone'), t('team.f.emergencyPhone.h')],
    ['emergency_contact', t('team.f.emergencyContact'), t('team.f.emergencyContact.h')],
  ];

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const patch = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]));
      await onSave(member.id, patch);
      setSaved(true);
    } catch (e) {
      setError(e.message ?? t('team.m.saveFail'));
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90dvh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-slate-700">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white font-bold">
            {member.initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white truncate">{form.display_name || member.name}</h3>
              <span className="px-2 py-0.5 rounded text-[10px] bg-orange-500/20 text-orange-300 border border-orange-500/30">
                {ROLE_LABELS[member.role] ? t(`role.${member.role}`) : member.role}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">{t('team.m.joined', { email: member.email, date: member.joinedDate })}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto p-4">
          {!canEdit && (
            <p className="text-[11px] text-slate-500 mb-3">
              {t('team.m.readOnly')}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FIELDS.map(([key, label, hint]) => (
              <div key={key} className={key === 'emergency_contact' ? 'sm:col-span-2' : ''}>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</label>
                {canEdit ? (
                  <input
                    value={form[key]}
                    onChange={set(key)}
                    placeholder={hint || '—'}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500"
                  />
                ) : (
                  <p className="text-sm text-white mt-1 px-3 py-2 bg-slate-800/50 rounded-lg min-h-[36px]">
                    {form[key] || '—'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 p-3 border-t border-slate-700">
          <div className="text-xs">
            {error && <span className="text-red-400">{error}</span>}
            {saved && !error && <span className="text-green-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />{t('team.m.saved')}</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs">
              {t('cib.close')}
            </button>
            {canEdit && (
              <button
                onClick={save}
                disabled={busy}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
              >
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {t('ah.save')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// QR that encodes the join link — scan with any phone camera and the
// app opens straight onto sign-up with the code prefilled. Built for
// onboarding a crew in the field, screen to screen.
const InviteQR = ({ code }) => {
  const { t } = useI18n();
  const [dataUrl, setDataUrl] = useState(null);
  useEffect(() => {
    const url = `${window.location.origin}/?join=${encodeURIComponent(code)}`;
    QRCode.toDataURL(url, { width: 240, margin: 1 }).then(setDataUrl).catch(() => {});
  }, [code]);
  if (!dataUrl) return null;
  return (
    <div className="flex flex-col items-center gap-1.5 py-1">
      <img src={dataUrl} alt={t('team.qr.alt')} className="rounded-lg border-4 border-paper w-[200px] h-[200px]" />
      <p className="text-[10px] text-slate-500">{t('team.qr.note')}</p>
    </div>
  );
};

// Invitation creation modal — in live mode this writes a real invitation
// to Supabase and shows the code to hand to the new collaborator.
const InviteModal = ({ isLive, onClose, onCreate }) => {
  const { t } = useI18n();
  const { profile } = useAuth();
  const roleOptions = invitableRoles(profile?.role);
  const [role, setRole] = useState('field');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const inv = await onCreate({ role, email: email.trim() });
      setCreated(inv);
    } catch (err) {
      setError(err.message ?? t('team.inv.createFail'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-orange-400" />{t('team.inv.title')}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded"><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        {!isLive ? (
          <p className="text-xs text-slate-400">
            {rich(t('team.inv.needLive'), { file: <code className="text-orange-300">.env</code> })}
          </p>
        ) : created ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-300">{rich(t('team.inv.created'), { scan: <span className="text-orange-300 font-medium">{t('team.inv.letScan')}</span> })}</p>
            <InviteQR code={created.code} />
            <p className="text-xs text-slate-300">{rich(t('team.inv.orJoin'), { join: <span className="text-orange-300 font-medium">{t('login.invite')}</span> })}</p>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 border border-orange-500/30 rounded-lg">
              <code className="text-base font-mono text-orange-300 flex-1">{created.code}</code>
              <button
                onClick={() => navigator.clipboard.writeText(created.code)}
                className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs font-medium hover:bg-orange-500/30 flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />{t('team.inv.copy')}
              </button>
            </div>
            {(() => {
              const message =
                `${t('team.msg.intro')}\n\n` +
                `${t('team.msg.step1', { url: window.location.origin })}\n` +
                `${t('team.msg.step2', { join: t('login.invite') })}\n` +
                `${t('team.msg.step3', { code: created.code })}\n` +
                `${created.email ? t('team.msg.step4Email', { email: created.email }) : t('team.msg.step4')}\n\n` +
                `${t('team.msg.outro')}`;
              return (
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`mailto:${created.email ?? ''}?subject=${encodeURIComponent(t('team.msg.subject'))}&body=${encodeURIComponent(message)}`}
                    className="py-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white text-xs font-semibold text-center flex items-center justify-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5" />{t('team.inv.sendEmail')}
                  </a>
                  <button
                    onClick={() => navigator.clipboard.writeText(message)}
                    className="py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-lg text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />{t('team.inv.copyMessage')}
                  </button>
                </div>
              );
            })()}
            <p className="text-[10px] text-slate-500">
              {t('team.inv.role', { role: ROLE_LABELS[created.role] ? t(`role.${created.role}`) : '' })}{created.email && t('team.inv.restricted', { email: created.email })}{t('team.inv.expires', { date: new Date(created.expires_at).toLocaleDateString() })}
            </p>
            <button onClick={onClose} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs">{t('team.inv.done')}</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">{t('team.inv.roleLabel')}</label>
              <div className="space-y-1">
                {roleOptions.map(r => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-xs ${
                      role === r ? 'bg-orange-500/15 border-orange-500/40 text-orange-300' : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-medium">{t(`role.${r}`)}</span>
                    <span className="block text-[10px] text-slate-500">{t(`team.roleDesc.${r}`)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">{t('team.inv.restrictLabel')}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('team.inv.restrictPh')}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500"
              />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              onClick={submit}
              disabled={busy}
              className="w-full py-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{t('team.inv.create')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

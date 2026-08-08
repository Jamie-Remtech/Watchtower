import { useState } from 'react';
import {
  Video, Users, CreditCard, Settings, AlertTriangle, Eye, Camera, CheckCircle, XCircle, X, UserPlus, FileText, MapPin, Download, Edit, Mail, Phone, Shield, Database, ChevronRight, Activity, Radio, Grid, List, User, Navigation, Layers, Map, Satellite, Info, Copy, Ticket, Loader2
} from 'lucide-react';
import { C } from '../data/collaboratorData';
import { useTeam } from '../hooks/useTeam';
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS } from '../auth/roles';


// ============================================
// OTHER TABS
// ============================================

export const TeamTab = () => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [activeUserTab, setActiveUserTab] = useState('profile'); // profile, devices, permissions, location, emergency
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // list, grid, map
  const [activePermissionTab, setActivePermissionTab] = useState('liveStreams'); // For permissions sub-tabs
  
  // Permission module configurations with icons and descriptions
  const permissionModules = {
    liveStreams: { 
      label: 'Live Streams', 
      icon: Video, 
      description: 'Monitor live video feeds from drones and cameras',
      permissions: {
        view: { label: 'View Feeds', desc: 'Watch live video streams' },
        control: { label: 'Control Devices', desc: 'PTZ control, camera adjustments' },
        acknowledge: { label: 'Acknowledge Alerts', desc: 'Respond to detection alerts' },
      }
    },
    drones: { 
      label: 'Drones', 
      icon: Navigation, 
      description: 'Drone fleet management and flight operations',
      permissions: {
        view: { label: 'View Status', desc: 'See drone locations and status' },
        control: { label: 'Flight Control', desc: 'Pilot drones manually' },
        emergency: { label: 'Emergency Actions', desc: 'Execute emergency commands (halt, RTB)' },
        assign: { label: 'Assign Missions', desc: 'Create and assign flight paths' },
      }
    },
    tacticalMap: { 
      label: 'Tactical Map', 
      icon: Map, 
      description: 'Geographic operations and situational awareness',
      permissions: {
        view: { label: 'View Map', desc: 'Access tactical map display' },
        edit: { label: 'Edit Layers', desc: 'Modify map overlays and settings' },
        markers: { label: 'Manage Markers', desc: 'Create/edit tactical markers' },
        geofences: { label: 'Manage Geofences', desc: 'Create/edit restricted zones' },
      }
    },
    library: { 
      label: 'Library', 
      icon: Database, 
      description: 'Historical recordings, incidents, and reports',
      permissions: {
        view: { label: 'View Records', desc: 'Access activity logs and recordings' },
        export: { label: 'Export Data', desc: 'Download and share content' },
        delete: { label: 'Delete Records', desc: 'Remove historical data' },
      }
    },
    team: { 
      label: 'Team', 
      icon: Users, 
      description: 'Personnel management and access control',
      permissions: {
        view: { label: 'View Team', desc: 'See team member profiles' },
        edit: { label: 'Edit Members', desc: 'Modify user information' },
        invite: { label: 'Invite Users', desc: 'Add new team members' },
        remove: { label: 'Remove Users', desc: 'Deactivate team members' },
      }
    },
    billing: { 
      label: 'Billing', 
      icon: CreditCard, 
      description: 'Subscription and usage management',
      permissions: {
        view: { label: 'View Billing', desc: 'See invoices and usage' },
        edit: { label: 'Manage Billing', desc: 'Update payment and subscription' },
      }
    },
    settings: { 
      label: 'Settings', 
      icon: Settings, 
      description: 'System configuration and preferences',
      permissions: {
        view: { label: 'View Settings', desc: 'See system configuration' },
        edit: { label: 'Edit Settings', desc: 'Modify system settings' },
      }
    },
  };
  
  // Comprehensive team members data (demo mode)
  const mockTeamMembers = [
    {
      id: 1,
      name: 'Jean-Pierre Dubois',
      initials: 'JD',
      role: 'admin',
      title: 'Chef de Centre',
      department: 'Command',
      email: 'jp.dubois@sdis11.fr',
      phone: '+33 4 68 11 22 33',
      mobile: '+33 6 12 34 56 78',
      emergencyPhone: '+33 6 98 76 54 32',
      radioCallsign: 'Alpha-1',
      radioFrequency: '156.800 MHz',
      badge: 'SDIS11-001',
      status: 'online', // online, offline, busy, away
      location: { lat: 43.2141, lng: 2.3522, lastUpdate: '2 min ago', accuracy: '5m' },
      locatorEnabled: true,
      locatorType: 'mobile_app', // mobile_app, radio, gps_tracker
      devices: [
        { id: 1, name: 'Drone M3T Carcassonne', type: 'drone', permission: 'full_control' },
        { id: 2, name: 'Drone H20T Limoux', type: 'drone', permission: 'full_control' },
        { id: 3, name: 'PTZ Tower Alpha', type: 'camera', permission: 'full_control' },
      ],
      permissions: {
        liveStreams: { view: true, control: true, acknowledge: true },
        drones: { view: true, control: true, emergency: true, assign: true },
        tacticalMap: { view: true, edit: true, markers: true, geofences: true },
        library: { view: true, export: true, delete: true },
        team: { view: true, edit: true, invite: true, remove: true },
        billing: { view: true, edit: true },
        settings: { view: true, edit: true },
      },
      certifications: ['Drone Pilot License', 'Incident Commander', 'Thermal Imaging'],
      trainingCompleted: ['Watchtower Operator', 'Emergency Response', 'Geofence Management'],
      alertsHandled: 156,
      avgResponseTime: '1m 23s',
      lastActive: '2 min ago',
      joinedDate: '2022-03-15',
      notes: 'Senior commander with extensive drone operation experience.',
      emergencyContacts: [
        { name: 'Marie Dubois', relation: 'Spouse', phone: '+33 6 11 22 33 44' },
        { name: 'SDIS 11 HQ', relation: 'Organization', phone: '+33 4 68 11 00 00' },
      ],
      shifts: { current: 'Day Shift A', schedule: '08:00 - 20:00' },
    },
    {
      id: 2,
      name: 'Marie Laurent',
      initials: 'ML',
      role: 'operator',
      title: 'Opératrice Drones',
      department: 'Operations',
      email: 'm.laurent@sdis11.fr',
      phone: '+33 4 68 11 22 34',
      mobile: '+33 6 23 45 67 89',
      emergencyPhone: '+33 6 87 65 43 21',
      radioCallsign: 'Bravo-2',
      radioFrequency: '156.800 MHz',
      badge: 'SDIS11-012',
      status: 'online',
      location: { lat: 43.2098, lng: 2.3455, lastUpdate: '5 min ago', accuracy: '10m' },
      locatorEnabled: true,
      locatorType: 'mobile_app',
      devices: [
        { id: 1, name: 'Drone M3T Carcassonne', type: 'drone', permission: 'pilot' },
        { id: 4, name: 'Drone M30T Narbonne', type: 'drone', permission: 'pilot' },
      ],
      permissions: {
        liveStreams: { view: true, control: true, acknowledge: true },
        drones: { view: true, control: true, emergency: true, assign: false },
        tacticalMap: { view: true, edit: true, markers: true, geofences: false },
        library: { view: true, export: true, delete: false },
        team: { view: true, edit: false, invite: false, remove: false },
        billing: { view: false, edit: false },
        settings: { view: true, edit: false },
      },
      certifications: ['Drone Pilot License', 'Thermal Imaging'],
      trainingCompleted: ['Watchtower Operator', 'Emergency Response'],
      alertsHandled: 89,
      avgResponseTime: '1m 45s',
      lastActive: '5 min ago',
      joinedDate: '2023-01-10',
      notes: 'Specialized in thermal imaging and night operations.',
      emergencyContacts: [
        { name: 'Pierre Laurent', relation: 'Brother', phone: '+33 6 22 33 44 55' },
      ],
      shifts: { current: 'Day Shift A', schedule: '08:00 - 20:00' },
    },
    {
      id: 3,
      name: 'Thomas Bernard',
      initials: 'TB',
      role: 'operator',
      title: 'Opérateur Surveillance',
      department: 'Operations',
      email: 't.bernard@sdis11.fr',
      phone: '+33 4 68 11 22 35',
      mobile: '+33 6 34 56 78 90',
      emergencyPhone: '+33 6 76 54 32 10',
      radioCallsign: 'Charlie-3',
      radioFrequency: '156.800 MHz',
      badge: 'SDIS11-023',
      status: 'busy',
      location: { lat: 43.2180, lng: 2.3600, lastUpdate: '1 min ago', accuracy: '3m' },
      locatorEnabled: true,
      locatorType: 'gps_tracker',
      devices: [
        { id: 3, name: 'PTZ Tower Alpha', type: 'camera', permission: 'full_control' },
        { id: 5, name: 'Fixed Cam Entrance', type: 'camera', permission: 'view_only' },
      ],
      permissions: {
        liveStreams: { view: true, control: true, acknowledge: true },
        drones: { view: true, control: false, emergency: false, assign: false },
        tacticalMap: { view: true, edit: true, markers: true, geofences: false },
        library: { view: true, export: true, delete: false },
        team: { view: true, edit: false, invite: false, remove: false },
        billing: { view: false, edit: false },
        settings: { view: true, edit: false },
      },
      certifications: ['Surveillance Operator'],
      trainingCompleted: ['Watchtower Operator', 'PTZ Operations'],
      alertsHandled: 67,
      avgResponseTime: '2m 12s',
      lastActive: '1 min ago',
      joinedDate: '2023-06-20',
      notes: 'Camera specialist, excellent situational awareness.',
      emergencyContacts: [
        { name: 'Céline Bernard', relation: 'Spouse', phone: '+33 6 33 44 55 66' },
      ],
      shifts: { current: 'Day Shift A', schedule: '08:00 - 20:00' },
    },
    {
      id: 4,
      name: 'Sophie Martin',
      initials: 'SM',
      role: 'viewer',
      title: 'Analyste',
      department: 'Analysis',
      email: 's.martin@sdis11.fr',
      phone: '+33 4 68 11 22 36',
      mobile: '+33 6 45 67 89 01',
      emergencyPhone: '+33 6 65 43 21 09',
      radioCallsign: 'Delta-4',
      radioFrequency: '156.800 MHz',
      badge: 'SDIS11-034',
      status: 'away',
      location: { lat: 43.2155, lng: 2.3510, lastUpdate: '15 min ago', accuracy: '50m' },
      locatorEnabled: true,
      locatorType: 'mobile_app',
      devices: [],
      permissions: {
        liveStreams: { view: true, control: false, acknowledge: false },
        drones: { view: true, control: false, emergency: false, assign: false },
        tacticalMap: { view: true, edit: false, markers: false, geofences: false },
        library: { view: true, export: true, delete: false },
        team: { view: true, edit: false, invite: false, remove: false },
        billing: { view: false, edit: false },
        settings: { view: false, edit: false },
      },
      certifications: ['Data Analysis'],
      trainingCompleted: ['Watchtower Viewer'],
      alertsHandled: 0,
      avgResponseTime: '-',
      lastActive: '15 min ago',
      joinedDate: '2023-09-01',
      notes: 'Focuses on post-incident analysis and reporting.',
      emergencyContacts: [
        { name: 'Jean Martin', relation: 'Father', phone: '+33 6 44 55 66 77' },
      ],
      shifts: { current: 'Day Shift B', schedule: '08:00 - 20:00' },
    },
    {
      id: 5,
      name: 'Lucas Petit',
      initials: 'LP',
      role: 'operator',
      title: 'Pilote Drone',
      department: 'Operations',
      email: 'l.petit@sdis11.fr',
      phone: '+33 4 68 11 22 37',
      mobile: '+33 6 56 78 90 12',
      emergencyPhone: '+33 6 54 32 10 98',
      radioCallsign: 'Echo-5',
      radioFrequency: '156.800 MHz',
      badge: 'SDIS11-045',
      status: 'offline',
      location: null,
      locatorEnabled: false,
      locatorType: 'radio',
      devices: [
        { id: 2, name: 'Drone H20T Limoux', type: 'drone', permission: 'pilot' },
      ],
      permissions: {
        liveStreams: { view: true, control: true, acknowledge: true },
        drones: { view: true, control: true, emergency: true, assign: false },
        tacticalMap: { view: true, edit: true, markers: true, geofences: false },
        library: { view: true, export: false, delete: false },
        team: { view: true, edit: false, invite: false, remove: false },
        billing: { view: false, edit: false },
        settings: { view: true, edit: false },
      },
      certifications: ['Drone Pilot License'],
      trainingCompleted: ['Watchtower Operator'],
      alertsHandled: 34,
      avgResponseTime: '2m 05s',
      lastActive: '2 hours ago',
      joinedDate: '2024-01-05',
      notes: 'New team member, completing advanced training.',
      emergencyContacts: [
        { name: 'Emma Petit', relation: 'Sister', phone: '+33 6 55 66 77 88' },
      ],
      shifts: { current: 'Off Duty', schedule: '-' },
    },
  ];

  // Live data from Supabase (falls back to demo roster when not configured)
  const { isLive, liveMembers, invitations, loading: teamLoading, createInvitation, revokeInvitation } = useTeam();
  const teamMembers = isLive ? liveMembers : mockTeamMembers;

  // Role configurations (covers demo roles and the live role ladder)
  const roleConfigs = {
    admin: { label: 'Admin', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Shield },
    coordinator: { label: 'Coordinator', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: Activity },
    operator: { label: 'Operator', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: Radio },
    pilot: { label: 'Pilot', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Navigation },
    field: { label: 'Field', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: MapPin },
    viewer: { label: 'Viewer', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: Eye },
  };
  
  // Status configurations
  const statusConfigs = {
    online: { label: 'Online', color: 'bg-green-500', dotColor: 'bg-green-500' },
    offline: { label: 'Offline', color: 'bg-slate-500', dotColor: 'bg-slate-500' },
    busy: { label: 'Busy', color: 'bg-red-500', dotColor: 'bg-red-500' },
    away: { label: 'Away', color: 'bg-yellow-500', dotColor: 'bg-yellow-500' },
  };
  
  // Device permission levels
  const permissionLevels = {
    full_control: { label: 'Full Control', color: 'text-green-400', desc: 'All operations including emergency' },
    pilot: { label: 'Pilot', color: 'text-blue-400', desc: 'Flight control and camera operations' },
    operator: { label: 'Operator', color: 'text-orange-400', desc: 'Camera control and monitoring' },
    view_only: { label: 'View Only', color: 'text-slate-400', desc: 'Live feed viewing only' },
  };
  
  // Open user modal
  const openUserModal = (user) => {
    setSelectedUser(user);
    setActiveUserTab('profile');
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
            Team Management
          </h2>
          <p className="text-sm text-slate-400 mt-1">{teamMembers.length} team members • {teamMembers.filter(m => m.status === 'online').length} online</p>
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
            Invite User
          </button>
        </div>
      </div>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-green-400">{teamMembers.filter(m => m.status === 'online').length}</p>
              <p className="text-sm text-slate-400">Online Now</p>
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
              <p className="text-sm text-slate-400">Operators</p>
            </div>
            <Radio className="w-8 h-8 text-orange-400/50" />
          </div>
        </div>
        <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-blue-400">{onlineMembers.length}</p>
              <p className="text-sm text-slate-400">Locatable</p>
            </div>
            <MapPin className="w-8 h-8 text-blue-400/50" />
          </div>
        </div>
        <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-white">{teamMembers.reduce((acc, m) => acc + m.alertsHandled, 0)}</p>
              <p className="text-sm text-slate-400">Total Alerts</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-slate-400/50" />
          </div>
        </div>
      </div>
      
      {/* PENDING INVITATIONS (live mode) */}
      {isLive && invitations.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Ticket className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-bold text-white">Pending Invitations</h3>
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
                      className="text-slate-500 hover:text-orange-400" title="Copy code"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {ROLE_LABELS[inv.role] ?? inv.role}
                    {inv.email && ` · restricted to ${inv.email}`}
                    {' · expires '}{new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => revokeInvitation(inv.id)}
                  className="text-xs text-slate-400 hover:text-red-400 flex-shrink-0 ml-3"
                >
                  Revoke
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
                    {user.locatorEnabled && user.location && (
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Live
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">{user.email}</p>
                  <p className="text-xs text-slate-500">{user.title} • {user.radioCallsign}</p>
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
                    <span className="text-xs text-slate-500">No devices</span>
                  )}
                </div>
                
                {/* Stats */}
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-white">{user.alertsHandled} alerts</p>
                  <p className="text-xs text-slate-500">{user.lastActive}</p>
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
                    <p className="text-sm text-slate-400">{user.title}</p>
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
                    <span>Location active • {user.location.lastUpdate}</span>
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
                <span className="text-xs text-slate-500">{user.alertsHandled} alerts handled</span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* MAP VIEW */}
      {viewMode === 'map' && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="h-96 bg-slate-800 relative">
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
              <p className="text-xs text-slate-400 mb-2">Team Locations</p>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-slate-300">Online</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-slate-300">Away</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-slate-300">Busy</span>
                </div>
              </div>
            </div>
            
            {/* Stats */}
            <div className="absolute top-4 right-4 p-3 bg-slate-900/90 border border-slate-700 rounded-lg">
              <p className="text-white font-bold">{onlineMembers.length}</p>
              <p className="text-xs text-slate-400">Locatable</p>
            </div>
          </div>
        </div>
      )}
      
      {/* User Detail Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header - Sticky */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    selectedUser.role === 'admin' ? 'bg-gradient-to-br from-purple-500 to-purple-700' :
                    selectedUser.role === 'operator' ? 'bg-gradient-to-br from-orange-500 to-orange-700' :
                    'bg-gradient-to-br from-slate-500 to-slate-700'
                  }`}>
                    {selectedUser.initials}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${statusConfigs[selectedUser.status].dotColor}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{selectedUser.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs border ${roleConfigs[selectedUser.role].color}`}>
                      {roleConfigs[selectedUser.role].label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{selectedUser.title} • {selectedUser.department}</p>
                </div>
              </div>
              <button onClick={() => setShowUserModal(false)} className="p-1.5 hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            {/* Tabs - Sticky */}
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-700 bg-slate-800/30 overflow-x-auto flex-shrink-0">
              {[
                { id: 'profile', label: 'Profile', icon: User },
                { id: 'contact', label: 'Contact', icon: Phone },
                { id: 'devices', label: 'Devices', icon: Radio },
                { id: 'permissions', label: 'Permissions', icon: Shield },
                { id: 'location', label: 'Location', icon: MapPin },
                { id: 'activity', label: 'Activity', icon: Activity },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveUserTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${
                    activeUserTab === tab.id 
                      ? 'bg-orange-500 text-white' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
            
            {/* Tab Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4">
              
              {/* PROFILE Tab */}
              {activeUserTab === 'profile' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 uppercase tracking-wide">Full Name</label>
                      <p className="text-white mt-1">{selectedUser.name}</p>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 uppercase tracking-wide">Title</label>
                      <p className="text-white mt-1">{selectedUser.title}</p>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 uppercase tracking-wide">Department</label>
                      <p className="text-white mt-1">{selectedUser.department}</p>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 uppercase tracking-wide">Badge Number</label>
                      <p className="text-white mt-1">{selectedUser.badge}</p>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 uppercase tracking-wide">Joined Date</label>
                      <p className="text-white mt-1">{selectedUser.joinedDate}</p>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 uppercase tracking-wide">Current Shift</label>
                      <p className="text-white mt-1">{selectedUser.shifts.current} ({selectedUser.shifts.schedule})</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wide">Certifications</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedUser.certifications.map((cert, idx) => (
                        <span key={idx} className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm border border-green-500/30">
                          ✓ {cert}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wide">Training Completed</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedUser.trainingCompleted.map((training, idx) => (
                        <span key={idx} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-sm">
                          {training}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wide">Notes</label>
                    <p className="text-slate-300 mt-1">{selectedUser.notes}</p>
                  </div>
                  
                  {/* Performance Stats */}
                  <div className="grid grid-cols-3 gap-4 p-4 bg-slate-800/50 rounded-xl">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-400">{selectedUser.alertsHandled}</p>
                      <p className="text-xs text-slate-400">Alerts Handled</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-400">{selectedUser.avgResponseTime}</p>
                      <p className="text-xs text-slate-400">Avg Response</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-400">{selectedUser.devices.length}</p>
                      <p className="text-xs text-slate-400">Devices Assigned</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* CONTACT & EMERGENCY Tab */}
              {activeUserTab === 'contact' && (
                <div className="space-y-6">
                  {/* Contact Info */}
                  <div>
                    <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-orange-400" />
                      Contact Information
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-800/50 rounded-xl">
                        <label className="text-xs text-slate-500 uppercase tracking-wide">Email</label>
                        <p className="text-white mt-1 flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400" />
                          {selectedUser.email}
                        </p>
                      </div>
                      <div className="p-4 bg-slate-800/50 rounded-xl">
                        <label className="text-xs text-slate-500 uppercase tracking-wide">Office Phone</label>
                        <p className="text-white mt-1 flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-400" />
                          {selectedUser.phone}
                        </p>
                      </div>
                      <div className="p-4 bg-slate-800/50 rounded-xl">
                        <label className="text-xs text-slate-500 uppercase tracking-wide">Mobile</label>
                        <p className="text-white mt-1 flex items-center gap-2">
                          <Phone className="w-4 h-4 text-green-400" />
                          {selectedUser.mobile}
                        </p>
                      </div>
                      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <label className="text-xs text-red-400 uppercase tracking-wide">Emergency Phone</label>
                        <p className="text-white mt-1 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          {selectedUser.emergencyPhone}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Radio Info */}
                  <div>
                    <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                      <Radio className="w-4 h-4 text-orange-400" />
                      Radio Communications
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-800/50 rounded-xl">
                        <label className="text-xs text-slate-500 uppercase tracking-wide">Callsign</label>
                        <p className="text-white mt-1 text-lg font-mono">{selectedUser.radioCallsign}</p>
                      </div>
                      <div className="p-4 bg-slate-800/50 rounded-xl">
                        <label className="text-xs text-slate-500 uppercase tracking-wide">Frequency</label>
                        <p className="text-white mt-1 text-lg font-mono">{selectedUser.radioFrequency}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Emergency Contacts */}
                  <div>
                    <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      Emergency Contacts
                    </h4>
                    <div className="space-y-3">
                      {selectedUser.emergencyContacts.map((contact, idx) => (
                        <div key={idx} className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">{contact.name}</p>
                            <p className="text-sm text-slate-400">{contact.relation}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-mono">{contact.phone}</span>
                            <button className="p-2 bg-red-500 hover:bg-red-600 rounded-lg">
                              <Phone className="w-4 h-4 text-white" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* DEVICES Tab */}
              {activeUserTab === 'devices' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white font-medium flex items-center gap-2">
                      <Radio className="w-4 h-4 text-orange-400" />
                      Assigned Devices ({selectedUser.devices.length})
                    </h4>
                    <button className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm">
                      + Assign Device
                    </button>
                  </div>
                  
                  {selectedUser.devices.length > 0 ? (
                    <div className="space-y-3">
                      {selectedUser.devices.map((device, idx) => (
                        <div key={idx} className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              device.type === 'drone' ? 'bg-purple-500/20' : 'bg-blue-500/20'
                            }`}>
                              {device.type === 'drone' ? (
                                <Navigation className="w-6 h-6 text-purple-400" />
                              ) : (
                                <Camera className="w-6 h-6 text-blue-400" />
                              )}
                            </div>
                            <div>
                              <p className="text-white font-medium">{device.name}</p>
                              <p className="text-sm text-slate-400 capitalize">{device.type}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-lg text-sm ${
                              device.permission === 'full_control' ? 'bg-green-500/20 text-green-400' :
                              device.permission === 'pilot' ? 'bg-blue-500/20 text-blue-400' :
                              device.permission === 'operator' ? 'bg-orange-500/20 text-orange-400' :
                              'bg-slate-500/20 text-slate-400'
                            }`}>
                              {permissionLevels[device.permission].label}
                            </span>
                            <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-400">
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-800/30 rounded-xl">
                      <Radio className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">No devices assigned</p>
                      <button className="mt-3 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm">
                        Assign First Device
                      </button>
                    </div>
                  )}
                  
                  {/* Permission Levels Legend */}
                  <div className="p-4 bg-slate-800/30 rounded-xl">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Permission Levels</p>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(permissionLevels).map(([key, level]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${
                            key === 'full_control' ? 'bg-green-500' :
                            key === 'pilot' ? 'bg-blue-500' :
                            key === 'operator' ? 'bg-orange-500' :
                            'bg-slate-500'
                          }`} />
                          <div>
                            <p className="text-sm text-white">{level.label}</p>
                            <p className="text-xs text-slate-500">{level.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* PERMISSIONS Tab */}
              {activeUserTab === 'permissions' && (
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <h4 className="text-white font-medium flex items-center gap-2">
                      <Shield className="w-4 h-4 text-orange-400" />
                      Application Permissions
                    </h4>
                    <span className={`px-3 py-1 rounded-lg text-sm border ${roleConfigs[selectedUser.role].color}`}>
                      Role: {roleConfigs[selectedUser.role].label}
                    </span>
                  </div>
                  
                  {/* Permission Module Tabs - Scrollable */}
                  <div className="overflow-x-auto pb-2">
                    <div className="flex gap-1 p-1 bg-slate-800/50 rounded-xl min-w-max">
                      {Object.entries(permissionModules).map(([key, module]) => {
                        const IconComponent = module.icon;
                        const modulePerms = selectedUser.permissions[key];
                        const enabledCount = modulePerms ? Object.values(modulePerms).filter(Boolean).length : 0;
                        const totalCount = modulePerms ? Object.keys(modulePerms).length : 0;
                        
                        return (
                          <button
                            key={key}
                            onClick={() => setActivePermissionTab(key)}
                            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                              activePermissionTab === key
                                ? 'bg-orange-500 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                            }`}
                          >
                            <IconComponent className="w-3.5 h-3.5" />
                            <span>{module.label}</span>
                            <span className={`px-1 py-0.5 rounded text-[10px] ${
                              activePermissionTab === key 
                                ? 'bg-white/20' 
                                : enabledCount === totalCount 
                                  ? 'bg-green-500/20 text-green-400'
                                  : enabledCount === 0
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {enabledCount}/{totalCount}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Active Permission Module Content */}
                  {permissionModules[activePermissionTab] && (
                    <div className="bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden">
                      {/* Module Header - Compact */}
                      <div className="p-3 bg-slate-800/50 border-b border-slate-700">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const IconComponent = permissionModules[activePermissionTab].icon;
                            return <IconComponent className="w-5 h-5 text-orange-400" />;
                          })()}
                          <div>
                            <h5 className="text-white font-bold text-sm">{permissionModules[activePermissionTab].label}</h5>
                            <p className="text-xs text-slate-400">{permissionModules[activePermissionTab].description}</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Permissions List - Compact */}
                      <div className="p-3 space-y-2">
                        {Object.entries(permissionModules[activePermissionTab].permissions).map(([permKey, permInfo]) => {
                          const isEnabled = selectedUser.permissions[activePermissionTab]?.[permKey] || false;
                          
                          return (
                            <div 
                              key={permKey}
                              className={`p-3 rounded-lg border transition-all ${
                                isEnabled 
                                  ? 'bg-green-500/10 border-green-500/30' 
                                  : 'bg-slate-800/50 border-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                    isEnabled ? 'bg-green-500/20' : 'bg-slate-700'
                                  }`}>
                                    {isEnabled ? (
                                      <CheckCircle className="w-4 h-4 text-green-400" />
                                    ) : (
                                      <XCircle className="w-4 h-4 text-slate-500" />
                                    )}
                                  </div>
                                  <div>
                                    <p className={`text-sm font-medium ${isEnabled ? 'text-white' : 'text-slate-400'}`}>
                                      {permInfo.label}
                                    </p>
                                    <p className="text-xs text-slate-500">{permInfo.desc}</p>
                                  </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={isEnabled} 
                                    className="sr-only peer"
                                    readOnly
                                  />
                                  <div className={`w-9 h-5 rounded-full peer-focus:outline-none transition-all ${
                                    isEnabled ? 'bg-green-500' : 'bg-slate-600'
                                  }`}>
                                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                                      isEnabled ? 'translate-x-4' : 'translate-x-0'
                                    }`} />
                                  </div>
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Module Summary - Compact */}
                      <div className="p-3 bg-slate-800/50 border-t border-slate-700">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-xs">
                            {(() => {
                              const modulePerms = selectedUser.permissions[activePermissionTab];
                              const enabledCount = modulePerms ? Object.values(modulePerms).filter(Boolean).length : 0;
                              const totalCount = modulePerms ? Object.keys(modulePerms).length : 0;
                              
                              return (
                                <>
                                  <span className="text-green-400">✓ {enabledCount} Enabled</span>
                                  <span className="text-slate-500">✗ {totalCount - enabledCount} Disabled</span>
                                </>
                              );
                            })()}
                          </div>
                          <div className="flex gap-1">
                            <button className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs">
                              All On
                            </button>
                            <button className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs">
                              All Off
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Quick Overview - Scrollable */}
                  <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                    <h5 className="text-white font-medium text-sm mb-2">Permissions Overview</h5>
                    <div className="overflow-x-auto">
                      <div className="flex gap-2 min-w-max">
                        {Object.entries(permissionModules).map(([key, module]) => {
                          const modulePerms = selectedUser.permissions[key];
                          const enabledCount = modulePerms ? Object.values(modulePerms).filter(Boolean).length : 0;
                          const totalCount = modulePerms ? Object.keys(modulePerms).length : 0;
                          const percentage = totalCount > 0 ? Math.round((enabledCount / totalCount) * 100) : 0;
                          const IconComponent = module.icon;
                          
                          return (
                            <div 
                              key={key}
                              onClick={() => setActivePermissionTab(key)}
                              className={`p-2 rounded-lg cursor-pointer transition-all text-center min-w-[70px] ${
                                activePermissionTab === key 
                                  ? 'bg-orange-500/20 border border-orange-500/50' 
                                  : 'bg-slate-800/50 border border-transparent hover:border-slate-600'
                              }`}
                            >
                              <IconComponent className={`w-4 h-4 mx-auto mb-1 ${
                                percentage === 100 ? 'text-green-400' :
                                percentage === 0 ? 'text-red-400' :
                                'text-yellow-400'
                              }`} />
                              <p className="text-[10px] text-slate-400 truncate">{module.label}</p>
                              <p className={`text-xs font-bold ${
                                percentage === 100 ? 'text-green-400' :
                                percentage === 0 ? 'text-red-400' :
                                'text-yellow-400'
                              }`}>{percentage}%</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  
                  {/* Role Presets */}
                  <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                    <h5 className="text-white font-medium text-sm mb-2">Apply Role Preset</h5>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { role: 'admin', label: 'Admin', desc: 'Full access', color: 'purple' },
                        { role: 'operator', label: 'Operator', desc: 'Operations', color: 'orange' },
                        { role: 'pilot', label: 'Pilot', desc: 'Drone control', color: 'blue' },
                        { role: 'viewer', label: 'Viewer', desc: 'View only', color: 'slate' },
                      ].map(preset => (
                        <button
                          key={preset.role}
                          className={`p-2 rounded-lg border text-left transition-all ${
                            selectedUser.role === preset.role
                              ? `bg-${preset.color}-500/20 border-${preset.color}-500/50`
                              : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full bg-${preset.color}-500`} />
                            <span className="text-white font-medium text-xs">{preset.label}</span>
                            {selectedUser.role === preset.role && (
                              <CheckCircle className="w-3 h-3 text-green-400 ml-auto" />
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">{preset.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* LOCATION Tab */}
              {activeUserTab === 'location' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white font-medium flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-orange-400" />
                      Location Tracking
                    </h4>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={selectedUser.locatorEnabled} className="w-4 h-4 rounded" readOnly />
                      <span className="text-sm text-slate-300">Location Enabled</span>
                    </label>
                  </div>
                  
                  {selectedUser.location && selectedUser.locatorEnabled ? (
                    <>
                      <div className="h-64 bg-slate-800 rounded-xl relative overflow-hidden">
                        {/* Map placeholder */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Map className="w-16 h-16 text-slate-700" />
                        </div>
                        {/* User marker */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold border-4 border-white shadow-lg ${
                            selectedUser.role === 'admin' ? 'bg-purple-500' :
                            selectedUser.role === 'operator' ? 'bg-orange-500' :
                            'bg-slate-500'
                          }`}>
                            {selectedUser.initials}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-slate-800/50 rounded-xl">
                          <label className="text-xs text-slate-500 uppercase tracking-wide">Latitude</label>
                          <p className="text-white mt-1 font-mono">{selectedUser.location.lat}</p>
                        </div>
                        <div className="p-4 bg-slate-800/50 rounded-xl">
                          <label className="text-xs text-slate-500 uppercase tracking-wide">Longitude</label>
                          <p className="text-white mt-1 font-mono">{selectedUser.location.lng}</p>
                        </div>
                        <div className="p-4 bg-slate-800/50 rounded-xl">
                          <label className="text-xs text-slate-500 uppercase tracking-wide">Last Update</label>
                          <p className="text-white mt-1">{selectedUser.location.lastUpdate}</p>
                        </div>
                        <div className="p-4 bg-slate-800/50 rounded-xl">
                          <label className="text-xs text-slate-500 uppercase tracking-wide">Accuracy</label>
                          <p className="text-white mt-1">{selectedUser.location.accuracy}</p>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-slate-800/50 rounded-xl">
                        <label className="text-xs text-slate-500 uppercase tracking-wide">Locator Type</label>
                        <div className="flex items-center gap-4 mt-2">
                          {[
                            { id: 'mobile_app', label: 'Mobile App', icon: Phone },
                            { id: 'gps_tracker', label: 'GPS Tracker', icon: Satellite },
                            { id: 'radio', label: 'Radio', icon: Radio },
                          ].map(type => (
                            <label key={type.id} className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer ${
                              selectedUser.locatorType === type.id 
                                ? 'bg-orange-500/20 border border-orange-500/50 text-orange-400' 
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              <type.icon className="w-4 h-4" />
                              <span>{type.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center bg-slate-800/30 rounded-xl">
                      <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">Location tracking is disabled</p>
                      <button className="mt-3 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm">
                        Enable Location
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* ACTIVITY Tab */}
              {activeUserTab === 'activity' && (
                <div className="space-y-6">
                  <h4 className="text-white font-medium flex items-center gap-2">
                    <Activity className="w-4 h-4 text-orange-400" />
                    Recent Activity
                  </h4>
                  
                  <div className="space-y-3">
                    {[
                      { time: '14:32', action: 'Acknowledged fire alert', device: 'Drone M3T', type: 'alert' },
                      { time: '14:35', action: 'Took manual control', device: 'Drone M3T', type: 'control' },
                      { time: '14:40', action: 'Created marker: Fire Origin', device: null, type: 'marker' },
                      { time: '13:00', action: 'Started shift', device: null, type: 'session' },
                      { time: '12:45', action: 'Reviewed incident report', device: null, type: 'review' },
                    ].map((activity, idx) => (
                      <div key={idx} className="flex items-center gap-4 p-3 bg-slate-800/30 rounded-lg">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          activity.type === 'alert' ? 'bg-red-500/20' :
                          activity.type === 'control' ? 'bg-purple-500/20' :
                          activity.type === 'marker' ? 'bg-blue-500/20' :
                          'bg-slate-700'
                        }`}>
                          {activity.type === 'alert' && <AlertTriangle className="w-5 h-5 text-red-400" />}
                          {activity.type === 'control' && <Navigation className="w-5 h-5 text-purple-400" />}
                          {activity.type === 'marker' && <MapPin className="w-5 h-5 text-blue-400" />}
                          {activity.type === 'session' && <User className="w-5 h-5 text-slate-400" />}
                          {activity.type === 'review' && <FileText className="w-5 h-5 text-slate-400" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-white">{activity.action}</p>
                          {activity.device && <p className="text-xs text-slate-500">{activity.device}</p>}
                        </div>
                        <span className="text-sm text-slate-400">{activity.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-3 border-t border-slate-700 bg-slate-800/50">
              <button className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs order-2 sm:order-1">
                Deactivate
              </button>
              <div className="flex gap-2 order-1 sm:order-2">
                <button
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 sm:flex-none px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs"
                >
                  Close
                </button>
                <button className="flex-1 sm:flex-none px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
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

// Invitation creation modal — in live mode this writes a real invitation
// to Supabase and shows the code to hand to the new collaborator.
const InviteModal = ({ isLive, onClose, onCreate }) => {
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
      setError(err.message ?? 'Could not create invitation');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-orange-400" />Invite a collaborator
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded"><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        {!isLive ? (
          <p className="text-xs text-slate-400">
            Invitations need live mode. Configure Supabase in <code className="text-orange-300">.env</code> to invite real collaborators.
          </p>
        ) : created ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-300">Invitation created. Give this code to your collaborator — they sign up with <span className="text-orange-300 font-medium">Join with invite</span>:</p>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 border border-orange-500/30 rounded-lg">
              <code className="text-base font-mono text-orange-300 flex-1">{created.code}</code>
              <button
                onClick={() => navigator.clipboard.writeText(created.code)}
                className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs font-medium hover:bg-orange-500/30 flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />Copy
              </button>
            </div>
            {(() => {
              const message =
                `You're invited to Watchtower!\n\n` +
                `1. Open ${window.location.origin}\n` +
                `2. Tap "Join with invite"\n` +
                `3. Enter invitation code: ${created.code}\n` +
                `4. Create your account${created.email ? ` using this email (${created.email})` : ''}\n\n` +
                `You'll see the world live: weather, storms, wildfires and earthquakes on one globe.`;
              return (
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`mailto:${created.email ?? ''}?subject=${encodeURIComponent('Your Watchtower invitation')}&body=${encodeURIComponent(message)}`}
                    className="py-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white text-xs font-semibold text-center flex items-center justify-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5" />Send by email
                  </a>
                  <button
                    onClick={() => navigator.clipboard.writeText(message)}
                    className="py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-lg text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />Copy message
                  </button>
                </div>
              );
            })()}
            <p className="text-[10px] text-slate-500">
              Role: {ROLE_LABELS[created.role]}{created.email && ` · restricted to ${created.email}`} · expires {new Date(created.expires_at).toLocaleDateString()}
            </p>
            <button onClick={onClose} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs">Done</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Role</label>
              <div className="space-y-1">
                {ROLES.map(r => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-xs ${
                      role === r ? 'bg-orange-500/15 border-orange-500/40 text-orange-300' : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-medium">{ROLE_LABELS[r]}</span>
                    <span className="block text-[10px] text-slate-500">{ROLE_DESCRIPTIONS[r]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Restrict to email (optional)</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="anyone with the code can join if empty"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500"
              />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              onClick={submit}
              disabled={busy}
              className="w-full py-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Create invitation
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

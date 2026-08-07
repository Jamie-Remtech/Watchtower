import { useState } from 'react';
import {
  Users, AlertTriangle, CheckCircle, Zap, X, MessageSquare, UserPlus, MapPin, Search, Edit, Mail, Phone, Shield, Target, Radio, Copy, Lock, Grid, List, User, Battery, Navigation, Map, Wind, Satellite, Flag, Headphones, Mic, MicOff, Send, Hash, ChevronDown, PhoneCall, Megaphone
} from 'lucide-react';
import { CollaboratorPreviewFrame } from '../components/Collaborator';
import { C } from '../data/collaboratorData';
import { LiveEmptyState } from '../components/LiveEmptyState';
import { useTeam } from '../hooks/useTeam';


// ============================================
// COMMUNICATIONS & LOCATION TAB
// Full international comms, tracking, and emergency coordination
// ============================================
export const CommsTab = () => {
  const { isLive, liveMembers } = useTeam();
  const [activePanel, setActivePanel] = useState('channels');
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [pttActive, setPttActive] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState(null);
  const [trackingFilter, setTrackingFilter] = useState('all');
  const [commsSearch, setCommsSearch] = useState('');
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState('normal');
  const [broadcastProtocol, setBroadcastProtocol] = useState('cap');
  const [showEvacModal, setShowEvacModal] = useState(false);
  const [evacRoute, setEvacRoute] = useState(null);
  const [expandedRadio, setExpandedRadio] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [externalContacts, setExternalContacts] = useState([]);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showCollaboratorPreview, setShowCollaboratorPreview] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', role: '', location: '', lat: '', lng: '', locatorId: '' });
  const [activeShareMethod, setActiveShareMethod] = useState(null);
  const [shareRecipient, setShareRecipient] = useState('');
  const [shareSent, setShareSent] = useState(null);

  // Personnel data with full comms + location
  const personnel = [
    { id: 1, name: 'Cmdr. Sarah Chen', callsign: 'EAGLE-1', role: 'Incident Commander', unit: 'Command', status: 'active', lat: 43.3167, lng: 0.7167, altitude: '320m', heading: 'NE', speed: 0, lastCheckin: '2 min ago', checkinStatus: 'ok', comms: { radio: 'VHF Ch.4', phone: '+33 6 12 34 56 78', satellite: 'Iridium 8816-555-0101', tetra: 'ISSI 20010' }, battery: 92, bodyTemp: 36.8, heartRate: 72, o2Level: 98 },
    { id: 2, name: 'Lt. Marco Rossi', callsign: 'HAWK-2', role: 'Operations Section Chief', unit: 'Operations', status: 'active', lat: 43.3201, lng: 0.7203, altitude: '285m', heading: 'SW', speed: 2.1, lastCheckin: '45 sec ago', checkinStatus: 'ok', comms: { radio: 'VHF Ch.4', phone: '+39 333 456 7890', satellite: 'Iridium 8816-555-0102', tetra: 'ISSI 20011' }, battery: 78, bodyTemp: 37.2, heartRate: 88, o2Level: 97 },
    { id: 3, name: 'Sgt. Yuki Tanaka', callsign: 'PHOENIX-3', role: 'Drone Pilot', unit: 'Air Ops', status: 'active', lat: 43.3145, lng: 0.7098, altitude: '310m', heading: 'N', speed: 0, lastCheckin: '1 min ago', checkinStatus: 'ok', comms: { radio: 'UHF Ch.12', phone: '+81 90 1234 5678', satellite: 'Starlink T-4422', tetra: 'ISSI 20012' }, battery: 65, bodyTemp: 36.6, heartRate: 68, o2Level: 99 },
    { id: 4, name: 'Cpl. Pierre Dubois', callsign: 'GROUND-4', role: 'Ground Team Lead', unit: 'Suppression', status: 'active', lat: 43.3189, lng: 0.7245, altitude: '250m', heading: 'E', speed: 4.5, lastCheckin: '30 sec ago', checkinStatus: 'ok', comms: { radio: 'VHF Ch.7', phone: '+33 7 65 43 21 09', satellite: null, tetra: 'ISSI 20013', p25: 'WACN 0x29' }, battery: 54, bodyTemp: 37.8, heartRate: 112, o2Level: 95 },
    { id: 5, name: 'Dr. Elena Vasquez', callsign: 'MEDIC-5', role: 'Medical Officer', unit: 'Medical', status: 'active', lat: 43.3155, lng: 0.7189, altitude: '290m', heading: 'S', speed: 0, lastCheckin: '3 min ago', checkinStatus: 'ok', comms: { radio: 'VHF Ch.4', phone: '+34 612 345 678', satellite: 'BGAN 870-776-1234', tetra: 'ISSI 20014' }, battery: 88, bodyTemp: 36.5, heartRate: 64, o2Level: 99 },
    { id: 6, name: 'Sgt. Ahmed Okafor', callsign: 'GROUND-6', role: 'Evacuation Coordinator', unit: 'Logistics', status: 'moving', lat: 43.3210, lng: 0.7300, altitude: '220m', heading: 'W', speed: 8.2, lastCheckin: '15 sec ago', checkinStatus: 'ok', comms: { radio: 'VHF Ch.9', phone: '+234 803 456 7890', satellite: 'Iridium 8816-555-0106', tetra: 'ISSI 20015', p25: 'WACN 0x29' }, battery: 41, bodyTemp: 37.4, heartRate: 98, o2Level: 96 },
    { id: 7, name: 'Lt. Anna Kowalski', callsign: 'WATCH-7', role: 'Safety Officer', unit: 'Safety', status: 'alert', lat: 43.3230, lng: 0.7150, altitude: '340m', heading: 'NW', speed: 0, lastCheckin: '8 min ago', checkinStatus: 'overdue', comms: { radio: 'VHF Ch.4', phone: '+48 512 345 678', satellite: 'Starlink T-4455', tetra: 'ISSI 20016' }, battery: 23, bodyTemp: 38.1, heartRate: 105, o2Level: 93 },
    { id: 8, name: 'Pvt. João Silva', callsign: 'GROUND-8', role: 'Firefighter', unit: 'Suppression', status: 'active', lat: 43.3175, lng: 0.7260, altitude: '245m', heading: 'SE', speed: 3.1, lastCheckin: '1 min ago', checkinStatus: 'ok', comms: { radio: 'VHF Ch.7', phone: '+55 11 98765 4321', satellite: null, tetra: 'ISSI 20017', p25: 'WACN 0x29' }, battery: 67, bodyTemp: 37.5, heartRate: 102, o2Level: 96 },
  ];

  // Communication channels
  const channels = [
    { id: 'cmd', name: 'COMMAND', type: 'radio', frequency: '155.250 MHz', band: 'VHF', mode: 'P25', encryption: 'AES-256', members: 5, active: true, priority: 'critical', protocol: 'p25', unread: 2 },
    { id: 'ops', name: 'OPERATIONS', type: 'radio', frequency: '156.800 MHz', band: 'VHF', mode: 'Analog FM', encryption: 'None', members: 8, active: true, priority: 'high', protocol: 'analog', unread: 0 },
    { id: 'tac1', name: 'TAC-1 Ground', type: 'radio', frequency: '453.500 MHz', band: 'UHF', mode: 'TETRA', encryption: 'TEA2', members: 4, active: true, priority: 'high', protocol: 'tetra', unread: 5 },
    { id: 'tac2', name: 'TAC-2 Air', type: 'radio', frequency: '460.125 MHz', band: 'UHF', mode: 'P25 Phase II', encryption: 'AES-256', members: 3, active: true, priority: 'normal', protocol: 'p25', unread: 1 },
    { id: 'air', name: 'AIR-OPS', type: 'radio', frequency: '122.925 MHz', band: 'VHF-AM', mode: 'AM', encryption: 'None', members: 3, active: true, priority: 'high', protocol: 'analog', unread: 0 },
    { id: 'med', name: 'MEDICAL', type: 'radio', frequency: '155.340 MHz', band: 'VHF', mode: 'P25', encryption: 'AES-256', members: 2, active: true, priority: 'critical', protocol: 'p25', unread: 0 },
    { id: 'sat_cmd', name: 'SAT-COMMAND', type: 'satellite', provider: 'Iridium', mode: 'Voice + Data', latency: '300ms', bandwidth: '2.4 kbps', members: 3, active: true, priority: 'critical', unread: 0 },
    { id: 'sat_data', name: 'SAT-DATA', type: 'satellite', provider: 'Starlink', mode: 'Broadband', latency: '25ms', bandwidth: '100 Mbps', members: 6, active: true, priority: 'normal', unread: 0 },
    { id: 'sat_bgan', name: 'SAT-BGAN', type: 'satellite', provider: 'Inmarsat BGAN', mode: 'Voice + IP', latency: '600ms', bandwidth: '492 kbps', members: 2, active: true, priority: 'high', unread: 0 },
    { id: 'voip1', name: 'VOIP-BRIDGE', type: 'voip', server: 'SIP Gateway', codec: 'Opus 48kHz', encryption: 'SRTP', members: 12, active: true, priority: 'normal', unread: 0 },
    { id: 'msg_ops', name: '#ops-general', type: 'messaging', members: 12, active: true, priority: 'normal', unread: 8 },
    { id: 'msg_alerts', name: '#alerts-critical', type: 'messaging', members: 12, active: true, priority: 'critical', unread: 3 },
  ];

  // Message history for selected channel
  const channelMessages = {
    'cmd': [
      { id: 1, from: 'EAGLE-1', time: '14:32:15', text: 'All units, fire spread confirmed sector 7. Wind shift NE 25km/h.', priority: 'critical', protocol: 'P25' },
      { id: 2, from: 'HAWK-2', time: '14:32:45', text: 'Copy EAGLE-1. Repositioning ground teams to ridgeline Alpha.', priority: 'normal', protocol: 'P25' },
      { id: 3, from: 'MEDIC-5', time: '14:33:02', text: 'Medical staging at rally point Bravo confirmed. 2 ambulances standby.', priority: 'normal', protocol: 'P25' },
      { id: 4, from: 'WATCH-7', time: '14:33:30', text: '⚠ SAFETY: Spot fire risk HIGH on eastern slope. All personnel maintain 300m buffer.', priority: 'critical', protocol: 'P25' },
      { id: 5, from: 'EAGLE-1', time: '14:34:01', text: 'Copy WATCH-7. All ground units acknowledge safety perimeter.', priority: 'critical', protocol: 'P25' },
    ],
    'tac1': [
      { id: 1, from: 'GROUND-4', time: '14:30:00', text: 'TETRA check — all ground units report.', priority: 'normal', protocol: 'TETRA' },
      { id: 2, from: 'GROUND-6', time: '14:30:12', text: 'GROUND-6 read you 5/5. Evac route Charlie clear.', priority: 'normal', protocol: 'TETRA' },
      { id: 3, from: 'GROUND-8', time: '14:30:18', text: 'GROUND-8 loud and clear. Holding position sector 4.', priority: 'normal', protocol: 'TETRA' },
      { id: 4, from: 'GROUND-4', time: '14:31:40', text: 'Be advised: smoke density increasing. Switch to SCBA if vis drops below 50m.', priority: 'high', protocol: 'TETRA' },
    ],
    'msg_alerts': [
      { id: 1, from: 'SYSTEM', time: '14:28:00', text: '[CAP ALERT] Fire Weather Watch issued — Region Occitanie. Extreme fire behavior expected. RH 12%, Wind gusts 45km/h.', priority: 'critical', protocol: 'CAP' },
      { id: 2, from: 'SYSTEM', time: '14:31:00', text: '[GEOFENCE] GROUND-6 exited Zone "Safe Perimeter Alpha" heading West at 8.2 km/h', priority: 'warning', protocol: 'GEO' },
      { id: 3, from: 'SYSTEM', time: '14:33:30', text: '[WELFARE] WATCH-7 check-in OVERDUE — last contact 8 min ago. Auto-escalation in 2 min.', priority: 'critical', protocol: 'WELFARE' },
    ],
  };

  // Rally points and evac routes
  const rallyPoints = [
    { id: 'rp_a', name: 'Rally Point Alpha', type: 'primary', lat: 43.3120, lng: 0.7100, capacity: 50, currentCount: 0, status: 'open' },
    { id: 'rp_b', name: 'Rally Point Bravo', type: 'medical', lat: 43.3100, lng: 0.7250, capacity: 30, currentCount: 2, status: 'open' },
    { id: 'rp_c', name: 'Rally Point Charlie', type: 'backup', lat: 43.3080, lng: 0.7050, capacity: 40, currentCount: 0, status: 'standby' },
  ];

  const evacRoutes = [
    { id: 'ev1', name: 'Route Echo-1 (North)', from: 'Sector 7', to: 'Rally Point Alpha', distance: '2.4 km', estTime: '18 min', status: 'clear', terrain: 'Road', hazards: [] },
    { id: 'ev2', name: 'Route Echo-2 (South)', from: 'Sector 4', to: 'Rally Point Bravo', distance: '1.8 km', estTime: '12 min', status: 'clear', terrain: 'Trail', hazards: ['Steep grade'] },
    { id: 'ev3', name: 'Route Echo-3 (West)', from: 'All Sectors', to: 'Rally Point Charlie', distance: '3.1 km', estTime: '25 min', status: 'blocked', terrain: 'Road', hazards: ['Smoke crossing', 'Fallen tree'] },
  ];

  // Geofence zones for personnel
  const geoAlerts = [
    { id: 1, person: 'GROUND-6', zone: 'Safe Perimeter Alpha', type: 'exit', time: '14:31:00', acknowledged: false },
    { id: 2, person: 'WATCH-7', zone: 'Command Post', type: 'exit', time: '14:25:00', acknowledged: true },
  ];

  // Dead man switch / welfare tracking
  const welfareConfig = { checkInterval: 5, escalateAfter: 10, autoAlert: true };
  const overduePersonnel = personnel.filter(p => p.checkinStatus === 'overdue');

  const filteredPersonnel = personnel.filter(p => {
    if (commsSearch && !p.name.toLowerCase().includes(commsSearch.toLowerCase()) && !p.callsign.toLowerCase().includes(commsSearch.toLowerCase())) return false;
    if (trackingFilter === 'overdue' && p.checkinStatus !== 'overdue') return false;
    if (trackingFilter === 'moving' && p.speed === 0) return false;
    if (trackingFilter !== 'all' && trackingFilter !== 'overdue' && trackingFilter !== 'moving' && p.unit.toLowerCase() !== trackingFilter) return false;
    return true;
  });

  const getStatusColor = (status) => {
    if (status === 'active') return 'bg-green-500';
    if (status === 'moving') return 'bg-blue-500';
    if (status === 'alert') return 'bg-red-500 animate-pulse';
    return 'bg-slate-500';
  };

  const getPriorityStyle = (p) => {
    if (p === 'critical') return 'border-l-red-500 bg-red-500/5';
    if (p === 'high') return 'border-l-orange-500 bg-orange-500/5';
    if (p === 'warning') return 'border-l-yellow-500 bg-yellow-500/5';
    return 'border-l-slate-600 bg-transparent';
  };

  const getProtocolBadge = (protocol) => {
    const styles = {
      'p25': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'tetra': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'analog': 'bg-slate-700/50 text-slate-300 border-slate-600',
      'P25': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'TETRA': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'CAP': 'bg-red-500/20 text-red-400 border-red-500/30',
      'GEO': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      'WELFARE': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    };
    return styles[protocol] || 'bg-slate-700/50 text-slate-400 border-slate-600';
  };

  const panels = [
    { id: 'channels', name: 'Channels', icon: Radio },
    { id: 'tracking', name: 'Personnel', icon: MapPin },
    { id: 'welfare', name: 'Welfare', icon: Shield },
    { id: 'evacuation', name: 'Evacuation', icon: Navigation },
  ];

  // Live mode: comms activate as real collaborators join and go to the field.
  if (isLive) {
    return (
      <LiveEmptyState
        icon={Radio}
        title="Comms are quiet"
        description="No simulated radio traffic here. Channels, personnel tracking, and welfare checks activate as your team grows and goes into the field."
        facts={[
          { label: 'Team members', value: liveMembers.length },
          { label: 'Field collaborators', value: liveMembers.filter(m => m.role === 'field').length },
        ]}
        hint="Connected to Supabase · live mode"
      />
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Top Bar — Panel selector + quick actions */}
      <div className="flex items-center justify-between gap-2 mb-2 flex-shrink-0">
        <div className="flex items-center gap-1">
          {panels.map(p => (
            <button key={p.id} onClick={() => setActivePanel(p.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activePanel === p.id ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-white'
              }`}>
              <p.icon className="w-3.5 h-3.5" />{p.name}
              {p.id === 'welfare' && overduePersonnel.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white rounded text-xs font-bold animate-pulse">{overduePersonnel.length}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowInviteModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-lg text-xs text-blue-400 hover:bg-blue-500/30 font-medium">
            <UserPlus className="w-3.5 h-3.5" />QUICK ADD
            {externalContacts.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 bg-blue-500 text-white rounded-full text-xs font-bold">{externalContacts.length}</span>
            )}
          </button>
          <button onClick={() => setShowBroadcast(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-lg text-xs text-red-400 hover:bg-red-500/30 font-medium">
            <Megaphone className="w-3.5 h-3.5" />BROADCAST
          </button>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/30 rounded text-xs text-green-400">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />{personnel.filter(p => p.status !== 'offline').length + externalContacts.length}/{personnel.length + externalContacts.length} online{externalContacts.filter(c => c.source === 'field-app').length > 0 ? ` · 📱${externalContacts.filter(c => c.source === 'field-app').length} field` : ''}
          </div>
        </div>
      </div>

      {/* ============= CHANNELS PANEL ============= */}
      {activePanel === 'channels' && (
        <div className="flex-1 flex gap-2 min-h-0">
          {/* Channel List */}
          <div className="w-64 flex-shrink-0 flex flex-col min-h-0 bg-slate-900/30 border border-slate-800 rounded-lg">
            <div className="p-2 border-b border-slate-800 flex-shrink-0">
              <div className="relative">
                <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                <input type="text" placeholder="Search channels..." value={commsSearch} onChange={e => setCommsSearch(e.target.value)}
                  className="w-full pl-6 pr-2 py-1.5 bg-slate-800/80 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:border-orange-500/50 focus:outline-none" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
              {/* Radio channels */}
              <p className="text-xs text-slate-600 uppercase tracking-wider px-2 py-1 font-medium">Radio</p>
              {channels.filter(c => c.type === 'radio').map(ch => (
                <button key={ch.id} onClick={() => setSelectedChannel(ch)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-all ${
                    selectedChannel?.id === ch.id ? 'bg-orange-500/15 border border-orange-500/30' : 'hover:bg-slate-800/60 border border-transparent'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Radio className="w-3 h-3 text-green-400 flex-shrink-0" />
                      <span className="text-white font-medium truncate">{ch.name}</span>
                    </div>
                    {ch.unread > 0 && <span className="px-1.5 py-0.5 bg-orange-500 text-white rounded-full text-xs font-bold flex-shrink-0">{ch.unread}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 pl-5">
                    <span className="text-slate-500">{ch.frequency}</span>
                    <span className={`px-1 py-0 rounded text-xs border ${getProtocolBadge(ch.protocol)}`}>{ch.mode}</span>
                  </div>
                </button>
              ))}

              {/* Satellite */}
              <p className="text-xs text-slate-600 uppercase tracking-wider px-2 py-1 mt-2 font-medium">Satellite</p>
              {channels.filter(c => c.type === 'satellite').map(ch => (
                <button key={ch.id} onClick={() => setSelectedChannel(ch)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-all ${
                    selectedChannel?.id === ch.id ? 'bg-orange-500/15 border border-orange-500/30' : 'hover:bg-slate-800/60 border border-transparent'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5"><Satellite className="w-3 h-3 text-cyan-400" /><span className="text-white font-medium">{ch.name}</span></div>
                    {ch.unread > 0 && <span className="px-1.5 py-0.5 bg-orange-500 text-white rounded-full text-xs font-bold">{ch.unread}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 pl-5">
                    <span className="text-slate-500">{ch.provider}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-500">{ch.latency}</span>
                  </div>
                </button>
              ))}

              {/* VoIP */}
              <p className="text-xs text-slate-600 uppercase tracking-wider px-2 py-1 mt-2 font-medium">VoIP</p>
              {channels.filter(c => c.type === 'voip').map(ch => (
                <button key={ch.id} onClick={() => setSelectedChannel(ch)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-all ${
                    selectedChannel?.id === ch.id ? 'bg-orange-500/15 border border-orange-500/30' : 'hover:bg-slate-800/60 border border-transparent'
                  }`}>
                  <div className="flex items-center gap-1.5"><Headphones className="w-3 h-3 text-purple-400" /><span className="text-white font-medium">{ch.name}</span></div>
                  <div className="pl-5 text-slate-500 mt-0.5">{ch.codec} • {ch.encryption}</div>
                </button>
              ))}

              {/* Messaging */}
              <p className="text-xs text-slate-600 uppercase tracking-wider px-2 py-1 mt-2 font-medium">Messaging</p>
              {channels.filter(c => c.type === 'messaging').map(ch => (
                <button key={ch.id} onClick={() => setSelectedChannel(ch)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-all ${
                    selectedChannel?.id === ch.id ? 'bg-orange-500/15 border border-orange-500/30' : 'hover:bg-slate-800/60 border border-transparent'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5"><Hash className="w-3 h-3 text-orange-400" /><span className="text-white font-medium">{ch.name}</span></div>
                    {ch.unread > 0 && <span className="px-1.5 py-0.5 bg-orange-500 text-white rounded-full text-xs font-bold">{ch.unread}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Channel Detail / Messages */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-900/30 border border-slate-800 rounded-lg">
            {selectedChannel ? (
              <>
                {/* Channel header */}
                <div className="flex items-center justify-between p-2.5 border-b border-slate-800 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      selectedChannel.type === 'radio' ? 'bg-green-500/20' : selectedChannel.type === 'satellite' ? 'bg-cyan-500/20' : selectedChannel.type === 'voip' ? 'bg-purple-500/20' : 'bg-orange-500/20'
                    }`}>
                      {selectedChannel.type === 'radio' ? <Radio className="w-4 h-4 text-green-400" /> :
                       selectedChannel.type === 'satellite' ? <Satellite className="w-4 h-4 text-cyan-400" /> :
                       selectedChannel.type === 'voip' ? <Headphones className="w-4 h-4 text-purple-400" /> :
                       <Hash className="w-4 h-4 text-orange-400" />}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-sm">{selectedChannel.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        {selectedChannel.frequency && <span>{selectedChannel.frequency} • {selectedChannel.band}</span>}
                        {selectedChannel.provider && <span>{selectedChannel.provider} • {selectedChannel.bandwidth}</span>}
                        {selectedChannel.codec && <span>{selectedChannel.codec}</span>}
                        <span>{selectedChannel.members} members</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedChannel.encryption && selectedChannel.encryption !== 'None' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs border border-green-500/30"><Lock className="w-3 h-3" />{selectedChannel.encryption}</span>
                    )}
                    {selectedChannel.protocol && (
                      <span className={`px-2 py-0.5 rounded text-xs border ${getProtocolBadge(selectedChannel.protocol)}`}>{selectedChannel.mode}</span>
                    )}
                    {/* PTT button for radio/voip */}
                    {(selectedChannel.type === 'radio' || selectedChannel.type === 'voip') && (
                      <button
                        onMouseDown={() => setPttActive(true)} onMouseUp={() => setPttActive(false)} onMouseLeave={() => setPttActive(false)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          pttActive ? 'bg-red-500 text-white scale-105 shadow-lg shadow-red-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}>
                        {pttActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                        {pttActive ? 'TX' : 'PTT'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Messages area */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                  {(channelMessages[selectedChannel.id] || []).map(msg => (
                    <div key={msg.id} className={`border-l-2 rounded-r-lg px-3 py-1.5 ${getPriorityStyle(msg.priority)}`}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-orange-400 font-mono font-bold text-xs">{msg.from}</span>
                        <span className="text-slate-600 text-xs">{msg.time}</span>
                        {msg.protocol && <span className={`px-1 py-0 rounded text-xs border ${getProtocolBadge(msg.protocol)}`}>{msg.protocol}</span>}
                        {msg.priority === 'critical' && <span className="px-1 py-0 bg-red-500/20 text-red-400 rounded text-xs border border-red-500/30">URGENT</span>}
                      </div>
                      <p className="text-slate-200 text-sm">{msg.text}</p>
                    </div>
                  ))}
                  {(!channelMessages[selectedChannel.id] || channelMessages[selectedChannel.id].length === 0) && (
                    <div className="flex-1 flex items-center justify-center h-full"><p className="text-slate-500 text-sm">No messages on this channel</p></div>
                  )}
                </div>

                {/* Input bar */}
                <div className="p-2 border-t border-slate-800 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <input type="text" value={messageInput} onChange={e => setMessageInput(e.target.value)} placeholder={`Message ${selectedChannel.name}...`}
                      className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-orange-500/50 focus:outline-none"
                      onKeyDown={e => { if (e.key === 'Enter' && messageInput.trim()) { setMessageInput(''); }}} />
                    <button className="p-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-white transition-colors"><Send className="w-4 h-4" /></button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Radio className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">Select a channel</p>
                  <p className="text-slate-600 text-xs">12 channels active across all bands</p>
                </div>
              </div>
            )}
          </div>

          {/* Right: Quick Contact / Radio Details */}
          <div className="w-56 flex-shrink-0 flex flex-col gap-2 overflow-y-auto">
            {/* Active on channel */}
            {selectedChannel && (
              <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-2">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">On Channel</p>
                <div className="space-y-1">
                  {personnel.slice(0, selectedChannel.members).map(p => (
                    <div key={p.id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-800/50 cursor-pointer" onClick={() => setSelectedPersonnel(p)}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor(p.status)}`} />
                      <div className="min-w-0">
                        <p className="text-xs text-white font-medium truncate">{p.callsign}</p>
                        <p className="text-xs text-slate-500 truncate">{p.role}</p>
                      </div>
                      {p.checkinStatus === 'overdue' && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 animate-pulse" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Radio details */}
            {selectedChannel && (selectedChannel.type === 'radio') && (
              <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-2">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">Radio Config</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Frequency</span><span className="text-green-400 font-mono">{selectedChannel.frequency}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Band</span><span className="text-white">{selectedChannel.band}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Mode</span><span className="text-white">{selectedChannel.mode}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Encryption</span><span className={selectedChannel.encryption !== 'None' ? 'text-green-400' : 'text-red-400'}>{selectedChannel.encryption}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Protocol</span><span className={`px-1 rounded border ${getProtocolBadge(selectedChannel.protocol)}`}>{selectedChannel.protocol.toUpperCase()}</span></div>
                </div>
              </div>
            )}

            {/* Satellite details */}
            {selectedChannel && selectedChannel.type === 'satellite' && (
              <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-2">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">Satellite Link</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Provider</span><span className="text-cyan-400">{selectedChannel.provider}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Mode</span><span className="text-white">{selectedChannel.mode}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Latency</span><span className="text-white">{selectedChannel.latency}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Bandwidth</span><span className="text-white">{selectedChannel.bandwidth}</span></div>
                </div>
              </div>
            )}

            {/* Quick direct contact */}
            <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-2">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">Quick Contact</p>
              <div className="space-y-1">
                {personnel.slice(0, 4).map(p => (
                  <div key={p.id} className="flex items-center justify-between px-1.5 py-1 rounded hover:bg-slate-800/50">
                    <span className="text-xs text-white font-mono">{p.callsign}</span>
                    <div className="flex items-center gap-1">
                      <button className="p-1 hover:bg-slate-700 rounded text-green-400" title={`Call ${p.comms.phone}`}><PhoneCall className="w-3 h-3" /></button>
                      <button className="p-1 hover:bg-slate-700 rounded text-cyan-400" title="Satellite"><Satellite className="w-3 h-3" /></button>
                      <button className="p-1 hover:bg-slate-700 rounded text-orange-400" title="Message"><MessageSquare className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============= PERSONNEL TRACKING PANEL ============= */}
      {activePanel === 'tracking' && (
        <div className="flex-1 flex gap-2 min-h-0">
          {/* Personnel list */}
          <div className="w-72 flex-shrink-0 flex flex-col min-h-0 bg-slate-900/30 border border-slate-800 rounded-lg">
            <div className="p-2 border-b border-slate-800 flex-shrink-0 space-y-1.5">
              <div className="relative">
                <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                <input type="text" placeholder="Search personnel..." value={commsSearch} onChange={e => setCommsSearch(e.target.value)}
                  className="w-full pl-6 pr-2 py-1.5 bg-slate-800/80 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:border-orange-500/50 focus:outline-none" />
              </div>
              <div className="flex flex-wrap gap-1">
                {['all', 'overdue', 'moving', 'command', 'operations', 'suppression'].map(f => (
                  <button key={f} onClick={() => setTrackingFilter(f)}
                    className={`px-1.5 py-0.5 rounded text-xs transition-all ${
                      trackingFilter === f
                        ? f === 'overdue' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                        : 'bg-slate-800/60 text-slate-500 border border-slate-700/50 hover:text-slate-300'
                    }`}>
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
              {filteredPersonnel.map(p => (
                <button key={p.id} onClick={() => setSelectedPersonnel(p)}
                  className={`w-full text-left p-2 rounded-lg transition-all ${
                    selectedPersonnel?.id === p.id ? 'bg-orange-500/15 border border-orange-500/30' : p.checkinStatus === 'overdue' ? 'bg-red-500/10 border border-red-500/30 animate-pulse' : 'hover:bg-slate-800/60 border border-transparent'
                  }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getStatusColor(p.status)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white font-medium text-xs truncate">{p.callsign}</span>
                        <span className="text-slate-600 text-xs">•</span>
                        <span className="text-slate-400 text-xs truncate">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500">{p.role}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      {p.checkinStatus === 'overdue' && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                      <span className="text-xs text-slate-600">{p.lastCheckin}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Map / Location View */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-900/30 border border-slate-800 rounded-lg overflow-hidden">
            {/* Mini tactical map placeholder */}
            <div className="flex-1 relative bg-slate-900" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(100,116,139,0.15) 1px, transparent 0)', backgroundSize: '20px 20px' }}>
              {/* Personnel markers on map */}
              {personnel.map(p => {
                const x = ((p.lng - 0.705) / 0.03) * 100;
                const y = ((43.325 - p.lat) / 0.015) * 100;
                return (
                  <div key={p.id} onClick={() => setSelectedPersonnel(p)}
                    className={`absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 transition-all ${selectedPersonnel?.id === p.id ? 'z-20 scale-125' : 'z-10 hover:scale-110'}`}
                    style={{ left: `${Math.max(5, Math.min(95, x))}%`, top: `${Math.max(5, Math.min(95, y))}%` }}>
                    <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold text-white ${
                      p.checkinStatus === 'overdue' ? 'bg-red-500 border-red-300 animate-pulse' : p.speed > 0 ? 'bg-blue-500 border-blue-300' : 'bg-green-500 border-green-300'
                    } ${selectedPersonnel?.id === p.id ? 'ring-2 ring-orange-400 ring-offset-2 ring-offset-slate-900' : ''}`}>
                      {p.callsign.split('-')[1] || p.callsign.charAt(0)}
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 whitespace-nowrap">
                      <span className="text-xs font-mono text-white bg-slate-900/90 px-1 rounded">{p.callsign}</span>
                    </div>
                    {p.speed > 0 && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full flex items-center justify-center">
                        <Navigation className="w-2 h-2 text-white" style={{ transform: `rotate(${p.heading === 'N' ? 0 : p.heading === 'NE' ? 45 : p.heading === 'E' ? 90 : p.heading === 'SE' ? 135 : p.heading === 'S' ? 180 : p.heading === 'SW' ? 225 : p.heading === 'W' ? 270 : 315}deg)` }} />
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Rally points */}
              {rallyPoints.map(rp => {
                const x = ((rp.lng - 0.705) / 0.03) * 100;
                const y = ((43.325 - rp.lat) / 0.015) * 100;
                return (
                  <div key={rp.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 z-5"
                    style={{ left: `${Math.max(5, Math.min(95, x))}%`, top: `${Math.max(5, Math.min(95, y))}%` }}>
                    <div className={`w-6 h-6 rounded border-2 border-dashed flex items-center justify-center ${
                      rp.type === 'primary' ? 'border-yellow-400 bg-yellow-500/20' : rp.type === 'medical' ? 'border-red-400 bg-red-500/20' : 'border-slate-400 bg-slate-500/20'
                    }`}>
                      <Flag className={`w-3 h-3 ${rp.type === 'primary' ? 'text-yellow-400' : rp.type === 'medical' ? 'text-red-400' : 'text-slate-400'}`} />
                    </div>
                    <span className="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 text-xs text-slate-500 whitespace-nowrap">{rp.name.replace('Rally Point ', 'RP ')}</span>
                  </div>
                );
              })}
              {/* Map legend */}
              <div className="absolute bottom-2 left-2 bg-slate-900/90 border border-slate-700 rounded-lg p-2 text-xs space-y-1">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500 border border-green-300" /><span className="text-slate-400">Stationary</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500 border border-blue-300" /><span className="text-slate-400">Moving</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 border border-red-300" /><span className="text-slate-400">Overdue</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded border-2 border-dashed border-yellow-400" /><span className="text-slate-400">Rally Point</span></div>
              </div>
            </div>
          </div>

          {/* Personnel Detail */}
          <div className="w-64 flex-shrink-0 flex flex-col gap-2 overflow-y-auto">
            {selectedPersonnel ? (
              <>
                {/* Identity */}
                <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-2.5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white ${getStatusColor(selectedPersonnel.status)}`}>
                      {selectedPersonnel.callsign.split('-')[1] || '?'}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-sm">{selectedPersonnel.callsign}</h3>
                      <p className="text-xs text-slate-400">{selectedPersonnel.name}</p>
                      <p className="text-xs text-slate-500">{selectedPersonnel.role} • {selectedPersonnel.unit}</p>
                    </div>
                  </div>
                  {selectedPersonnel.checkinStatus === 'overdue' && (
                    <div className="p-1.5 bg-red-500/20 border border-red-500/30 rounded text-xs text-red-400 font-medium flex items-center gap-1.5 animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5" />CHECK-IN OVERDUE — Last: {selectedPersonnel.lastCheckin}
                    </div>
                  )}
                </div>

                {/* Location */}
                <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-2">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">Location</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">GPS</span><span className="text-white font-mono">{selectedPersonnel.lat.toFixed(4)}°N, {selectedPersonnel.lng.toFixed(4)}°E</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Altitude</span><span className="text-white">{selectedPersonnel.altitude}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Heading</span><span className="text-white">{selectedPersonnel.heading}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Speed</span><span className={selectedPersonnel.speed > 0 ? 'text-blue-400' : 'text-slate-400'}>{selectedPersonnel.speed} km/h</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Last Check-in</span><span className={selectedPersonnel.checkinStatus === 'overdue' ? 'text-red-400 font-bold' : 'text-green-400'}>{selectedPersonnel.lastCheckin}</span></div>
                  </div>
                </div>

                {/* Vitals */}
                <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-2">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">Vitals</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="bg-slate-800/50 rounded p-1.5 text-center">
                      <p className="text-xs text-slate-500">Heart</p>
                      <p className={`text-sm font-bold ${selectedPersonnel.heartRate > 100 ? 'text-orange-400' : 'text-green-400'}`}>{selectedPersonnel.heartRate} <span className="text-xs font-normal">bpm</span></p>
                    </div>
                    <div className="bg-slate-800/50 rounded p-1.5 text-center">
                      <p className="text-xs text-slate-500">SpO₂</p>
                      <p className={`text-sm font-bold ${selectedPersonnel.o2Level < 95 ? 'text-red-400' : 'text-green-400'}`}>{selectedPersonnel.o2Level}%</p>
                    </div>
                    <div className="bg-slate-800/50 rounded p-1.5 text-center">
                      <p className="text-xs text-slate-500">Temp</p>
                      <p className={`text-sm font-bold ${selectedPersonnel.bodyTemp > 37.5 ? 'text-orange-400' : 'text-green-400'}`}>{selectedPersonnel.bodyTemp}°C</p>
                    </div>
                    <div className="bg-slate-800/50 rounded p-1.5 text-center">
                      <p className="text-xs text-slate-500">Battery</p>
                      <p className={`text-sm font-bold ${selectedPersonnel.battery < 30 ? 'text-red-400' : selectedPersonnel.battery < 60 ? 'text-yellow-400' : 'text-green-400'}`}>{selectedPersonnel.battery}%</p>
                    </div>
                  </div>
                </div>

                {/* Comms channels */}
                <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-2">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">Comms</p>
                  <div className="space-y-1 text-xs">
                    {selectedPersonnel.comms.radio && <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><Radio className="w-3 h-3 text-green-400" /><span className="text-slate-400">Radio</span></span><span className="text-white">{selectedPersonnel.comms.radio}</span></div>}
                    {selectedPersonnel.comms.phone && <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-blue-400" /><span className="text-slate-400">Phone</span></span><span className="text-white font-mono text-xs">{selectedPersonnel.comms.phone}</span></div>}
                    {selectedPersonnel.comms.satellite && <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><Satellite className="w-3 h-3 text-cyan-400" /><span className="text-slate-400">Sat</span></span><span className="text-white text-xs">{selectedPersonnel.comms.satellite}</span></div>}
                    {selectedPersonnel.comms.tetra && <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><Shield className="w-3 h-3 text-purple-400" /><span className="text-slate-400">TETRA</span></span><span className="text-white font-mono">{selectedPersonnel.comms.tetra}</span></div>}
                    {selectedPersonnel.comms.p25 && <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><Lock className="w-3 h-3 text-blue-400" /><span className="text-slate-400">P25</span></span><span className="text-white font-mono">{selectedPersonnel.comms.p25}</span></div>}
                  </div>
                  <div className="flex gap-1 mt-2">
                    <button className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-green-500/20 border border-green-500/30 rounded text-green-400 text-xs hover:bg-green-500/30"><PhoneCall className="w-3 h-3" />Call</button>
                    <button className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-orange-500/20 border border-orange-500/30 rounded text-orange-400 text-xs hover:bg-orange-500/30"><MessageSquare className="w-3 h-3" />Msg</button>
                    <button className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-400 text-xs hover:bg-cyan-500/30"><Satellite className="w-3 h-3" />Sat</button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-slate-900/30 border border-slate-800 rounded-lg">
                <div className="text-center"><User className="w-8 h-8 text-slate-600 mx-auto mb-1" /><p className="text-slate-500 text-xs">Select personnel</p></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============= WELFARE PANEL ============= */}
      {activePanel === 'welfare' && (
        <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto">
          {/* Welfare Status Overview */}
          <div className="grid grid-cols-4 gap-2 flex-shrink-0">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-400">{personnel.filter(p => p.checkinStatus === 'ok').length}</p>
              <p className="text-xs text-green-400/70">Checked In</p>
            </div>
            <div className={`border rounded-lg p-3 text-center ${overduePersonnel.length > 0 ? 'bg-red-500/10 border-red-500/30 animate-pulse' : 'bg-slate-800/30 border-slate-700'}`}>
              <p className={`text-2xl font-bold ${overduePersonnel.length > 0 ? 'text-red-400' : 'text-slate-500'}`}>{overduePersonnel.length}</p>
              <p className={`text-xs ${overduePersonnel.length > 0 ? 'text-red-400/70' : 'text-slate-500'}`}>Overdue</p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-400">{personnel.filter(p => p.speed > 0).length}</p>
              <p className="text-xs text-blue-400/70">Moving</p>
            </div>
            <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-white">{welfareConfig.checkInterval} min</p>
              <p className="text-xs text-slate-500">Check Interval</p>
            </div>
          </div>

          {/* Overdue alerts */}
          {overduePersonnel.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex-shrink-0">
              <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-5 h-5 text-red-400" /><h3 className="text-red-400 font-bold text-sm">OVERDUE CHECK-INS</h3></div>
              {overduePersonnel.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-red-500/10 rounded-lg p-2 mb-1">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center text-white font-bold text-xs">{p.callsign.split('-')[1]}</div>
                    <div>
                      <p className="text-white font-medium text-sm">{p.callsign} — {p.name}</p>
                      <p className="text-xs text-red-400">Last seen: {p.lastCheckin} • Battery: {p.battery}% • GPS: {p.lat.toFixed(4)}°N</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button className="px-2 py-1 bg-green-500/20 border border-green-500/30 rounded text-xs text-green-400 hover:bg-green-500/30">📻 Hail</button>
                    <button className="px-2 py-1 bg-orange-500/20 border border-orange-500/30 rounded text-xs text-orange-400 hover:bg-orange-500/30">📍 Locate</button>
                    <button className="px-2 py-1 bg-red-500/20 border border-red-500/30 rounded text-xs text-red-400 hover:bg-red-500/30">🚨 Escalate</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Personnel welfare grid */}
          <div className="bg-slate-900/30 border border-slate-800 rounded-lg overflow-hidden flex-shrink-0">
            <table className="w-full text-xs">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">Personnel</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">Status</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">Last Check-in</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">Heart</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">SpO₂</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">Temp</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">Battery</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {personnel.map(p => (
                  <tr key={p.id} className={`${p.checkinStatus === 'overdue' ? 'bg-red-500/5' : 'hover:bg-slate-800/30'}`}>
                    <td className="px-3 py-2"><div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${getStatusColor(p.status)}`} /><span className="text-orange-400 font-mono font-medium">{p.callsign}</span><span className="text-slate-400">{p.name.split(' ').pop()}</span></div></td>
                    <td className="px-3 py-2"><span className={p.checkinStatus === 'overdue' ? 'text-red-400 font-bold' : 'text-green-400'}>{p.checkinStatus === 'overdue' ? '⚠ OVERDUE' : '✓ OK'}</span></td>
                    <td className="px-3 py-2 text-slate-300">{p.lastCheckin}</td>
                    <td className="px-3 py-2"><span className={p.heartRate > 100 ? 'text-orange-400' : 'text-green-400'}>{p.heartRate} bpm</span></td>
                    <td className="px-3 py-2"><span className={p.o2Level < 95 ? 'text-red-400' : 'text-green-400'}>{p.o2Level}%</span></td>
                    <td className="px-3 py-2"><span className={p.bodyTemp > 37.5 ? 'text-orange-400' : 'text-green-400'}>{p.bodyTemp}°C</span></td>
                    <td className="px-3 py-2"><span className={p.battery < 30 ? 'text-red-400' : p.battery < 60 ? 'text-yellow-400' : 'text-green-400'}>{p.battery}%</span></td>
                    <td className="px-3 py-2 text-slate-400 font-mono">{p.lat.toFixed(3)}°N</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Geofence Alerts */}
          <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-3 flex-shrink-0">
            <h3 className="text-white font-medium text-sm mb-2 flex items-center gap-2"><Target className="w-4 h-4 text-cyan-400" />Geofence Alerts</h3>
            {geoAlerts.length > 0 ? (
              <div className="space-y-1">
                {geoAlerts.map(g => (
                  <div key={g.id} className={`flex items-center justify-between p-2 rounded-lg text-xs ${g.acknowledged ? 'bg-slate-800/30' : 'bg-cyan-500/10 border border-cyan-500/30'}`}>
                    <div className="flex items-center gap-2">
                      <Target className={`w-3.5 h-3.5 ${g.acknowledged ? 'text-slate-500' : 'text-cyan-400'}`} />
                      <span className="text-white font-medium">{g.person}</span>
                      <span className={`${g.type === 'exit' ? 'text-orange-400' : 'text-cyan-400'}`}>{g.type === 'exit' ? 'LEFT' : 'ENTERED'}</span>
                      <span className="text-slate-400">"{g.zone}"</span>
                      <span className="text-slate-600">{g.time}</span>
                    </div>
                    {!g.acknowledged && <button className="px-2 py-0.5 bg-slate-700 rounded text-slate-300 hover:bg-slate-600">ACK</button>}
                  </div>
                ))}
              </div>
            ) : (<p className="text-slate-500 text-xs">No active geofence alerts</p>)}
          </div>
        </div>
      )}

      {/* ============= EVACUATION PANEL ============= */}
      {activePanel === 'evacuation' && (
        <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto">
          {/* Evac status bar */}
          <div className="flex items-center justify-between bg-slate-900/30 border border-slate-800 rounded-lg p-3 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2"><Flag className="w-5 h-5 text-yellow-400" /><span className="text-white font-medium text-sm">Rally Points: {rallyPoints.length}</span></div>
              <div className="flex items-center gap-2"><Navigation className="w-5 h-5 text-blue-400" /><span className="text-white font-medium text-sm">Routes: {evacRoutes.length}</span></div>
              <div className="flex items-center gap-2"><Users className="w-5 h-5 text-green-400" /><span className="text-white font-medium text-sm">Personnel: {personnel.length} tracked</span></div>
            </div>
            <button onClick={() => setShowEvacModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-white text-sm font-bold transition-colors">
              <AlertTriangle className="w-4 h-4" />INITIATE EVACUATION
            </button>
          </div>

          {/* Rally Points */}
          <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-3 flex-shrink-0">
            <h3 className="text-white font-medium text-sm mb-2 flex items-center gap-2"><Flag className="w-4 h-4 text-yellow-400" />Rally Points</h3>
            <div className="grid grid-cols-3 gap-2">
              {rallyPoints.map(rp => (
                <div key={rp.id} className={`border rounded-lg p-3 ${
                  rp.type === 'primary' ? 'border-yellow-500/30 bg-yellow-500/5' : rp.type === 'medical' ? 'border-red-500/30 bg-red-500/5' : 'border-slate-700 bg-slate-800/30'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-medium text-sm">{rp.name}</h4>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      rp.status === 'open' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'
                    }`}>{rp.status.toUpperCase()}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="text-white capitalize">{rp.type}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Capacity</span><span className="text-white">{rp.currentCount}/{rp.capacity}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">GPS</span><span className="text-white font-mono">{rp.lat.toFixed(4)}°N</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Evacuation Routes */}
          <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-3 flex-shrink-0">
            <h3 className="text-white font-medium text-sm mb-2 flex items-center gap-2"><Navigation className="w-4 h-4 text-blue-400" />Evacuation Routes</h3>
            <div className="space-y-2">
              {evacRoutes.map(er => (
                <div key={er.id} className={`border rounded-lg p-3 ${
                  er.status === 'clear' ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-white font-medium text-sm">{er.name}</h4>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      er.status === 'clear' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>{er.status.toUpperCase()}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-3 text-xs">
                    <div><span className="text-slate-500">From:</span> <span className="text-white">{er.from}</span></div>
                    <div><span className="text-slate-500">To:</span> <span className="text-white">{er.to}</span></div>
                    <div><span className="text-slate-500">Distance:</span> <span className="text-white">{er.distance}</span></div>
                    <div><span className="text-slate-500">ETA:</span> <span className="text-white">{er.estTime}</span></div>
                    <div><span className="text-slate-500">Terrain:</span> <span className="text-white">{er.terrain}</span></div>
                  </div>
                  {er.hazards.length > 0 && (
                    <div className="flex items-center gap-2 mt-1.5"><AlertTriangle className="w-3 h-3 text-yellow-400" /><span className="text-xs text-yellow-400">Hazards: {er.hazards.join(', ')}</span></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============= BROADCAST MODAL ============= */}
      {showBroadcast && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-2"><Megaphone className="w-5 h-5 text-red-400" /><h3 className="text-white font-bold">Emergency Broadcast</h3></div>
              <button onClick={() => setShowBroadcast(false)} className="p-1 hover:bg-slate-800 rounded"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Priority */}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Priority Level</label>
                <div className="flex gap-2">
                  {['normal', 'high', 'critical'].map(p => (
                    <button key={p} onClick={() => setBroadcastPriority(p)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                        broadcastPriority === p
                          ? p === 'critical' ? 'bg-red-500/20 border-red-500 text-red-400' : p === 'high' ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-slate-700 border-slate-500 text-white'
                          : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:text-white'
                      }`}>
                      {p.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              {/* Protocol */}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Broadcast Protocol</label>
                <div className="flex gap-2">
                  {[{id:'cap',label:'CAP',desc:'Common Alerting Protocol'},{id:'nims',label:'NIMS/ICS',desc:'National Incident Mgmt'},{id:'p25',label:'P25 All-Call',desc:'All P25 talkgroups'}].map(pr => (
                    <button key={pr.id} onClick={() => setBroadcastProtocol(pr.id)}
                      className={`flex-1 py-2 px-2 rounded-lg text-xs border transition-all text-center ${
                        broadcastProtocol === pr.id ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:text-white'
                      }`}>
                      <p className="font-bold">{pr.label}</p>
                      <p className="text-xs opacity-60">{pr.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              {/* Target */}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Target Channels</label>
                <div className="flex flex-wrap gap-1">
                  {channels.filter(c => c.type === 'radio' || c.type === 'satellite').map(ch => (
                    <span key={ch.id} className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white">{ch.name}</span>
                  ))}
                </div>
              </div>
              {/* Message */}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Broadcast Message</label>
                <textarea rows={4} value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="Enter emergency broadcast message..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-orange-500/50 focus:outline-none resize-none" />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between flex-shrink-0">
              <p className="text-xs text-slate-500">Sends to {channels.filter(c => c.type === 'radio' || c.type === 'satellite').length} channels • {personnel.length} personnel</p>
              <div className="flex gap-2">
                <button onClick={() => setShowBroadcast(false)} className="px-4 py-2 bg-slate-800 rounded-lg text-sm text-slate-300 hover:bg-slate-700">Cancel</button>
                <button onClick={() => { alert('Broadcast sent to all channels'); setShowBroadcast(false); setBroadcastMsg(''); }}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm text-white font-bold flex items-center gap-1.5"><Megaphone className="w-4 h-4" />SEND BROADCAST</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============= COLLABORATOR FIELD APP PREVIEW ============= */}
      {showCollaboratorPreview && (
        <CollaboratorPreviewFrame
          onClose={() => setShowCollaboratorPreview(false)}
          onJoinOperation={(userData) => {
            // When field user completes onboarding, add them as external contact
            const collabData = {
              id: Date.now(),
              name: userData.name,
              role: userData.role,
              phone: 'via Field App',
              email: '',
              location: 'GPS Active',
              locatorId: `FLD-${Math.random().toString(36).substring(2,6).toUpperCase()}`,
              addedAt: userData.joinedAt || new Date().toLocaleTimeString(),
              status: 'active',
              source: 'field-app',
              lat: (43.21 + (Math.random() - 0.5) * 0.02).toFixed(4),
              lng: (2.35 + (Math.random() - 0.5) * 0.02).toFixed(4),
              lastStatus: 'ok',
              hasFieldApp: true,
            };
            setExternalContacts(prev => [...prev, collabData]);
            // Broadcast to tactical map
            window.dispatchEvent(new CustomEvent('watchtower-collaborator-join', { detail: collabData }));
          }}
          onStatusUpdate={(statusId) => {
            // Update the most recent field-app contact's status
            setExternalContacts(prev => {
              const fieldContacts = prev.filter(c => c.source === 'field-app');
              if (fieldContacts.length === 0) return prev;
              const latest = fieldContacts[fieldContacts.length - 1];
              window.dispatchEvent(new CustomEvent('watchtower-collaborator-status', { detail: { id: latest.id, status: statusId } }));
              return prev.map(c => c.id === latest.id ? { ...c, lastStatus: statusId } : c);
            });
          }}
          onReportSubmit={(report) => {
            // Broadcast field report to tactical map
            const reportData = {
              ...report,
              id: Date.now(),
              priority: ['fire', 'chemical', 'armed', 'emergency', 'radioactive'].includes(report.type) ? 'critical' : ['injured', 'accident', 'hazard'].includes(report.type) ? 'high' : 'normal',
              status: 'new',
              acknowledged: false,
            };
            window.dispatchEvent(new CustomEvent('watchtower-field-report', { detail: reportData }));
          }}
          onMessageSend={(msg) => {
            // Log comms from field app
            console.log('[Field App Comms]', msg.channel, msg.text, msg.time);
          }}
        />
      )}

      {/* ============= QUICK ADD EXTERNAL CONTACT MODAL ============= */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-blue-400" /><h3 className="text-white font-bold">Quick Add External Contact</h3></div>
              <button onClick={() => setShowInviteModal(false)} className="p-1 hover:bg-slate-800 rounded"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* Send Invite Link */}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Send Invite Link</label>
                <p className="text-[10px] text-slate-500 mb-2">They tap the link, fill in their info — it feeds into your portal.</p>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono truncate">
                    {inviteLink || 'Click Generate to create a link...'}
                  </div>
                  <button onClick={() => { setInviteLink(`https://watchtower.app/join/${Math.random().toString(36).substring(2,8).toUpperCase()}`); setInviteLinkCopied(false); }}
                    className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold flex-shrink-0">Generate</button>
                </div>
                {inviteLink && (
                  <div className="space-y-1.5">
                    {/* Share method buttons */}
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => { setInviteLinkCopied(true); setTimeout(() => setInviteLinkCopied(false), 2000); }}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-all ${inviteLinkCopied ? 'bg-green-500/20 border border-green-500/40 text-green-400' : 'bg-slate-800 border border-slate-700 text-white hover:bg-slate-700'}`}>
                        {inviteLinkCopied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{inviteLinkCopied ? 'Copied' : 'Copy'}
                      </button>
                      {[
                        { id: 'email', icon: Mail, label: 'Email', activeClass: 'bg-orange-500/20 border border-orange-500/40 text-orange-400', defaultClass: 'bg-slate-800 border border-slate-700 text-orange-400 hover:bg-slate-700' },
                        { id: 'sms', icon: MessageSquare, label: 'SMS', activeClass: 'bg-green-500/20 border border-green-500/40 text-green-400', defaultClass: 'bg-slate-800 border border-slate-700 text-green-400 hover:bg-slate-700' },
                        { id: 'whatsapp', icon: Send, label: 'WhatsApp', activeClass: 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400', defaultClass: 'bg-slate-800 border border-slate-700 text-emerald-400 hover:bg-slate-700' },
                      ].map(m => (
                        <button key={m.id} onClick={() => { setActiveShareMethod(activeShareMethod === m.id ? null : m.id); setShareRecipient(''); setShareSent(null); }}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-all ${
                            activeShareMethod === m.id ? m.activeClass : m.defaultClass
                          }`}>
                          <m.icon className="w-3 h-3" />{m.label}
                        </button>
                      ))}
                      <button onClick={() => alert(`QR Code: ${inviteLink}`)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-purple-400 hover:bg-slate-700"><Grid className="w-3 h-3" />QR</button>
                    </div>

                    {/* Inline input for selected method */}
                    {activeShareMethod && (
                      <div className="flex items-center gap-2 p-2 bg-slate-800/80 border border-slate-700 rounded-lg">
                        {activeShareMethod === 'email' && <Mail className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />}
                        {activeShareMethod === 'sms' && <MessageSquare className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
                        {activeShareMethod === 'whatsapp' && <Send className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                        <input
                          type={activeShareMethod === 'email' ? 'email' : 'tel'}
                          value={shareRecipient}
                          onChange={e => { setShareRecipient(e.target.value); setShareSent(null); }}
                          placeholder={activeShareMethod === 'email' ? 'name@example.com' : '+33 6 XX XX XX XX'}
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter' && shareRecipient.trim()) {
                              setShareSent(activeShareMethod);
                              setTimeout(() => setShareSent(null), 3000);
                            }
                          }}
                          className="flex-1 bg-transparent border-none text-xs text-white placeholder-slate-500 focus:outline-none"
                        />
                        {shareSent === activeShareMethod ? (
                          <span className="flex items-center gap-1 text-green-400 text-xs font-medium flex-shrink-0"><CheckCircle className="w-3 h-3" />Sent!</span>
                        ) : (
                          <button
                            onClick={() => {
                              if (shareRecipient.trim()) {
                                setShareSent(activeShareMethod);
                                setTimeout(() => setShareSent(null), 3000);
                              }
                            }}
                            disabled={!shareRecipient.trim()}
                            className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 flex-shrink-0 ${
                              shareRecipient.trim() ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                            }`}>
                            <Send className="w-3 h-3" />Send
                          </button>
                        )}
                        <button onClick={() => setActiveShareMethod(null)} className="p-0.5 hover:bg-slate-700 rounded text-slate-500 flex-shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Preview Field App — opens phone mockup */}
              {inviteLink && (
                <button
                  onClick={() => { setShowInviteModal(false); setShowCollaboratorPreview(true); }}
                  className="w-full py-3 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-2 border-blue-500/40 rounded-xl text-sm font-bold text-blue-400 hover:from-blue-500/30 hover:to-purple-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <span className="text-lg">📱</span>
                  Preview Field App Experience
                  <span className="text-[10px] px-2 py-0.5 bg-blue-500/30 rounded text-blue-300 font-bold">LIVE</span>
                </button>
              )}

              {/* What recipient submits */}
              {inviteLink && (
                <div className="p-2.5 bg-slate-800/50 border border-dashed border-slate-700 rounded-lg">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5 font-medium">Recipient submits:</p>
                  <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><User className="w-2.5 h-2.5 text-blue-400" />Name & Role</span>
                    <span className="flex items-center gap-1"><Phone className="w-2.5 h-2.5 text-green-400" />Phone</span>
                    <span className="flex items-center gap-1"><Mail className="w-2.5 h-2.5 text-orange-400" />Email</span>
                    <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5 text-red-400" />GPS (auto)</span>
                    <span className="flex items-center gap-1"><Radio className="w-2.5 h-2.5 text-purple-400" />Radio</span>
                    <span className="flex items-center gap-1"><Navigation className="w-2.5 h-2.5 text-cyan-400" />Locator ID</span>
                  </div>
                </div>
              )}

              {/* Manual Add */}
              <div>
                <button onClick={() => setShowContactForm(!showContactForm)} className="flex items-center justify-between w-full mb-2">
                  <label className="text-xs text-slate-400 flex items-center gap-1.5 cursor-pointer"><Edit className="w-3.5 h-3.5 text-orange-400" />Manual Add</label>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${showContactForm ? 'rotate-180' : ''}`} />
                </button>
                {showContactForm && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'name', label: 'Name *', placeholder: 'Chief Martin Dupont' },
                        { key: 'role', label: 'Role / Org', placeholder: 'Forestry Service' },
                        { key: 'phone', label: 'Phone *', placeholder: '+33 6 XX XX XX XX', type: 'tel' },
                        { key: 'email', label: 'Email', placeholder: 'contact@example.com', type: 'email' },
                        { key: 'location', label: 'Location', placeholder: 'Mairie de Lézignan' },
                        { key: 'locatorId', label: 'Locator / GPS', placeholder: '43.31, 0.71 or PLB ID' },
                      ].map(f => (
                        <div key={f.key}>
                          <label className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5 block">{f.label}</label>
                          <input type={f.type || 'text'} value={newContact[f.key]} onChange={e => setNewContact({...newContact, [f.key]: e.target.value})}
                            placeholder={f.placeholder}
                            className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none" />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          if (newContact.name && newContact.phone) {
                            setExternalContacts(prev => [...prev, { ...newContact, id: Date.now(), addedAt: new Date().toLocaleTimeString(), status: 'active', source: 'manual' }]);
                            setNewContact({ name: '', phone: '', email: '', role: '', location: '', lat: '', lng: '', locatorId: '' });
                          }
                        }}
                        disabled={!newContact.name || !newContact.phone}
                        className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 ${newContact.name && newContact.phone ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
                        <UserPlus className="w-3 h-3" />Add
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Simulate incoming */}
              <button
                onClick={() => {
                  const sim = [
                    { name: 'Capt. René Moreau', role: 'Municipal Fire Chief', loc: 'Caserne Lézignan' },
                    { name: 'Maria Torres', role: 'Red Cross Liaison', loc: 'Poste Secours Nord' },
                    { name: 'Dir. Jean-Luc Petit', role: 'Prefect Office', loc: 'Prefecture Aude' },
                    { name: 'Off. Nadia Benzema', role: 'Gendarmerie', loc: 'Brigade Narbonne' },
                    { name: "Pilot Chris O'Brien", role: 'Aerial Support', loc: 'Helipad Echo' },
                  ][externalContacts.filter(c => c.source === 'invite').length % 5];
                  setExternalContacts(prev => [...prev, {
                    id: Date.now(), name: sim.name, role: sim.role,
                    phone: `+33 ${Math.floor(600000000 + Math.random() * 100000000)}`,
                    email: sim.name.split(' ').pop().toLowerCase().replace("'","") + '@gouv.fr',
                    location: sim.loc, locatorId: `PLB-${Math.random().toString(36).substring(2,6).toUpperCase()}`,
                    addedAt: new Date().toLocaleTimeString(), status: 'active', source: 'invite'
                  }]);
                }}
                className="w-full py-2 bg-slate-800/50 border border-dashed border-slate-700 rounded-lg text-xs text-blue-400 hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-all"
              ><Zap className="w-3 h-3" />Simulate Incoming Response</button>

              {/* Contacts list */}
              {externalContacts.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-green-400" />External Contacts
                      <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-bold">{externalContacts.length}</span>
                    </label>
                    <span className="text-[10px] text-slate-500">{externalContacts.filter(c => c.source === 'invite').length} link · {externalContacts.filter(c => c.source === 'field-app').length} app · {externalContacts.filter(c => c.source === 'manual').length} manual</span>
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {externalContacts.map(c => (
                      <div key={c.id} className="flex items-center justify-between px-2.5 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded group">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${c.source === 'invite' ? 'bg-blue-500/20' : c.source === 'field-app' ? 'bg-green-500/20' : 'bg-orange-500/20'}`}>
                            <User className={`w-3 h-3 ${c.source === 'invite' ? 'text-blue-400' : c.source === 'field-app' ? 'text-green-400' : 'text-orange-400'}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-white text-xs font-medium truncate">{c.name}{c.role && <span className="text-slate-500 font-normal"> · {c.role}</span>}</p>
                            <p className="text-slate-500 text-[10px] truncate">{c.phone}{c.location && ` · 📍${c.location}`}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${c.source === 'invite' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : c.source === 'field-app' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>
                            {c.source === 'invite' ? '🔗' : c.source === 'field-app' ? '📱' : '✏️'}
                          </span>
                          <button onClick={() => setExternalContacts(prev => prev.filter(x => x.id !== c.id))}
                            className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400 transition-all">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {inviteLink && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-300">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse flex-shrink-0" />Invite link active — contacts auto-appear when they submit.
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between flex-shrink-0">
              <p className="text-xs text-slate-500">{externalContacts.length} external contact{externalContacts.length !== 1 ? 's' : ''}</p>
              <div className="flex gap-2">
                <button onClick={() => setShowInviteModal(false)} className="px-4 py-2 bg-slate-800 rounded-lg text-sm text-slate-300 hover:bg-slate-700">Close</button>
                {externalContacts.length > 0 && (
                  <button onClick={() => { alert(`${externalContacts.length} external contacts synced to Comms & Personnel Tracking`); setShowInviteModal(false); }}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm text-white font-bold flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />Sync to Portal
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import { useState, useEffect } from 'react';
import {
  Video, Settings, AlertTriangle, Clock, Plus, Eye, Pause, Thermometer, Camera, Flame, CheckCircle, Zap, X, MessageSquare, MapPin, Search, Globe, Database, ChevronRight, ChevronLeft, Activity, Target, Gauge, Radio, Cpu, ArrowDownRight, Maximize2, Grid, List, User, Battery, Wind, Droplets, Sun, ExternalLink, AlertCircle, Info, Home, Minus
} from 'lucide-react';
import { LiveDetectionView } from '../components/LiveDetectionView';
import { BatteryIndicator, ConnectionBadge, ControlModeBadge, DeviceIcon, ProcessingBadge, SignalStrength, StatusBadge, getDeviceBgColor, getDeviceColor } from '../components/common';
import { C, STREAMS } from '../data/collaboratorData';
import { streamDetections } from '../data/detections';
import { capabilities } from '../data/settingsData';
import { datacenterInfo, edgeBoxes, mockStreams } from '../data/streams';
import { LiveEmptyState } from '../components/LiveEmptyState';
import { useDevices } from '../hooks/useDevices';


// ============================================
// STREAMS TAB - OPERATOR QUICK RESPONSE DESIGN
// ============================================

export const StreamsTab = () => {
  const { isLive, devices } = useDevices();
  const [viewMode, setViewMode] = useState('operator'); // 'operator', 'grid', 'list'
  const [fullscreenStreamId, setFullscreenStreamId] = useState(null);
  const [selectedStreamId, setSelectedStreamId] = useState(mockStreams[0]?.id || null);
  const [allPaused, setAllPaused] = useState(false);
  const [showDroneEmergency, setShowDroneEmergency] = useState(false);
  const [devicePanelOpen, setDevicePanelOpen] = useState(true);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [controlsPanelOpen, setControlsPanelOpen] = useState(true);
  const [devicePanelFilter, setDevicePanelFilter] = useState({ type: 'all', status: 'all', search: '' });
  const [quickCommsOpen, setQuickCommsOpen] = useState(false);
  const [quickCommsChannel, setQuickCommsChannel] = useState('cmd');
  const [quickCommsMsg, setQuickCommsMsg] = useState('');
  const [quickCommsSent, setQuickCommsSent] = useState(false);
  const quickChannels = [
    { id: 'cmd', name: 'CMD', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' },
    { id: 'ops', name: 'OPS', color: 'text-orange-400', bg: 'bg-orange-500/20 border-orange-500/30' },
    { id: 'tac1', name: 'TAC-1', color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/30' },
    { id: 'air', name: 'AIR', color: 'text-cyan-400', bg: 'bg-cyan-500/20 border-cyan-500/30' },
    { id: 'med', name: 'MED', color: 'text-green-400', bg: 'bg-green-500/20 border-green-500/30' },
  ];

  // List view filters
  const [listFilters, setListFilters] = useState({
    search: '',
    deviceType: 'all',
    status: 'all',
    alertsOnly: false
  });
  
  // STREAMS STATE - mutable (must be declared before any derived values)
  const [streams, setStreams] = useState(mockStreams);
  
  // Derive fullscreen stream from live state so it always reflects current data
  const fullscreenStream = fullscreenStreamId ? streams.find(s => s.id === fullscreenStreamId) : null;
  
  // Emergency actions for drones
  const droneEmergencyActions = [
    { id: 'halt', label: 'EMERGENCY HALT', icon: Pause, color: 'red', description: 'Immediately stop and hover in place' },
    { id: 'standby', label: 'STANDBY MODE', icon: Clock, color: 'yellow', description: 'Stop current mission, hover and await instructions' },
    { id: 'manual_wait', label: 'AWAIT MANUAL', icon: User, color: 'cyan', description: 'Stop and wait for pilot to take manual control' },
    { id: 'rtb', label: 'RETURN TO BASE', icon: Home, color: 'blue', description: 'Abort mission and return to home base' },
    { id: 'goto_marker', label: 'GO TO MARKER', icon: MapPin, color: 'purple', description: 'Navigate to selected marker location' },
    { id: 'land_immediate', label: 'LAND NOW', icon: ArrowDownRight, color: 'orange', description: 'Emergency landing at current position' },
  ];
  
  // Handle drone emergency action
  const handleDroneEmergency = (action) => {
    const selectedStream = streams.find(s => s.id === selectedStreamId);
    if (selectedStream) {
      alert(`${action.label} executed for ${selectedStream.name}`);
      setShowDroneEmergency(false);
    }
  };
  
  // Filtered streams for list view
  const filteredStreams = streams.filter(stream => {
    // Search filter
    if (listFilters.search && !stream.name.toLowerCase().includes(listFilters.search.toLowerCase())) {
      return false;
    }
    // Device type filter
    if (listFilters.deviceType !== 'all' && stream.deviceType !== listFilters.deviceType) {
      return false;
    }
    // Status filter
    if (listFilters.status !== 'all' && stream.status !== listFilters.status) {
      return false;
    }
    // Alerts only filter
    if (listFilters.alertsOnly && !(stream.hasActiveDetection && !stream.alertAcknowledged)) {
      return false;
    }
    return true;
  });

  // Keyboard handler for ESC to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Allow ESC regardless of focus
      if (e.key === 'Escape' && fullscreenStream) {
        setFullscreenStreamId(null);
        return;
      }
      // Don't intercept keys when user is typing in an input
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
      // Number keys 1-6 to select streams quickly
      if (e.key >= '1' && e.key <= '6') {
        const index = parseInt(e.key) - 1;
        if (streams[index]) {
          setSelectedStreamId(streams[index].id);
        }
      }
      // 'A' to acknowledge selected
      if (e.key === 'a' || e.key === 'A') {
        if (selectedStreamId) {
          handleAcknowledge(selectedStreamId);
        }
      }
      // 'F' to toggle fullscreen for selected stream
      if ((e.key === 'f' || e.key === 'F') && !fullscreenStream) {
        const selectedStream = streams.find(s => s.id === selectedStreamId);
        if (selectedStream) {
          setFullscreenStreamId(selectedStream.id);
        }
      }
      // 'D' to toggle device panel
      if (e.key === 'd' || e.key === 'D') {
        setDevicePanelOpen(prev => !prev);
      }
      // 'I' to toggle info panel
      if (e.key === 'i' || e.key === 'I') {
        setInfoPanelOpen(prev => !prev);
      }
      // 'C' to toggle controls panel
      if (e.key === 'c' || e.key === 'C') {
        setControlsPanelOpen(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenStreamId, selectedStreamId, streams]);

  const activeStreams = streams.filter(s => s.status === 'active');
  const alertStreams = streams.filter(s => s.hasActiveDetection && !s.alertAcknowledged);
  const tendedStreams = streams.filter(s => s.hasActiveDetection && s.alertTended);
  const criticalAlerts = alertStreams.filter(s => s.alertSeverity === 'critical');

  // Broadcast alert status to parent nav — unattended (red) + tended (orange)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('watchtower-alerts', { detail: { unattended: alertStreams.length, tended: tendedStreams.length } }));
  }, [alertStreams.length, tendedStreams.length]);

  // ============================================
  // ACTION HANDLERS
  // ============================================

  const handleAcknowledge = (streamId) => {
    setStreams(prev => prev.map(s => 
      s.id === streamId 
        ? { ...s, alertAcknowledged: true, alertTended: true }
        : s
    ));
  };

  const handleAcknowledgeAll = () => {
    setStreams(prev => prev.map(s => s.hasActiveDetection ? ({
      ...s,
      alertAcknowledged: true,
      alertTended: true,
    }) : s));
  };

  // Resolve a tended threat — fully clears the alert
  const handleResolve = (streamId) => {
    setStreams(prev => prev.map(s => 
      s.id === streamId 
        ? { ...s, alertAcknowledged: true, alertTended: false, hasActiveDetection: false, detectionType: null, alertSeverity: null }
        : s
    ));
  };

  // Handler for updating stream settings (including camera capabilities)
  const handleUpdateStream = (streamId, updates) => {
    setStreams(prev => prev.map(s => 
      s.id === streamId 
        ? { ...s, ...updates }
        : s
    ));
  };

  const handleToggleControlMode = (streamId) => {
    setStreams(prev => prev.map(s => {
      if (s.id === streamId && s.deviceType === 'drone') {
        const newMode = s.controlMode === 'watchtower' ? 'manual' : 'watchtower';
        return {
          ...s,
          controlMode: newMode,
          pilot: newMode === 'manual' ? 'Current Operator' : null
        };
      }
      return s;
    }));
  };

  const simulateNewDetection = () => {
    const randomStream = streams.find(s => s.status === 'active' && !s.hasActiveDetection);
    if (randomStream) {
      setStreams(prev => prev.map(s => 
        s.id === randomStream.id 
          ? { 
              ...s, 
              hasActiveDetection: true, 
              alertAcknowledged: false,
              detectionType: Math.random() > 0.5 ? 'fire' : 'smoke',
              alertSeverity: Math.random() > 0.5 ? 'critical' : 'warning',
              alertTime: new Date().toLocaleTimeString()
            }
          : s
      ));
    }
  };

  // Get selected stream
  const selectedStream = selectedStreamId ? streams.find(s => s.id === selectedStreamId) : null;

  // Live mode: only real feeds. Simulated streams exist solely in demo mode.
  if (isLive) {
    return (
      <LiveEmptyState
        icon={Video}
        title="No feeds connected"
        description="Watchtower is wired to your live database — no simulated data here. Feeds appear as soon as devices are registered and streaming."
        facts={[
          { label: 'Registered devices', value: devices.length },
          { label: 'Active now', value: devices.filter(d => d.status === 'active').length },
        ]}
        hint="Connected to Supabase · live mode"
      />
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      
      {/* ============================================ */}
      {/* CRITICAL ALERT BAR - Compact */}
      {/* ============================================ */}
      {alertStreams.length > 0 && (
        <div className={`px-2 py-0.5 rounded flex items-center gap-2 flex-shrink-0 mb-0.5 ${
          criticalAlerts.length > 0
            ? 'bg-red-500 animate-pulse'
            : 'bg-orange-500 animate-pulse'
        }`}>
          <AlertTriangle className="w-3.5 h-3.5 text-white flex-shrink-0" />
          <p className="font-bold text-white text-xs flex-1">
            {alertStreams.length} ALERT{alertStreams.length > 1 ? 'S' : ''} — {criticalAlerts.length > 0 && `${criticalAlerts.length} FIRE`}{criticalAlerts.length > 0 && alertStreams.length - criticalAlerts.length > 0 && ' · '}{alertStreams.length - criticalAlerts.length > 0 && `${alertStreams.length - criticalAlerts.length} SMOKE`}
          </p>
          <button 
            onClick={handleAcknowledgeAll}
            className="px-2.5 py-0.5 bg-white text-red-600 rounded font-bold text-xs flex items-center gap-1 hover:bg-gray-100 transition-all"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            ACKNOWLEDGE ALL
          </button>
        </div>
      )}

      {/* ============================================ */}
      {/* QUICK CONTROLS BAR - Compact */}
      {/* ============================================ */}
      <div className="flex items-center justify-between gap-2 px-2 py-0.5 bg-slate-900/50 border border-slate-800 rounded flex-shrink-0 mb-1">
        <div className="flex items-center gap-1">
          <span className="text-slate-500 text-xs mr-1">View:</span>
          {['operator', 'grid', 'list'].map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded text-xs font-medium capitalize transition-all ${
                viewMode === mode
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {mode}
            </button>
          ))}
          <div className="w-px h-5 bg-slate-700 mx-1" />
          <button
            onClick={() => setQuickCommsOpen(!quickCommsOpen)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-all ${
              quickCommsOpen ? 'bg-blue-500/20 border border-blue-500/40 text-blue-400' : 'bg-slate-800 border border-transparent text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Radio className="w-3 h-3" />COMMS
          </button>
          {quickCommsOpen && (
            <>
              {quickChannels.map(ch => (
                <button key={ch.id} onClick={() => setQuickCommsChannel(ch.id)}
                  className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                    quickCommsChannel === ch.id ? ch.bg + ' ' + ch.color : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'
                  }`}>{ch.name}</button>
              ))}
              <div className="flex items-center gap-1.5 flex-1 min-w-0 ml-1">
                <input
                  type="text"
                  value={quickCommsMsg}
                  onChange={e => { setQuickCommsMsg(e.target.value); setQuickCommsSent(false); }}
                  placeholder={`Order to ${quickChannels.find(c => c.id === quickCommsChannel)?.name}...`}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter' && quickCommsMsg.trim()) {
                      setQuickCommsSent(true);
                      setTimeout(() => { setQuickCommsSent(false); setQuickCommsMsg(''); }, 2000);
                    }
                  }}
                  className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-500 focus:border-blue-500/50 focus:outline-none"
                />
                {quickCommsSent ? (
                  <span className="flex items-center gap-1 text-green-400 text-[10px] font-bold flex-shrink-0"><CheckCircle className="w-3 h-3" />SENT</span>
                ) : (
                  <button
                    onClick={() => {
                      if (quickCommsMsg.trim()) {
                        setQuickCommsSent(true);
                        setTimeout(() => { setQuickCommsSent(false); setQuickCommsMsg(''); }, 2000);
                      }
                    }}
                    disabled={!quickCommsMsg.trim()}
                    className={`px-2 py-1 rounded text-[10px] font-bold flex-shrink-0 ${quickCommsMsg.trim() ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                  >TX</button>
                )}
              </div>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 rounded">
            <div className={`w-2 h-2 rounded-full ${activeStreams.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-white font-medium text-xs">{activeStreams.length}</span>
            <span className="text-slate-500 text-xs">Active</span>
          </div>
          
          <button 
            onClick={simulateNewDetection}
            className="px-3 py-1.5 bg-orange-500/20 border border-orange-500/30 rounded text-xs text-orange-400 hover:bg-orange-500/30"
          >
            + Sim Alert
          </button>
        </div>
      </div>

      {/* ============================================ */}
      {/* OPERATOR VIEW - Optimized for quick response */}
      {/* ============================================ */}
      {viewMode === 'operator' && (
        <div className="flex-1 flex gap-2 min-h-0 overflow-hidden">
          
          {/* LEFT: Collapsible Device Panel */}
          <div 
            className="flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out overflow-hidden"
            style={{ width: devicePanelOpen ? '190px' : '0px', opacity: devicePanelOpen ? 1 : 0 }}
          >
            <div style={{ minWidth: '190px' }} className="flex flex-col h-full">
              {/* Panel Header */}
              <div className="flex items-center justify-between px-1 mb-1 flex-shrink-0">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Devices</p>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-600">{streams.length}</span>
                  <button
                    onClick={() => setDevicePanelOpen(false)}
                    className="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
                    title="Collapse device panel (D)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="px-1 mb-1.5 flex-shrink-0">
                <div className="relative">
                  <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={devicePanelFilter.search}
                    onChange={(e) => setDevicePanelFilter(f => ({ ...f, search: e.target.value }))}
                    className="w-full pl-6 pr-2 py-1 bg-slate-800/80 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:border-orange-500/50 focus:outline-none"
                  />
                  {devicePanelFilter.search && (
                    <button onClick={() => setDevicePanelFilter(f => ({ ...f, search: '' }))} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Chips */}
              <div className="px-1 mb-1.5 flex flex-wrap gap-1 flex-shrink-0">
                {/* Type filters */}
                {['all', 'drone', 'camera', 'sensor'].map(t => (
                  <button
                    key={t}
                    onClick={() => setDevicePanelFilter(f => ({ ...f, type: t }))}
                    className={`px-1.5 py-0.5 rounded text-xs transition-all ${
                      devicePanelFilter.type === t
                        ? t === 'all' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                          : t === 'drone' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                          : t === 'camera' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-slate-800/60 text-slate-500 border border-slate-700/50 hover:text-slate-300'
                    }`}
                  >
                    {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1) + 's'}
                  </button>
                ))}
              </div>

              {/* Status filter row */}
              <div className="px-1 mb-1.5 flex gap-1 flex-shrink-0">
                {['all', 'active', 'alerts'].map(s => (
                  <button
                    key={s}
                    onClick={() => setDevicePanelFilter(f => ({ ...f, status: s }))}
                    className={`px-1.5 py-0.5 rounded text-xs flex-1 text-center transition-all ${
                      devicePanelFilter.status === s
                        ? s === 'alerts' ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                          : s === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                          : 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                        : 'bg-slate-800/60 text-slate-500 border border-slate-700/50 hover:text-slate-300'
                    }`}
                  >
                    {s === 'all' ? 'All' : s === 'alerts' ? '⚠ Alerts' : '● Active'}
                  </button>
                ))}
              </div>

              {/* Scrollable Device List */}
              <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto pr-1">
            {(() => {
              const panelFiltered = streams.filter(stream => {
                if (devicePanelFilter.search && !stream.name.toLowerCase().includes(devicePanelFilter.search.toLowerCase())) return false;
                if (devicePanelFilter.type !== 'all' && stream.deviceType !== devicePanelFilter.type) return false;
                if (devicePanelFilter.status === 'active' && stream.status !== 'active') return false;
                if (devicePanelFilter.status === 'alerts' && !(stream.hasActiveDetection && !stream.alertAcknowledged)) return false;
                return true;
              });
              
              if (panelFiltered.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-4 text-center">
                    <Search className="w-5 h-5 text-slate-600 mb-1" />
                    <p className="text-xs text-slate-500">No devices match</p>
                    <button 
                      onClick={() => setDevicePanelFilter({ type: 'all', status: 'all', search: '' })}
                      className="text-xs text-orange-400 hover:text-orange-300 mt-1"
                    >
                      Clear filters
                    </button>
                  </div>
                );
              }
              
              return panelFiltered.map((stream, index) => {
              const needsAttention = stream.hasActiveDetection && !stream.alertAcknowledged;
              const isSelected = selectedStreamId === stream.id;
              
              // Format sensor display based on data available
              const getSensorDisplay = (sensorData) => {
                if (!sensorData) return { text: 'No data', risk: null };
                if (sensorData.status) return { text: sensorData.status, risk: null };
                
                const parts = [];
                if (sensorData.temp !== null && sensorData.temp !== undefined) parts.push(`${sensorData.temp}°C`);
                if (sensorData.humidity !== null && sensorData.humidity !== undefined) parts.push(`${sensorData.humidity}%`);
                if (sensorData.windSpeed) parts.push(`${sensorData.windSpeed}km/h`);
                if (sensorData.smokeLevel !== undefined) {
                  return { text: `Smoke: ${sensorData.smokeLevel}ppm • CO: ${sensorData.coLevel}ppm`, risk: null };
                }
                if (sensorData.fireRisk) {
                  return { text: parts.join(' • '), risk: sensorData.fireRisk };
                }
                return { text: parts.join(' • ') || 'Active', risk: null };
              };
              
              const sensorInfo = stream.deviceType === 'sensor' ? getSensorDisplay(stream.sensorData) : null;
              const riskColors = { low: 'text-green-400', moderate: 'text-yellow-400', high: 'text-orange-400', extreme: 'text-red-400' };
              
              return (
                <button
                  key={stream.id}
                  onClick={() => setSelectedStreamId(stream.id)}
                  className={`relative p-2 rounded-lg text-left transition-all ${
                    needsAttention
                      ? 'bg-red-500/20 border-2 border-red-500 animate-pulse'
                      : isSelected
                        ? 'bg-orange-500/20 border border-orange-500'
                        : 'bg-slate-800/50 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded flex items-center justify-center ${
                      needsAttention ? 'bg-red-500' : getDeviceBgColor(stream.deviceType, stream.status)
                    }`}>
                      {needsAttention ? (
                        <AlertTriangle className="w-4 h-4 text-white" />
                      ) : (
                        <DeviceIcon deviceType={stream.deviceType} className={`w-4 h-4 ${getDeviceColor(stream.deviceType)}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-xs truncate">{stream.name}</p>
                      <p className="text-xs truncate">
                        {needsAttention ? (
                          <span className="text-red-400 font-bold">{stream.detectionType?.toUpperCase()}</span>
                        ) : stream.deviceType === 'sensor' && stream.status === 'active' && sensorInfo ? (
                          <span className={sensorInfo.risk ? riskColors[sensorInfo.risk] : 'text-orange-400'}>
                            {sensorInfo.text}{sensorInfo.risk && ` • ${sensorInfo.risk.toUpperCase()}`}
                          </span>
                        ) : stream.deviceType === 'sensor' && stream.status === 'maintenance' ? (
                          <span className="text-yellow-400">{sensorInfo?.text || 'maintenance'}</span>
                        ) : (
                          <span className="text-slate-400">{stream.status}</span>
                        )}
                      </p>
                    </div>
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      stream.status === 'active' ? 'bg-green-500' : 
                      stream.status === 'maintenance' ? 'bg-yellow-500' : 'bg-slate-500'
                    }`} />
                  </div>
                </button>
              );
            });
            })()}
            </div>
            </div>
          </div>

          {/* Device Panel Toggle Button */}
          {!devicePanelOpen && (
            <div className="flex-shrink-0 flex flex-col items-center pt-1">
              <button
                onClick={() => setDevicePanelOpen(true)}
                className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 hover:border-orange-500/50 text-slate-400 hover:text-orange-400 transition-all group relative"
                title="Show device panel (D)"
              >
                <ChevronRight className="w-4 h-4" />
                {alertStreams.length > 0 && (
                  <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                    <span className="text-white text-xs font-bold" style={{ fontSize: '9px' }}>{alertStreams.length}</span>
                  </div>
                )}
              </button>
              <div className="mt-2 flex flex-col items-center gap-1">
                <span className="text-xs text-slate-600 font-medium" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                  DEVICES
                </span>
                <div className="w-5 h-5 rounded bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <span className="text-xs text-slate-400 font-medium">{streams.length}</span>
                </div>
              </div>
            </div>
          )}

          {/* CENTER: Main View (Selected Stream) */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {selectedStream ? (
              <div className={`flex-1 flex flex-col min-h-0 rounded-lg overflow-hidden border ${
                selectedStream.hasActiveDetection && !selectedStream.alertAcknowledged
                  ? 'border-red-500 border-2'
                  : 'border-slate-700'
              }`}>
                {/* Video Feed - ONLY for drones and cameras */}
                {(selectedStream.deviceType === 'drone' || selectedStream.deviceType === 'camera') ? (
                  <div className="bg-slate-900 relative flex-1 min-h-0 overflow-hidden">
                    {selectedStream.status === 'active' ? (
                      <LiveDetectionView 
                        stream={selectedStream} 
                        detections={streamDetections[selectedStream.id] || []}
                        onClose={null}
                        onUpdateStream={handleUpdateStream}
                        onEmergency={(id) => { setSelectedStreamId(id); setShowDroneEmergency(true); }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <span className="text-slate-500">Stream Offline</span>
                      </div>
                    )}
                    
                    {/* Video Controls Overlay - Top Right */}
                    <div className="absolute top-2 right-12 z-30 flex items-center gap-1">
                      <button
                        onClick={() => setFullscreenStreamId(selectedStream.id)}
                        className="p-1.5 bg-black/60 hover:bg-black/80 rounded text-white/80 hover:text-white transition-all"
                        title="Fullscreen (F)"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          const popoutWindow = window.open('', '_blank', 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no');
                          if (popoutWindow) {
                            popoutWindow.document.write(`
                              <html>
                                <head><title>${selectedStream.name} - Watchtower</title></head>
                                <body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;">
                                  <div style="color:#fff;text-align:center;">
                                    <h2 style="color:#f97316;">${selectedStream.name}</h2>
                                    <p>Live Stream - Cast to Monitor</p>
                                    <p style="color:#666;font-size:12px;">Stream ID: ${selectedStream.id}</p>
                                  </div>
                                </body>
                              </html>
                            `);
                          }
                        }}
                        className="p-1.5 bg-black/60 hover:bg-black/80 rounded text-white/80 hover:text-white transition-all"
                        title="Pop out / Cast to Monitor"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* SENSOR / NON-CAMERA DEVICE INFO BOX */
                  <div className="bg-slate-900 p-3 overflow-y-auto flex-1 min-h-0">
                    <div className="flex flex-col h-full">
                      {/* Device Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            selectedStream.hasActiveDetection ? 'bg-red-500' : getDeviceBgColor(selectedStream.deviceType, selectedStream.status)
                          }`}>
                            {selectedStream.hasActiveDetection ? (
                              <AlertTriangle className="w-5 h-5 text-white" />
                            ) : (
                              <DeviceIcon deviceType={selectedStream.deviceType} className={`w-5 h-5 ${getDeviceColor(selectedStream.deviceType)}`} />
                            )}
                          </div>
                          <div>
                            <h3 className="text-white font-bold text-sm">{selectedStream.name}</h3>
                            <p className="text-slate-400 text-xs">{selectedStream.type} • {selectedStream.location}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            selectedStream.status === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                            selectedStream.status === 'maintenance' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                            'bg-slate-700 text-slate-400 border border-slate-600'
                          }`}>
                            {selectedStream.status === 'active' ? '● ONLINE' : selectedStream.status === 'maintenance' ? '⚠ MAINTENANCE' : '○ OFFLINE'}
                          </div>
                        </div>
                      </div>

                      {selectedStream.status === 'active' && selectedStream.sensorData ? (
                        <div className="flex-1 flex flex-col gap-3">
                          {/* Primary Sensor Readings */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 flex-1">
                            {selectedStream.sensorData.temp !== undefined && (
                              <div className="bg-slate-800 rounded-lg p-3 border border-slate-700/50">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Thermometer className="w-4 h-4 text-orange-400" />
                                  <span className="text-slate-400 text-xs uppercase">Temperature</span>
                                </div>
                                <p className="text-white text-2xl font-bold">{selectedStream.sensorData.temp}<span className="text-sm text-slate-400">°C</span></p>
                              </div>
                            )}
                            {selectedStream.sensorData.humidity !== undefined && (
                              <div className="bg-slate-800 rounded-lg p-3 border border-slate-700/50">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Droplets className="w-4 h-4 text-blue-400" />
                                  <span className="text-slate-400 text-xs uppercase">Humidity</span>
                                </div>
                                <p className="text-white text-2xl font-bold">{selectedStream.sensorData.humidity}<span className="text-sm text-slate-400">%</span></p>
                              </div>
                            )}
                            {selectedStream.sensorData.windSpeed !== undefined && (
                              <div className="bg-slate-800 rounded-lg p-3 border border-slate-700/50">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Wind className="w-4 h-4 text-cyan-400" />
                                  <span className="text-slate-400 text-xs uppercase">Wind</span>
                                </div>
                                <p className="text-white text-2xl font-bold">{selectedStream.sensorData.windSpeed}<span className="text-sm text-slate-400"> km/h {selectedStream.sensorData.windDir || ''}</span></p>
                              </div>
                            )}
                            {selectedStream.sensorData.pressure !== undefined && (
                              <div className="bg-slate-800 rounded-lg p-3 border border-slate-700/50">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Gauge className="w-4 h-4 text-purple-400" />
                                  <span className="text-slate-400 text-xs uppercase">Pressure</span>
                                </div>
                                <p className="text-white text-2xl font-bold">{selectedStream.sensorData.pressure}<span className="text-sm text-slate-400"> hPa</span></p>
                              </div>
                            )}
                            {selectedStream.sensorData.smokeLevel !== undefined && (
                              <div className="bg-slate-800 rounded-lg p-3 border border-slate-700/50">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Activity className="w-4 h-4 text-yellow-400" />
                                  <span className="text-slate-400 text-xs uppercase">Smoke</span>
                                </div>
                                <p className="text-white text-2xl font-bold">{selectedStream.sensorData.smokeLevel}<span className="text-sm text-slate-400"> ppm</span></p>
                              </div>
                            )}
                            {selectedStream.sensorData.coLevel !== undefined && (
                              <div className="bg-slate-800 rounded-lg p-3 border border-slate-700/50">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <AlertCircle className="w-4 h-4 text-red-400" />
                                  <span className="text-slate-400 text-xs uppercase">CO Level</span>
                                </div>
                                <p className="text-white text-2xl font-bold">{selectedStream.sensorData.coLevel}<span className="text-sm text-slate-400"> ppm</span></p>
                              </div>
                            )}
                            {selectedStream.sensorData.soilMoisture !== undefined && (
                              <div className="bg-slate-800 rounded-lg p-3 border border-slate-700/50">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Droplets className="w-4 h-4 text-emerald-400" />
                                  <span className="text-slate-400 text-xs uppercase">Soil Moisture</span>
                                </div>
                                <p className="text-white text-2xl font-bold">{selectedStream.sensorData.soilMoisture}<span className="text-sm text-slate-400">%</span></p>
                              </div>
                            )}
                            {selectedStream.sensorData.uvIndex !== undefined && (
                              <div className="bg-slate-800 rounded-lg p-3 border border-slate-700/50">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Sun className="w-4 h-4 text-yellow-300" />
                                  <span className="text-slate-400 text-xs uppercase">UV Index</span>
                                </div>
                                <p className="text-white text-2xl font-bold">{selectedStream.sensorData.uvIndex}</p>
                              </div>
                            )}
                          </div>

                          {/* Fire Risk Banner */}
                          {selectedStream.sensorData.fireRisk && (
                            <div className={`rounded-lg p-3 border flex items-center justify-between ${
                              selectedStream.sensorData.fireRisk === 'extreme' ? 'bg-red-500/15 border-red-500/40' :
                              selectedStream.sensorData.fireRisk === 'high' ? 'bg-orange-500/15 border-orange-500/40' :
                              selectedStream.sensorData.fireRisk === 'moderate' ? 'bg-yellow-500/15 border-yellow-500/40' :
                              'bg-green-500/15 border-green-500/40'
                            }`}>
                              <div className="flex items-center gap-2">
                                <Flame className={`w-5 h-5 ${
                                  selectedStream.sensorData.fireRisk === 'extreme' ? 'text-red-400' :
                                  selectedStream.sensorData.fireRisk === 'high' ? 'text-orange-400' :
                                  selectedStream.sensorData.fireRisk === 'moderate' ? 'text-yellow-400' :
                                  'text-green-400'
                                }`} />
                                <span className="text-white text-sm font-bold">FIRE RISK</span>
                              </div>
                              <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                                selectedStream.sensorData.fireRisk === 'extreme' ? 'bg-red-500/30 text-red-300' :
                                selectedStream.sensorData.fireRisk === 'high' ? 'bg-orange-500/30 text-orange-300' :
                                selectedStream.sensorData.fireRisk === 'moderate' ? 'bg-yellow-500/30 text-yellow-300' :
                                'bg-green-500/30 text-green-300'
                              }`}>{selectedStream.sensorData.fireRisk.toUpperCase()}</span>
                            </div>
                          )}

                          {/* Air Quality if available */}
                          {selectedStream.sensorData.airQuality && (
                            <div className="bg-slate-800 rounded-lg p-3 border border-slate-700/50 flex items-center justify-between">
                              <span className="text-slate-400 text-xs uppercase">Air Quality</span>
                              <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${
                                selectedStream.sensorData.airQuality === 'good' ? 'bg-green-500/20 text-green-400' :
                                selectedStream.sensorData.airQuality === 'moderate' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>{selectedStream.sensorData.airQuality.toUpperCase()}</span>
                            </div>
                          )}

                          {/* Device Meta Row */}
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span>{selectedStream.connectionType}</span>
                            <span>•</span>
                            <span>Latency: {selectedStream.latency}ms</span>
                            {selectedStream.batteryLevel && (
                              <>
                                <span>•</span>
                                <span className={selectedStream.batteryLevel > 50 ? 'text-green-400' : selectedStream.batteryLevel > 20 ? 'text-yellow-400' : 'text-red-400'}>
                                  Battery: {selectedStream.batteryLevel}%
                                </span>
                              </>
                            )}
                            <span>•</span>
                            <span>Health: {selectedStream.health}%</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center">
                          <div className="text-center">
                            <DeviceIcon deviceType={selectedStream.deviceType} className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                            <p className="text-slate-400 text-sm">{selectedStream.status === 'maintenance' ? 'Device Under Maintenance' : 'Device Offline'}</p>
                            <p className="text-slate-500 text-xs mt-1">Health: {selectedStream.health}%</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-slate-900/50 border border-slate-800 rounded-lg min-h-0">
                <div className="text-center">
                  <Video className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">Select a stream to view</p>
                  <p className="text-slate-500 text-xs">Press 1-6 or click a stream</p>
                </div>
              </div>
            )}
          </div>

          {/* CONTROLS COLUMN - Collapsible, between video and info panel */}
          {selectedStream && (selectedStream.deviceType === 'drone' || selectedStream.deviceType === 'camera') && selectedStream.status === 'active' && (
            <div 
              className="flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out overflow-hidden"
              style={{ width: controlsPanelOpen ? '180px' : '0px', opacity: controlsPanelOpen ? 1 : 0 }}
            >
              <div style={{ minWidth: '180px' }} className="flex flex-col gap-1.5 h-full overflow-y-auto">
              
              {/* Panel Header with Collapse */}
              <div className="flex items-center justify-between px-1 flex-shrink-0">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Controls</p>
                <button
                  onClick={() => setControlsPanelOpen(false)}
                  className="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
                  title="Collapse controls panel (C)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              
              {/* Acknowledge Alert */}
              {selectedStream.hasActiveDetection && !selectedStream.alertAcknowledged && (
                <button
                  onClick={() => handleAcknowledge(selectedStream.id)}
                  className="w-full py-2.5 bg-red-500 hover:bg-red-600 rounded-lg text-white font-bold text-xs flex items-center justify-center gap-2 animate-pulse"
                >
                  <CheckCircle className="w-4 h-4" />
                  ACKNOWLEDGE (A)
                </button>
              )}

              {/* Control Mode */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-2">
                <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1.5">Control</p>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleUpdateStream(selectedStream.id, { controlMode: 'watchtower', pilot: null })}
                    className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-bold transition-all ${
                      selectedStream.controlMode === 'watchtower' || !selectedStream.controlMode
                        ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <Flame className="w-3 h-3" />
                    AI AUTO
                  </button>
                  <button
                    onClick={() => handleUpdateStream(selectedStream.id, { controlMode: 'manual', pilot: 'Current Operator' })}
                    className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-bold transition-all ${
                      selectedStream.controlMode === 'manual'
                        ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <User className="w-3 h-3" />
                    HUMAN
                  </button>
                </div>
              </div>

              {/* Emergency Controls */}
              {selectedStream.deviceType === 'drone' && (
                <button
                  onClick={() => { setSelectedStreamId(selectedStream.id); setShowDroneEmergency(true); }}
                  className="w-full py-2 bg-red-500/15 hover:bg-red-500/30 border border-red-500/50 hover:border-red-500 rounded-lg text-red-400 hover:text-red-300 text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  EMERGENCY
                </button>
              )}

              {/* Quick Actions */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-2">
                <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1.5">Actions</p>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => setFullscreenStreamId(selectedStream.id)}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white text-[10px] font-medium transition-all"
                  >
                    <Maximize2 className="w-3 h-3" />
                    Fullscreen (F)
                  </button>
                  {selectedStream.deviceType === 'drone' && (
                    <>
                      <button className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white text-[10px] font-medium transition-all">
                        <Home className="w-3 h-3" />
                        Return to Base
                      </button>
                      <button className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white text-[10px] font-medium transition-all">
                        <MapPin className="w-3 h-3" />
                        Go to Marker
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Stream Health */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-2">
                <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1.5">Health</p>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Signal</span>
                    <span className="text-green-400 font-medium">{selectedStream.signalStrength}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Latency</span>
                    <span className={`font-medium ${selectedStream.latency < 20 ? 'text-green-400' : selectedStream.latency < 50 ? 'text-yellow-400' : 'text-red-400'}`}>{selectedStream.latency}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">FPS</span>
                    <span className="text-white font-medium">{selectedStream.fps}</span>
                  </div>
                  {selectedStream.batteryLevel && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Battery</span>
                      <span className={`font-medium ${selectedStream.batteryLevel > 50 ? 'text-green-400' : selectedStream.batteryLevel > 20 ? 'text-yellow-400' : 'text-red-400'}`}>{selectedStream.batteryLevel}%</span>
                    </div>
                  )}
                </div>
              </div>
              </div>
            </div>
          )}

          {/* Controls Panel Toggle Button (when collapsed) */}
          {selectedStream && (selectedStream.deviceType === 'drone' || selectedStream.deviceType === 'camera') && selectedStream.status === 'active' && !controlsPanelOpen && (
            <div className="flex-shrink-0 flex flex-col items-center pt-1">
              <button
                onClick={() => setControlsPanelOpen(true)}
                className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 hover:border-orange-500/50 text-slate-400 hover:text-orange-400 transition-all group relative"
                title="Show controls panel (C)"
              >
                <ChevronLeft className="w-4 h-4" />
                {selectedStream.hasActiveDetection && !selectedStream.alertAcknowledged && (
                  <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                    <span className="text-white text-xs font-bold" style={{ fontSize: '9px' }}>!</span>
                  </div>
                )}
              </button>
              <div className="mt-2 flex flex-col items-center gap-1">
                <span className="text-xs text-slate-600 font-medium" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                  CTRL
                </span>
              </div>
            </div>
          )}

          {/* RIGHT: Collapsible Info Panel & Quick Stats */}
          <div 
            className="flex-shrink-0 flex flex-col gap-1.5 overflow-y-auto pl-1 transition-all duration-300 ease-in-out overflow-hidden"
            style={{ width: infoPanelOpen ? '220px' : '0px', opacity: infoPanelOpen ? 1 : 0 }}
          >
            <div style={{ minWidth: '220px' }} className="flex flex-col gap-1.5 h-full overflow-y-auto">
            
            {/* Panel Header with Collapse */}
            <div className="flex items-center justify-between px-1 flex-shrink-0">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Info Panel</p>
              <button
                onClick={() => setInfoPanelOpen(false)}
                className="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
                title="Collapse info panel (I)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {/* Selected Stream Details - Compact */}
            {selectedStream && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-2 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-medium text-xs uppercase tracking-wide truncate">{selectedStream.name}</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Status</span>
                    <StatusBadge status={selectedStream.status} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Signal</span>
                    <SignalStrength strength={selectedStream.signalStrength} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Latency</span>
                    <span className={`font-medium ${
                      selectedStream.latency < 20 ? 'text-green-400' : 
                      selectedStream.latency < 50 ? 'text-yellow-400' : 'text-red-400'
                    }`}>{selectedStream.latency}ms</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">FPS</span>
                    <span className="text-white">{selectedStream.fps}</span>
                  </div>
                  
                  {selectedStream.deviceType === 'drone' && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Battery</span>
                        <BatteryIndicator level={selectedStream.batteryLevel} />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Mode</span>
                        <span className={`font-medium ${selectedStream.controlMode === 'manual' ? 'text-cyan-400' : 'text-orange-400'}`}>
                          {selectedStream.controlMode === 'manual' ? 'Human' : 'AI'}
                        </span>
                      </div>
                    </>
                  )}
                  
                  {selectedStream.deviceType === 'sensor' && selectedStream.sensorData && (
                    <>
                      {selectedStream.sensorData.temp !== null && selectedStream.sensorData.temp !== undefined && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Temp</span>
                          <span className="text-orange-400">{selectedStream.sensorData.temp}°C</span>
                        </div>
                      )}
                      {selectedStream.sensorData.humidity !== null && selectedStream.sensorData.humidity !== undefined && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Humidity</span>
                          <span className="text-blue-400">{selectedStream.sensorData.humidity}%</span>
                        </div>
                      )}
                      {selectedStream.sensorData.fireRisk && (
                        <div className="flex justify-between items-center col-span-2">
                          <span className="text-slate-500">Fire Risk</span>
                          <span className={`font-bold uppercase ${
                            selectedStream.sensorData.fireRisk === 'extreme' ? 'text-red-500' :
                            selectedStream.sensorData.fireRisk === 'high' ? 'text-orange-500' :
                            selectedStream.sensorData.fireRisk === 'moderate' ? 'text-yellow-500' : 'text-green-500'
                          }`}>{selectedStream.sensorData.fireRisk}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Camera Controls Panel */}
            {selectedStream && selectedStream.cameraCapabilities && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-2">
                <h3 className="text-white font-medium text-xs uppercase tracking-wide mb-2">Camera</h3>
                
                {/* Camera Mode Selector Bar */}
                <div className="bg-slate-800/50 rounded-lg p-1 mb-2">
                  <div className="flex items-center gap-1">
                    {selectedStream.cameraCapabilities.modes.map(mode => {
                      const modeConfig = {
                        visual: { icon: Camera, label: 'Visual', color: 'blue' },
                        thermal: { icon: Thermometer, label: 'Thermal', color: 'red' },
                        nightvision: { icon: Eye, label: 'Night Vision', color: 'green' },
                        split: { icon: Grid, label: 'Split View', color: 'purple' },
                        pip: { icon: Maximize2, label: 'PiP', color: 'cyan' },
                      }[mode] || { icon: Camera, label: mode, color: 'slate' };
                      const isActive = selectedStream.cameraCapabilities.activeMode === mode;
                      const IconComp = modeConfig.icon;
                      return (
                        <button
                          key={mode}
                          onClick={() => handleUpdateStream(selectedStream.id, {
                            cameraCapabilities: { ...selectedStream.cameraCapabilities, activeMode: mode }
                          })}
                          className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 px-1 rounded text-[10px] font-medium transition-all ${
                            isActive 
                              ? `bg-${modeConfig.color}-500/20 text-${modeConfig.color}-400 ring-1 ring-${modeConfig.color}-500/50` 
                              : 'text-slate-500 hover:text-white hover:bg-slate-700/50'
                          }`}
                        >
                          <IconComp className="w-3.5 h-3.5" />
                          <span className="truncate">{modeConfig.label.split(' ')[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Thermal Spot Temperature (when in thermal mode) */}
                {selectedStream.cameraCapabilities.activeMode === 'thermal' && selectedStream.cameraCapabilities.thermalSpotTemp && (
                  <div className="flex items-center justify-between p-2 bg-red-500/10 border border-red-500/30 rounded-lg mb-2">
                    <div className="flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-red-400" />
                      <span className="text-xs text-slate-400">Spot Temp</span>
                    </div>
                    <span className="text-lg font-bold text-red-400">{selectedStream.cameraCapabilities.thermalSpotTemp}°C</span>
                  </div>
                )}

                {/* Quick Control Buttons */}
                <div className="flex items-center justify-between gap-1">
                  {/* Left: Feature toggles */}
                  <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
                    {selectedStream.cameraCapabilities.hasIR && (
                      <button
                        onClick={() => handleUpdateStream(selectedStream.id, {
                          cameraCapabilities: { ...selectedStream.cameraCapabilities, irEnabled: !selectedStream.cameraCapabilities.irEnabled }
                        })}
                        className={`p-2 rounded transition-all ${
                          selectedStream.cameraCapabilities.irEnabled 
                            ? 'bg-red-500 text-white' 
                            : 'text-slate-500 hover:text-white hover:bg-slate-700'
                        }`}
                        title="IR Illuminator"
                      >
                        <Sun className="w-4 h-4" />
                      </button>
                    )}
                    {selectedStream.cameraCapabilities.hasSpotlight && (
                      <button
                        onClick={() => handleUpdateStream(selectedStream.id, {
                          cameraCapabilities: { ...selectedStream.cameraCapabilities, spotlightEnabled: !selectedStream.cameraCapabilities.spotlightEnabled }
                        })}
                        className={`p-2 rounded transition-all ${
                          selectedStream.cameraCapabilities.spotlightEnabled 
                            ? 'bg-yellow-500 text-black' 
                            : 'text-slate-500 hover:text-white hover:bg-slate-700'
                        }`}
                        title="Spotlight"
                      >
                        <Zap className="w-4 h-4" />
                      </button>
                    )}
                    {selectedStream.cameraCapabilities.hasLaser && (
                      <button
                        onClick={() => handleUpdateStream(selectedStream.id, {
                          cameraCapabilities: { ...selectedStream.cameraCapabilities, laserEnabled: !selectedStream.cameraCapabilities.laserEnabled }
                        })}
                        className={`p-2 rounded transition-all ${
                          selectedStream.cameraCapabilities.laserEnabled 
                            ? 'bg-green-500 text-white' 
                            : 'text-slate-500 hover:text-white hover:bg-slate-700'
                        }`}
                        title="Laser Pointer"
                      >
                        <Target className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      className="p-2 rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-all"
                      title="Camera Settings"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Right: Zoom */}
                  {selectedStream.cameraCapabilities.hasZoom && (
                    <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
                      <button
                        onClick={() => handleUpdateStream(selectedStream.id, {
                          cameraCapabilities: { 
                            ...selectedStream.cameraCapabilities, 
                            currentZoom: Math.max(1, selectedStream.cameraCapabilities.currentZoom - 1) 
                          }
                        })}
                        className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs text-white font-mono w-8 text-center">
                        {selectedStream.cameraCapabilities.currentZoom}x
                      </span>
                      <button
                        onClick={() => handleUpdateStream(selectedStream.id, {
                          cameraCapabilities: { 
                            ...selectedStream.cameraCapabilities, 
                            currentZoom: Math.min(selectedStream.cameraCapabilities.maxZoom, selectedStream.cameraCapabilities.currentZoom + 1) 
                          }
                        })}
                        className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Thermal Palette Quick Select (when in thermal mode) */}
                {selectedStream.cameraCapabilities.activeMode === 'thermal' && (
                  <div className="mt-2">
                    <div className="flex items-center gap-1">
                      {[
                        { id: 'white_hot', gradient: 'from-black via-gray-500 to-white' },
                        { id: 'black_hot', gradient: 'from-white via-gray-500 to-black' },
                        { id: 'ironbow', gradient: 'from-purple-900 via-red-500 via-yellow-400 to-white' },
                        { id: 'rainbow', gradient: 'from-blue-500 via-green-500 via-yellow-500 to-red-500' },
                        { id: 'arctic', gradient: 'from-blue-900 via-cyan-400 to-white' },
                      ].map(palette => (
                        <button
                          key={palette.id}
                          onClick={() => handleUpdateStream(selectedStream.id, {
                            cameraCapabilities: { ...selectedStream.cameraCapabilities, thermalPalette: palette.id }
                          })}
                          className={`flex-1 h-5 rounded bg-gradient-to-r ${palette.gradient} ${
                            selectedStream.cameraCapabilities.thermalPalette === palette.id 
                              ? 'ring-2 ring-orange-500' 
                              : 'opacity-60 hover:opacity-100'
                          }`}
                          title={palette.id.replace('_', ' ')}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI Assistant Placeholder - Compact */}
            <div className="bg-gradient-to-br from-orange-500/10 to-purple-500/10 border border-orange-500/30 rounded-lg p-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-purple-500 rounded flex items-center justify-center">
                  <MessageSquare className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-medium text-xs">AI Assistant</h3>
                  <p className="text-xs text-slate-500">Coming soon</p>
                </div>
              </div>
              <div className="p-1.5 bg-slate-800/50 rounded text-xs text-slate-500 italic space-y-0.5">
                <p>"Show fire alerts"</p>
                <p>"Acknowledge drone 1"</p>
              </div>
            </div>
            </div>
          </div>

          {/* Info Panel Toggle Button (when collapsed) */}
          {!infoPanelOpen && (
            <div className="flex-shrink-0 flex flex-col items-center pt-1">
              <button
                onClick={() => setInfoPanelOpen(true)}
                className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 hover:border-orange-500/50 text-slate-400 hover:text-orange-400 transition-all group relative"
                title="Show info panel (I)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="mt-2 flex flex-col items-center gap-1">
                <span className="text-xs text-slate-600 font-medium" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                  INFO
                </span>
              </div>
            </div>
          )}
        </div>
      )}
      {viewMode === 'network' && (
        <div className="space-y-6">
          {/* Edge AI Boxes */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-purple-400" />
              Edge AI Boxes
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {edgeBoxes.map(box => (
                <div key={box.id} className={`p-4 rounded-xl border ${box.status === 'online' ? 'bg-purple-500/5 border-purple-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${box.status === 'online' ? 'bg-purple-500/20' : 'bg-slate-700'}`}>
                        <Cpu className={`w-5 h-5 ${box.status === 'online' ? 'text-purple-400' : 'text-slate-500'}`} />
                      </div>
                      <div>
                        <p className="font-medium text-white">{box.name}</p>
                        <p className="text-xs text-slate-500">{box.location} • {box.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ConnectionBadge type={box.connectionType} strength={box.signalStrength} />
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${box.status === 'online' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {box.status}
                      </span>
                    </div>
                  </div>
                  
                  {/* Resource Usage */}
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">{box.cpuUsage}%</div>
                      <div className="text-xs text-slate-500">CPU</div>
                      <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full ${box.cpuUsage > 80 ? 'bg-red-500' : box.cpuUsage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${box.cpuUsage}%` }} />
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">{box.gpuUsage}%</div>
                      <div className="text-xs text-slate-500">GPU</div>
                      <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full ${box.gpuUsage > 80 ? 'bg-red-500' : box.gpuUsage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${box.gpuUsage}%` }} />
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">{box.memoryUsage}%</div>
                      <div className="text-xs text-slate-500">RAM</div>
                      <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full ${box.memoryUsage > 80 ? 'bg-red-500' : box.memoryUsage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${box.memoryUsage}%` }} />
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">{box.temperature}°</div>
                      <div className="text-xs text-slate-500">Temp</div>
                      <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full ${box.temperature > 70 ? 'bg-red-500' : box.temperature > 55 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${(box.temperature / 100) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                  
                  {/* Connected Devices */}
                  <div className="flex items-center justify-between text-sm border-t border-slate-700/50 pt-3">
                    <span className="text-slate-400">{box.connectedDevices} devices connected</span>
                    <span className="text-slate-400">{box.processingFps} FPS total</span>
                    <span className="text-slate-400">{box.latencyToCloud}ms to cloud</span>
                    <span className="text-green-400">Uptime: {box.uptime}</span>
                  </div>
                  
                  {/* Connected Streams */}
                  <div className="mt-3 pt-3 border-t border-slate-700/50">
                    <p className="text-xs text-slate-500 mb-2">Connected Devices:</p>
                    <div className="flex flex-wrap gap-2">
                      {mockStreams.filter(s => s.edgeBoxId === box.id).map(stream => (
                        <div key={stream.id} className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs ${stream.status === 'active' ? 'bg-slate-800' : 'bg-slate-800/50'}`}>
                          <DeviceIcon deviceType={stream.deviceType} className={`w-3 h-3 ${getDeviceColor(stream.deviceType)}`} />
                          <span className="text-slate-300">{stream.name.split(' ').slice(-1)}</span>
                          {stream.status === 'active' && <SignalStrength strength={stream.signalStrength} showLabel={false} />}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Datacenter Connection */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-400" />
              Cloud Datacenter
            </h3>
            <div className="bg-blue-500/5 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/20 rounded-lg">
                    <Database className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{datacenterInfo.name}</p>
                    <p className="text-sm text-slate-400">{datacenterInfo.location}</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium">
                  {datacenterInfo.status}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                  <p className="text-xl font-bold text-white">{datacenterInfo.connectedEdgeBoxes}</p>
                  <p className="text-xs text-slate-500">Edge Boxes</p>
                </div>
                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                  <p className="text-xl font-bold text-white">{datacenterInfo.directDevices}</p>
                  <p className="text-xs text-slate-500">Direct Devices</p>
                </div>
                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                  <p className="text-xl font-bold text-white">{datacenterInfo.currentLoad}%</p>
                  <p className="text-xs text-slate-500">Current Load</p>
                </div>
                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                  <p className="text-xl font-bold text-white">{datacenterInfo.latency}ms</p>
                  <p className="text-xs text-slate-500">Avg Latency</p>
                </div>
              </div>
            </div>
          </div>

          {/* All Devices with Network Info */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800">
              <h3 className="font-semibold text-white">All Devices - Network Status</h3>
            </div>
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Device</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Connection</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Signal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Processing</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Latency</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Bandwidth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {mockStreams.map(stream => (
                  <tr key={stream.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getDeviceBgColor(stream.deviceType, stream.status)}`}>
                          <DeviceIcon deviceType={stream.deviceType} className={`w-4 h-4 ${getDeviceColor(stream.deviceType)}`} />
                        </div>
                        <div>
                          <p className="font-medium text-white text-sm">{stream.name}</p>
                          <p className="text-xs text-slate-500">{stream.location}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ConnectionBadge type={stream.connectionType} strength={0} />
                    </td>
                    <td className="px-4 py-3">
                      {stream.status === 'active' ? (
                        <SignalStrength strength={stream.signalStrength} />
                      ) : (
                        <span className="text-slate-500 text-sm">Offline</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ProcessingBadge location={stream.processingLocation} edgeBoxId={stream.edgeBoxId} />
                    </td>
                    <td className="px-4 py-3">
                      {stream.status === 'active' ? (
                        <span className={`text-sm ${stream.latency < 20 ? 'text-green-400' : stream.latency < 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {stream.latency}ms
                        </span>
                      ) : (
                        <span className="text-slate-500 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {stream.status === 'active' ? (
                        <span className="text-sm text-slate-300">{stream.bandwidth} Mbps</span>
                      ) : (
                        <span className="text-slate-500 text-sm">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* GRID VIEW - Multiple live video feeds */}
      {/* ============================================ */}
      {viewMode === 'grid' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {(() => {
            const alertedDevices = streams.filter(s => s.hasActiveDetection && !s.alertAcknowledged)
              .sort((a, b) => (a.alertSeverity === 'critical' ? 0 : 1) - (b.alertSeverity === 'critical' ? 0 : 1));
            const nonAlerted = streams.filter(s => !(s.hasActiveDetection && !s.alertAcknowledged));
            // Interleave non-alerted: video and sensors for balanced columns
            const videoDevices = nonAlerted.filter(s => s.deviceType !== 'sensor');
            const sensorDevices = nonAlerted.filter(s => s.deviceType === 'sensor');
            const balanced = [];
            let vi = 0, si = 0;
            while (vi < videoDevices.length || si < sensorDevices.length) {
              if (vi < videoDevices.length) balanced.push(videoDevices[vi++]);
              if (vi < videoDevices.length) balanced.push(videoDevices[vi++]);
              if (si < sensorDevices.length) balanced.push(sensorDevices[si++]);
            }
            while (si < sensorDevices.length) balanced.push(sensorDevices[si++]);

            const renderCard = (stream) => {
              const needsAttention = stream.hasActiveDetection && !stream.alertAcknowledged;
              const isSensor = stream.deviceType === 'sensor';
              const isDrone = stream.deviceType === 'drone';
              const isCamera = stream.deviceType === 'camera';
              const riskColors = { low: 'text-green-400 bg-green-500/15 border-green-500/30', moderate: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30', high: 'text-orange-400 bg-orange-500/15 border-orange-500/30', extreme: 'text-red-400 bg-red-500/15 border-red-500/30' };
            
            return (
              <div
                key={stream.id}
                className={`rounded-lg overflow-hidden ${
                  needsAttention
                    ? 'ring-2 ring-red-500 animate-pulse'
                    : 'ring-1 ring-slate-700'
                }`}
              >
                {/* === VIDEO FEED for Drones & Cameras === */}
                {!isSensor && (
                  <div className="aspect-video bg-slate-900 relative">
                    {stream.status === 'active' ? (
                      <LiveDetectionView 
                        stream={stream} 
                        detections={streamDetections[stream.id] || []}
                        onClose={null}
                        onUpdateStream={handleUpdateStream}
                        onEmergency={(id) => { setSelectedStreamId(id); setShowDroneEmergency(true); }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                        <div className="text-center">
                          <DeviceIcon deviceType={stream.deviceType} className="w-8 h-8 text-slate-700 mx-auto mb-1" />
                          <span className="text-slate-600 text-xs">{stream.status}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Overlay: Stream number + device badge */}
                    <div className="absolute top-1 left-1 flex items-center gap-1 z-30">
                      <div className="w-5 h-5 bg-black/70 rounded flex items-center justify-center">
                        <span className="text-white text-xs font-mono">{stream.id}</span>
                      </div>
                      <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        isDrone ? 'bg-purple-500/80 text-white' : 'bg-blue-500/80 text-white'
                      }`}>
                        {isDrone ? '🚁 Drone' : '📹 Cam'}
                      </div>
                    </div>
                    
                    {/* Overlay: Alert badge */}
                    {needsAttention && (
                      <div className="absolute top-1 right-8 px-2 py-0.5 bg-red-500 rounded text-white text-xs font-bold z-30">
                        {stream.detectionType?.toUpperCase()}
                      </div>
                    )}

                    {/* Overlay: Camera mode badge */}
                    {stream.cameraCapabilities && stream.status === 'active' && (
                      <div className="absolute bottom-1 left-1 flex items-center gap-1 z-30">
                        <div className="px-1.5 py-0.5 bg-black/70 rounded text-[9px] text-slate-300 font-medium">
                          {stream.cameraCapabilities.activeMode?.toUpperCase()}
                          {stream.cameraCapabilities.currentZoom > 1 && ` ${stream.cameraCapabilities.currentZoom}x`}
                        </div>
                      </div>
                    )}

                    {/* Overlay: Drone battery + flight info */}
                    {isDrone && stream.status === 'active' && (
                      <div className="absolute bottom-1 right-1 flex items-center gap-1 z-30">
                        {stream.batteryLevel && (
                          <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 ${
                            stream.batteryLevel > 50 ? 'bg-green-500/80 text-white' : 
                            stream.batteryLevel > 20 ? 'bg-yellow-500/80 text-black' : 'bg-red-500/80 text-white'
                          }`}>
                            🔋 {stream.batteryLevel}%
                          </div>
                        )}
                        <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          stream.controlMode === 'manual' ? 'bg-cyan-500/80 text-white' : 'bg-orange-500/80 text-white'
                        }`}>
                          {stream.controlMode === 'manual' ? '👤 Human' : '🤖 AI'}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* === SENSOR COMPACT CARD (no video, smaller footprint) === */}
                {isSensor && (
                  <div className={`bg-slate-900 p-2 ${stream.status !== 'active' ? 'opacity-50' : ''}`}>
                    {/* Header: badge + name + status */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-5 h-5 bg-black/50 rounded flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-[9px] font-mono">{stream.id}</span>
                      </div>
                      <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
                        needsAttention ? 'bg-red-500' : 'bg-orange-500/20'
                      }`}>
                        {needsAttention ? (
                          <AlertTriangle className="w-3 h-3 text-white" />
                        ) : (
                          <Thermometer className="w-3 h-3 text-orange-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">{stream.name}</p>
                        <p className="text-slate-500 text-[9px]">{stream.type} · {stream.connectionType}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {stream.batteryLevel && (
                          <span className={`text-[9px] font-medium ${stream.batteryLevel > 50 ? 'text-green-400' : stream.batteryLevel > 20 ? 'text-yellow-400' : 'text-red-400'}`}>
                            🔋{stream.batteryLevel}%
                          </span>
                        )}
                        <div className={`w-1.5 h-1.5 rounded-full ${stream.status === 'active' ? 'bg-green-500' : stream.status === 'maintenance' ? 'bg-yellow-500' : 'bg-slate-500'}`} />
                      </div>
                    </div>

                    {/* Sensor readings - compact 2-col grid */}
                    {stream.status === 'active' && stream.sensorData ? (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mb-1.5">
                        {stream.sensorData.temp !== undefined && stream.sensorData.temp !== null && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-[9px] flex items-center gap-0.5"><Thermometer className="w-2.5 h-2.5 text-orange-400" />Temp</span>
                            <span className="text-orange-400 font-bold text-xs">{stream.sensorData.temp}°</span>
                          </div>
                        )}
                        {stream.sensorData.humidity !== undefined && stream.sensorData.humidity !== null && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-[9px] flex items-center gap-0.5"><Droplets className="w-2.5 h-2.5 text-blue-400" />Humid</span>
                            <span className="text-blue-400 font-bold text-xs">{stream.sensorData.humidity}%</span>
                          </div>
                        )}
                        {stream.sensorData.windSpeed !== undefined && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-[9px] flex items-center gap-0.5"><Wind className="w-2.5 h-2.5 text-cyan-400" />Wind</span>
                            <span className="text-cyan-400 font-bold text-xs">{stream.sensorData.windSpeed}<span className="text-[8px] text-slate-500">km/h</span></span>
                          </div>
                        )}
                        {stream.sensorData.pressure !== undefined && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-[9px] flex items-center gap-0.5"><Gauge className="w-2.5 h-2.5 text-purple-400" />Press</span>
                            <span className="text-purple-400 font-bold text-xs">{stream.sensorData.pressure}</span>
                          </div>
                        )}
                        {stream.sensorData.smokeLevel !== undefined && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-[9px] flex items-center gap-0.5"><Activity className="w-2.5 h-2.5 text-yellow-400" />Smoke</span>
                            <span className="text-yellow-400 font-bold text-xs">{stream.sensorData.smokeLevel}<span className="text-[8px] text-slate-500">ppm</span></span>
                          </div>
                        )}
                        {stream.sensorData.coLevel !== undefined && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-[9px] flex items-center gap-0.5"><AlertCircle className="w-2.5 h-2.5 text-red-400" />CO</span>
                            <span className="text-red-400 font-bold text-xs">{stream.sensorData.coLevel}<span className="text-[8px] text-slate-500">ppm</span></span>
                          </div>
                        )}
                        {stream.sensorData.soilMoisture !== undefined && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-[9px] flex items-center gap-0.5"><Droplets className="w-2.5 h-2.5 text-emerald-400" />Soil</span>
                            <span className="text-emerald-400 font-bold text-xs">{stream.sensorData.soilMoisture}%</span>
                          </div>
                        )}
                        {stream.sensorData.uvIndex !== undefined && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-[9px] flex items-center gap-0.5"><Sun className="w-2.5 h-2.5 text-yellow-300" />UV</span>
                            <span className="text-yellow-300 font-bold text-xs">{stream.sensorData.uvIndex}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-2 mb-1.5">
                        <span className="text-slate-600 text-[10px]">{stream.status}</span>
                      </div>
                    )}

                    {/* Fire risk + action row */}
                    <div className="flex items-center gap-1.5">
                      {stream.sensorData?.fireRisk && stream.status === 'active' ? (
                        <div className={`flex-1 flex items-center justify-between px-2 py-1 rounded border text-[9px] font-bold ${riskColors[stream.sensorData.fireRisk]}`}>
                          <div className="flex items-center gap-1">
                            <Flame className="w-2.5 h-2.5" />
                            <span>FIRE RISK</span>
                          </div>
                          <span className="uppercase">{stream.sensorData.fireRisk}</span>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded text-[9px]">
                          <div className={`w-1.5 h-1.5 rounded-full ${stream.connectionType === 'LoRa' ? 'bg-purple-400' : stream.connectionType === 'WiFi' ? 'bg-blue-400' : 'bg-green-400'}`} />
                          <span className="text-slate-500">{stream.connectionType} · {stream.latency}ms</span>
                        </div>
                      )}
                      {needsAttention ? (
                        <button
                          onClick={() => handleAcknowledge(stream.id)}
                          className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white font-bold rounded text-[10px] flex items-center gap-1"
                        >
                          <CheckCircle className="w-2.5 h-2.5" />
                          ACK
                        </button>
                      ) : (
                        <button
                          onClick={() => { setSelectedStreamId(stream.id); setViewMode('operator'); }}
                          className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[10px] flex items-center gap-1"
                        >
                          <Eye className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Compact Control Bar - for drones & cameras only */}
                {!isSensor && (
                <div className="p-1.5 bg-slate-800 space-y-1.5">
                  {/* Name + Status Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DeviceIcon deviceType={stream.deviceType} className={`w-4 h-4 ${getDeviceColor(stream.deviceType)}`} />
                      <span className="text-white text-sm font-medium truncate max-w-32">{stream.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isDrone && stream.batteryLevel && (
                        <BatteryIndicator level={stream.batteryLevel} />
                      )}
                      {isCamera && stream.signalStrength && (
                        <SignalStrength strength={stream.signalStrength} showLabel={false} />
                      )}
                      <div className={`w-2 h-2 rounded-full ${stream.status === 'active' ? 'bg-green-500' : stream.status === 'maintenance' ? 'bg-yellow-500' : 'bg-slate-500'}`} />
                    </div>
                  </div>
                  
                  {/* Drone-specific: Control Toggle */}
                  {isDrone && stream.status === 'active' && (
                    <div className="flex items-center bg-slate-900 rounded p-0.5">
                      <button
                        onClick={() => stream.controlMode !== 'watchtower' && handleToggleControlMode(stream.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-all ${
                          stream.controlMode === 'watchtower'
                            ? 'bg-orange-500 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Flame className="w-3 h-3" />
                        AI
                      </button>
                      <button
                        onClick={() => stream.controlMode !== 'manual' && handleToggleControlMode(stream.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-all ${
                          stream.controlMode === 'manual'
                            ? 'bg-cyan-500 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <User className="w-3 h-3" />
                        Human
                      </button>
                    </div>
                  )}

                  {/* Camera-specific: Mode + Zoom row */}
                  {isCamera && stream.status === 'active' && stream.cameraCapabilities && (
                    <div className="flex items-center gap-1 bg-slate-900 rounded p-1">
                      {stream.cameraCapabilities.modes.map(mode => {
                        const isActive = stream.cameraCapabilities.activeMode === mode;
                        const modeLabels = { visual: '📷', thermal: '🌡️', nightvision: '🌙', split: '⊞', pip: '⧉' };
                        return (
                          <button
                            key={mode}
                            onClick={() => handleUpdateStream(stream.id, {
                              cameraCapabilities: { ...stream.cameraCapabilities, activeMode: mode }
                            })}
                            className={`flex-1 py-1 rounded text-[10px] font-medium text-center transition-all ${
                              isActive ? 'bg-blue-500 text-white' : 'text-slate-500 hover:text-white hover:bg-slate-700'
                            }`}
                            title={mode}
                          >
                            {modeLabels[mode] || mode.charAt(0).toUpperCase()} {isActive ? mode.charAt(0).toUpperCase() + mode.slice(1, 4) : ''}
                          </button>
                        );
                      })}
                      {stream.cameraCapabilities.hasZoom && (
                        <div className="flex items-center gap-0.5 px-1.5 bg-slate-800 rounded">
                          <span className="text-[10px] text-slate-400 font-mono">{stream.cameraCapabilities.currentZoom}x</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Action Row */}
                  <div className="flex gap-2">
                    {needsAttention ? (
                      <button
                        onClick={() => handleAcknowledge(stream.id)}
                        className="flex-1 py-1.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded text-xs flex items-center justify-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        ACKNOWLEDGE
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setFullscreenStreamId(stream.id)}
                          className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs flex items-center justify-center gap-1"
                        >
                          <Maximize2 className="w-3 h-3" />
                          Full
                        </button>
                        <button
                          onClick={() => {
                            setSelectedStreamId(stream.id);
                            setViewMode('operator');
                          }}
                          className="py-1.5 px-3 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                        {isDrone && stream.status === 'active' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStreamId(stream.id);
                              setShowDroneEmergency(true);
                            }}
                            className="py-1.5 px-2 bg-red-500/15 hover:bg-red-500/30 border border-red-500/40 text-red-400 rounded text-xs"
                            title="Emergency"
                          >
                            <AlertTriangle className="w-3 h-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                )}
              </div>
            );
            };

            const allSorted = [...alertedDevices, ...balanced];
            const videoItems = allSorted.filter(s => s.deviceType !== 'sensor');
            const sensorItems = allSorted.filter(s => s.deviceType === 'sensor');
            const gridStyle = { gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' };

            return (
              <div className="flex flex-col gap-1.5">
                {videoItems.length > 0 && (
                  <div className="grid gap-1.5" style={gridStyle}>
                    {videoItems.map(s => renderCard(s))}
                  </div>
                )}
                {sensorItems.length > 0 && (
                  <div className="grid gap-1.5" style={gridStyle}>
                    {sensorItems.map(s => renderCard(s))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ============================================ */}
      {/* LIST VIEW - Quick status overview */}
      {/* ============================================ */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search devices..."
                    value={listFilters.search}
                    onChange={(e) => setListFilters({...listFilters, search: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>
              
              {/* Device Type Filter */}
              <div>
                <select
                  value={listFilters.deviceType}
                  onChange={(e) => setListFilters({...listFilters, deviceType: e.target.value})}
                  className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none"
                >
                  <option value="all">All Types</option>
                  <option value="drone">🚁 Drones</option>
                  <option value="camera">📹 Cameras</option>
                  <option value="sensor">🌡️ Sensors</option>
                </select>
              </div>
              
              {/* Status Filter */}
              <div>
                <select
                  value={listFilters.status}
                  onChange={(e) => setListFilters({...listFilters, status: e.target.value})}
                  className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="active">🟢 Active</option>
                  <option value="maintenance">🟡 Maintenance</option>
                  <option value="inactive">⚫ Inactive</option>
                </select>
              </div>
              
              {/* Alerts Only Toggle */}
              <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg hover:border-slate-600">
                <input
                  type="checkbox"
                  checked={listFilters.alertsOnly}
                  onChange={(e) => setListFilters({...listFilters, alertsOnly: e.target.checked})}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-red-500 focus:ring-red-500"
                />
                <span className="text-sm text-slate-300">🔥 Alerts Only</span>
              </label>
              
              {/* Clear Filters */}
              {(listFilters.search || listFilters.deviceType !== 'all' || listFilters.status !== 'all' || listFilters.alertsOnly) && (
                <button
                  onClick={() => setListFilters({ search: '', deviceType: 'all', status: 'all', alertsOnly: false })}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Clear
                </button>
              )}
              
              {/* Results Count */}
              <div className="text-sm text-slate-400">
                {filteredStreams.length} of {streams.length} devices
              </div>
            </div>
          </div>
          
          {/* Device Table */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase w-8">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Device</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Mode / Data</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Connection</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredStreams.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                    No devices match the current filters
                  </td>
                </tr>
              ) : (
              filteredStreams.map((stream, index) => {
                const needsAttention = stream.hasActiveDetection && !stream.alertAcknowledged;
                const isDrone = stream.deviceType === 'drone';
                const isCamera = stream.deviceType === 'camera';
                const isSensor = stream.deviceType === 'sensor';
                const riskColors = { low: 'text-green-400', moderate: 'text-yellow-400', high: 'text-orange-400', extreme: 'text-red-400' };
                
                return (
                  <tr 
                    key={stream.id}
                    onClick={() => {
                      setSelectedStreamId(stream.id);
                      setViewMode('operator');
                    }}
                    className={`cursor-pointer transition-all ${
                      needsAttention 
                        ? 'bg-red-500/20 hover:bg-red-500/30' 
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="text-slate-500 font-mono">{index + 1}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          needsAttention ? 'bg-red-500' : getDeviceBgColor(stream.deviceType, stream.status)
                        }`}>
                          {needsAttention ? (
                            <AlertTriangle className="w-4 h-4 text-white" />
                          ) : (
                            <DeviceIcon deviceType={stream.deviceType} className={`w-4 h-4 ${getDeviceColor(stream.deviceType)}`} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium">{stream.name}</p>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              isDrone ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                              isCamera ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                              'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            }`}>
                              {stream.deviceType}
                            </span>
                          </div>
                          <p className="text-slate-500 text-xs">{stream.type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {needsAttention ? (
                        <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded animate-pulse">
                          {stream.detectionType?.toUpperCase()}
                        </span>
                      ) : (
                        <StatusBadge status={stream.status} />
                      )}
                    </td>
                    {/* Mode / Data column - device-specific */}
                    <td className="px-4 py-3">
                      {isDrone ? (
                        <div className="flex flex-col gap-1">
                          <ControlModeBadge mode={stream.controlMode} pilot={stream.pilot} />
                          {stream.batteryLevel && (
                            <span className={`text-xs font-medium ${stream.batteryLevel > 50 ? 'text-green-400' : stream.batteryLevel > 20 ? 'text-yellow-400' : 'text-red-400'}`}>
                              🔋 {stream.batteryLevel}%{stream.flightTime ? ` · ${stream.flightTime}` : ''}
                            </span>
                          )}
                        </div>
                      ) : isCamera ? (
                        <div className="flex flex-col gap-1">
                          {stream.cameraCapabilities ? (
                            <>
                              <span className="text-blue-400 text-xs font-medium">
                                {stream.cameraCapabilities.activeMode?.charAt(0).toUpperCase() + stream.cameraCapabilities.activeMode?.slice(1)}
                                {stream.cameraCapabilities.currentZoom > 1 ? ` · ${stream.cameraCapabilities.currentZoom}x` : ''}
                              </span>
                              <span className="text-slate-500 text-xs">
                                {stream.cameraCapabilities.hasPTZ ? 'PTZ' : 'Fixed'}
                                {stream.cameraCapabilities.modes.length > 1 ? ` · ${stream.cameraCapabilities.modes.length} modes` : ''}
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-500 text-xs">Standard</span>
                          )}
                        </div>
                      ) : isSensor && stream.sensorData ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2 text-xs">
                            {stream.sensorData.temp !== undefined && stream.sensorData.temp !== null && (
                              <span className="text-orange-400">{stream.sensorData.temp}°C</span>
                            )}
                            {stream.sensorData.humidity !== undefined && stream.sensorData.humidity !== null && (
                              <span className="text-blue-400">{stream.sensorData.humidity}%</span>
                            )}
                            {stream.sensorData.windSpeed !== undefined && (
                              <span className="text-cyan-400">{stream.sensorData.windSpeed}km/h</span>
                            )}
                          </div>
                          {stream.sensorData.fireRisk && (
                            <span className={`text-xs font-bold uppercase ${riskColors[stream.sensorData.fireRisk]}`}>
                              🔥 {stream.sensorData.fireRisk}
                            </span>
                          )}
                          {stream.sensorData.smokeLevel !== undefined && (
                            <span className="text-yellow-400 text-xs">Smoke: {stream.sensorData.smokeLevel}ppm</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">-</span>
                      )}
                    </td>
                    {/* Connection column */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <SignalStrength strength={stream.signalStrength} />
                        <span className="text-slate-500 text-xs">{stream.connectionType} · {stream.latency}ms</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {needsAttention ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcknowledge(stream.id);
                            }}
                            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg text-xs"
                          >
                            ACKNOWLEDGE
                          </button>
                        ) : (
                          <>
                            {!isSensor && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFullscreenStreamId(stream.id);
                                }}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs"
                              >
                                View
                              </button>
                            )}
                            {isSensor && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedStreamId(stream.id);
                                  setViewMode('operator');
                                }}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs"
                              >
                                Details
                              </button>
                            )}
                            {isDrone && stream.status === 'active' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedStreamId(stream.id);
                                  setShowDroneEmergency(true);
                                }}
                                className="px-2 py-1.5 bg-red-500/15 hover:bg-red-500/30 border border-red-500/40 text-red-400 rounded-lg text-xs"
                                title="Emergency"
                              >
                                <AlertTriangle className="w-3 h-3" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* FULLSCREEN MODAL - Simple, quick to close */}
      {/* ============================================ */}
      {fullscreenStream && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col" style={{ width: '100vw', height: '100vh' }}>
          {/* Close controls - Top Right */}
          <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
            {fullscreenStream.hasActiveDetection && !fullscreenStream.alertAcknowledged && (
              <button 
                onClick={() => {
                  handleAcknowledge(fullscreenStream.id);
                }}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 rounded-xl text-white font-bold text-lg flex items-center gap-2"
              >
                <CheckCircle className="w-6 h-6" />
                ACKNOWLEDGE
              </button>
            )}
            <button 
              onClick={() => setFullscreenStreamId(null)}
              className="p-4 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all"
            >
              <X className="w-8 h-8" />
            </button>
          </div>
          
          {/* Stream name - Top Left */}
          <div className="absolute top-4 left-4 z-40">
            <div className="flex items-center gap-3 px-4 py-2 bg-black/50 rounded-xl">
              <DeviceIcon deviceType={fullscreenStream.deviceType} className="w-6 h-6 text-white" />
              <span className="text-white font-bold text-lg">{fullscreenStream.name}</span>
              {fullscreenStream.hasActiveDetection && !fullscreenStream.alertAcknowledged && (
                <span className="px-3 py-1 bg-red-500 text-white font-bold rounded-lg animate-pulse">
                  {fullscreenStream.detectionType?.toUpperCase()}
                </span>
              )}
            </div>
          </div>
          
          {/* Video - absolute fill */}
          <div className="absolute inset-0">
            <LiveDetectionView 
              stream={fullscreenStream} 
              detections={streamDetections[fullscreenStream.id] || []}
              onClose={() => setFullscreenStreamId(null)}
              isFullscreen={true}
              onUpdateStream={handleUpdateStream}
              onEmergency={(id) => { setSelectedStreamId(id); setShowDroneEmergency(true); }}
            />
          </div>
          
          {/* ESC hint - above HUD */}
          <div className="absolute bottom-28 right-4 z-40">
            <div className="px-3 py-1.5 bg-black/40 rounded-lg">
              <span className="text-slate-400 text-xs">ESC to close</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Drone Emergency Modal for Operators */}
      {showDroneEmergency && selectedStream && selectedStream.deviceType === 'drone' && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border-2 border-red-500 rounded-xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl shadow-red-500/20">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-red-500/20 border-b border-red-500/50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center animate-pulse">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase">Drone Emergency</h3>
                  <p className="text-xs text-red-300">{selectedStream.name}</p>
                </div>
              </div>
              <button onClick={() => setShowDroneEmergency(false)} className="p-1.5 hover:bg-red-500/30 rounded-lg">
                <X className="w-5 h-5 text-red-300" />
              </button>
            </div>
            
            {/* Drone Status */}
            <div className="p-4 border-b border-slate-700 bg-slate-800/50">
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="p-2 bg-slate-900 rounded-lg">
                  <p className="text-slate-500 text-xs">Battery</p>
                  <p className={`text-lg font-bold ${selectedStream.batteryLevel > 50 ? 'text-green-400' : selectedStream.batteryLevel > 20 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {selectedStream.batteryLevel}%
                  </p>
                </div>
                <div className="p-2 bg-slate-900 rounded-lg">
                  <p className="text-slate-500 text-xs">Altitude</p>
                  <p className="text-lg font-bold text-white">{selectedStream.altitude}</p>
                </div>
                <div className="p-2 bg-slate-900 rounded-lg">
                  <p className="text-slate-500 text-xs">Control</p>
                  <p className={`text-lg font-bold ${selectedStream.controlMode === 'watchtower' ? 'text-orange-400' : 'text-cyan-400'}`}>
                    {selectedStream.controlMode === 'watchtower' ? 'AI' : 'Manual'}
                  </p>
                </div>
                <div className="p-2 bg-slate-900 rounded-lg">
                  <p className="text-slate-500 text-xs">Signal</p>
                  <p className="text-lg font-bold text-white">{selectedStream.signalStrength}%</p>
                </div>
              </div>
            </div>
            
            {/* Emergency Actions Grid */}
            <div className="p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-3">Emergency Actions</p>
              <div className="grid grid-cols-2 gap-3">
                {droneEmergencyActions.map(action => {
                  const IconComponent = action.icon;
                  return (
                    <button
                      key={action.id}
                      onClick={() => handleDroneEmergency(action)}
                      className={`p-4 rounded-xl border-2 transition-all text-left hover:scale-[1.02] ${
                        action.color === 'red' ? 'bg-red-500/20 border-red-500/50 hover:bg-red-500/30' :
                        action.color === 'yellow' ? 'bg-yellow-500/20 border-yellow-500/50 hover:bg-yellow-500/30' :
                        action.color === 'cyan' ? 'bg-cyan-500/20 border-cyan-500/50 hover:bg-cyan-500/30' :
                        action.color === 'blue' ? 'bg-blue-500/20 border-blue-500/50 hover:bg-blue-500/30' :
                        action.color === 'purple' ? 'bg-purple-500/20 border-purple-500/50 hover:bg-purple-500/30' :
                        'bg-orange-500/20 border-orange-500/50 hover:bg-orange-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <IconComponent className={`w-5 h-5 ${
                          action.color === 'red' ? 'text-red-400' :
                          action.color === 'yellow' ? 'text-yellow-400' :
                          action.color === 'cyan' ? 'text-cyan-400' :
                          action.color === 'blue' ? 'text-blue-400' :
                          action.color === 'purple' ? 'text-purple-400' :
                          'text-orange-400'
                        }`} />
                        <span className={`font-bold text-sm ${
                          action.color === 'red' ? 'text-red-400' :
                          action.color === 'yellow' ? 'text-yellow-400' :
                          action.color === 'cyan' ? 'text-cyan-400' :
                          action.color === 'blue' ? 'text-blue-400' :
                          action.color === 'purple' ? 'text-purple-400' :
                          'text-orange-400'
                        }`}>{action.label}</span>
                      </div>
                      <p className="text-xs text-slate-400">{action.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-slate-700 bg-slate-800/50">
              <button
                onClick={() => setShowDroneEmergency(false)}
                className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

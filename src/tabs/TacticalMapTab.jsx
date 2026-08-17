import React, { useState, useEffect, useRef } from 'react';
import {
  Video, Users, Settings, AlertTriangle, Clock, Plus, Eye, Pause, Thermometer, Camera, Flame, CheckCircle, Zap, XCircle, X, FileText, MapPin, Download, Edit, Shield, RefreshCw, ChevronRight, ChevronLeft, Activity, Target, Radio, ArrowUpRight, ArrowDownRight, Copy, Maximize2, Minimize2, Grid, List, User, Battery, Navigation, Layers, Map, Upload, Crosshair, Circle, Square, Triangle, Wind, Droplets, Sun, Compass, Ruler, ZoomIn, ZoomOut, RotateCcw, ExternalLink, Satellite, Info, Flag, Home, Truck, Plane, Send
} from 'lucide-react';
import TacticalMap from '../components/TacticalMap';
import { C } from '../data/collaboratorData';
import { mockStreams } from '../data/streams';
import { useDevices } from '../hooks/useDevices';
import { usePositions } from '../hooks/usePositions';
import { useTeam } from '../hooks/useTeam';
import { useMarkers, MARKER_KINDS, markerMeta } from '../hooks/useMarkers';


// ============================================
// TACTICAL MAP TAB
// ============================================

export const TacticalMapTab = () => {
  const { isLive, devices } = useDevices();
  const { latest: teamPositions } = usePositions();
  const { liveMembers } = useTeam();
  const { markers: liveMarkers, createMarker, updateMarker, removeMarker } = useMarkers();
  const [myPos, setMyPos] = useState(null);
  const [zeroKey, setZeroKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [markerPanelOpen, setMarkerPanelOpen] = useState(false);
  const [markerBusy, setMarkerBusy] = useState(false);
  const cameraCenterRef = useRef(null);

  // Live mode: open the map on the user's own area right away —
  // rescuers need their surroundings even before anything is registered.
  useEffect(() => {
    if (!isLive || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setMyPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setZeroKey(k => k + 1);
      },
      () => { /* denied — map falls back to fleet/world view */ },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);
  const [mapMode, setMapMode] = useState('satellite'); // satellite, roadmap, terrain, hybrid
  const [showDevices, setShowDevices] = useState(true);
  const [showGeofences, setShowGeofences] = useState(true);
  const [showWeather, setShowWeather] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showFlightPaths, setShowFlightPaths] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [mapTool, setMapTool] = useState('select'); // select, measure, geofence, marker, path
  const [sidePanel, setSidePanel] = useState('devices'); // devices, drones, layers, geofences, markers, weather
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [popoutWindow, setPopoutWindow] = useState(null);
  
  // Map Navigation State
  const [mapZoom, setMapZoom] = useState(14);
  const [mapCenter, setMapCenter] = useState({ lat: 43.2141, lng: 2.3522 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [isMapFocused, setIsMapFocused] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const mapRef = React.useRef(null);
  
  // Device View State (picture-in-picture style)
  const [showDeviceView, setShowDeviceView] = useState(false);
  const [deviceViewSize, setDeviceViewSize] = useState('medium'); // small, medium, large
  const [deviceViewPosition, setDeviceViewPosition] = useState('bottom-right'); // top-left, top-right, bottom-left, bottom-right
  
  // Drone Control State
  const [showDroneControl, setShowDroneControl] = useState(false);
  const [selectedDrones, setSelectedDrones] = useState([]); // Multi-select drones
  const [showEmergencyPanel, setShowEmergencyPanel] = useState(false);
  const [showPathEditor, setShowPathEditor] = useState(false);
  const [showTargetAssignment, setShowTargetAssignment] = useState(false);

  // ============================================
  // FIELD INTELLIGENCE SYSTEM
  // ============================================
  const [fieldCollaborators, setFieldCollaborators] = useState([]);
  const [fieldReports, setFieldReports] = useState([]);
  const [actionAssignments, setActionAssignments] = useState([]);
  const [showFieldCollaborators, setShowFieldCollaborators] = useState(true);
  const [showFieldReports, setShowFieldReports] = useState(true);
  const [selectedFieldReport, setSelectedFieldReport] = useState(null);
  const [showAssignAction, setShowAssignAction] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null); // marker or report being assigned
  const [reportFilter, setReportFilter] = useState('all'); // all, critical, high, normal, new

  // Listen for field collaborator joins
  useEffect(() => {
    const handleJoin = (e) => {
      setFieldCollaborators(prev => {
        if (prev.find(c => c.id === e.detail.id)) return prev;
        return [...prev, e.detail];
      });
    };
    const handleReport = (e) => {
      setFieldReports(prev => [e.detail, ...prev]);
    };
    const handleStatus = (e) => {
      setFieldCollaborators(prev => prev.map(c => c.id === e.detail.id ? { ...c, lastStatus: e.detail.status } : c));
    };
    window.addEventListener('watchtower-collaborator-join', handleJoin);
    window.addEventListener('watchtower-field-report', handleReport);
    window.addEventListener('watchtower-collaborator-status', handleStatus);
    return () => {
      window.removeEventListener('watchtower-collaborator-join', handleJoin);
      window.removeEventListener('watchtower-field-report', handleReport);
      window.removeEventListener('watchtower-collaborator-status', handleStatus);
    };
  }, []);

  // Assign a collaborator to a target (marker/report/coordinates)
  const handleAssignAction = (collaboratorId, target, actionType) => {
    setActionAssignments(prev => [...prev, {
      id: Date.now(),
      collaboratorId,
      target,
      actionType,
      status: 'dispatched',
      assignedAt: new Date().toLocaleTimeString(),
    }]);
    setFieldCollaborators(prev => prev.map(c => c.id === collaboratorId ? { ...c, lastStatus: 'moving', assignedTo: target.name || target.type } : c));
    setShowAssignAction(false);
    setAssignTarget(null);
  };

  // Acknowledge a field report
  const acknowledgeReport = (reportId) => {
    setFieldReports(prev => prev.map(r => r.id === reportId ? { ...r, acknowledged: true, status: 'acknowledged' } : r));
  };

  // Field report type metadata
  const reportTypeMeta = {
    fire: { icon: '🔥', label: 'Fire/Smoke', color: '#ef4444' },
    chemical: { icon: '☣️', label: 'Chemical', color: '#e11d48' },
    radioactive: { icon: '☢️', label: 'Radioactive', color: '#facc15' },
    chemwaste: { icon: '🧪', label: 'Chemical Waste', color: '#84cc16' },
    armed: { icon: '🚫', label: 'Armed Conflict', color: '#dc2626' },
    injured: { icon: '🩹', label: 'Injured', color: '#f59e0b' },
    accident: { icon: '🚗', label: 'Accident', color: '#f97316' },
    blocked: { icon: '🚧', label: 'Road Blocked', color: '#f97316' },
    hazard: { icon: '⚠️', label: 'Hazard', color: '#a855f7' },
    resource: { icon: '💧', label: 'Resource', color: '#3b82f6' },
    other: { icon: '📢', label: 'Other', color: '#64748b' },
    medical: { icon: '⛑️', label: 'Medical Team', color: '#ef4444' },
    fire_crew: { icon: '🚒', label: 'Fire Crew', color: '#f97316' },
    water: { icon: '🚛', label: 'Water Tanker', color: '#3b82f6' },
    hazmat: { icon: '☣️', label: 'HAZMAT', color: '#84cc16' },
    air: { icon: '🚁', label: 'Air Support', color: '#8b5cf6' },
    evac: { icon: '🚌', label: 'Evacuation', color: '#a855f7' },
    medevac: { icon: '🏥', label: 'Medevac', color: '#dc2626' },
    police: { icon: '🚔', label: 'Law Enforcement', color: '#3b82f6' },
    engineer: { icon: '🏗️', label: 'Engineering', color: '#f59e0b' },
    comms: { icon: '📡', label: 'Communications', color: '#f97316' },
    supply: { icon: '📦', label: 'Supplies', color: '#64748b' },
  };

  const roleIcons = { responder: '🚒', volunteer: '🤝', pilot: '🛩️', coordinator: '📋', agency: '🏛️', medical: '⚕️' };
  const roleColors = { responder: '#ef4444', volunteer: '#22c55e', pilot: '#a855f7', coordinator: '#f97316', agency: '#3b82f6', medical: '#ec4899' };
  const roleLabels = { responder: 'First Responder', volunteer: 'Volunteer', pilot: 'Drone Pilot', coordinator: 'Coordinator', agency: 'Partner Agency', medical: 'Medical' };
  const statusColors = { ok: '#22c55e', moving: '#3b82f6', 'need-water': '#f59e0b', 'need-help': '#ef4444', evacuating: '#a855f7', emergency: '#dc2626' };

  const filteredReports = reportFilter === 'all' ? fieldReports : reportFilter === 'new' ? fieldReports.filter(r => !r.acknowledged) : fieldReports.filter(r => r.priority === reportFilter);
  
  // Drone fleet data with enhanced control info
  const [droneFleet, setDroneFleet] = useState([
    { 
      id: 1, 
      name: 'Drone M3T Carcassonne', 
      status: 'active',
      mode: 'autonomous', // autonomous, manual, emergency, standby, rtb
      emergencyState: null, // null, 'halt', 'standby', 'rtb', 'manual_wait'
      pilot: null,
      batteryLevel: 78,
      altitude: '120m',
      speed: '45 km/h',
      heading: 'NE',
      location: { lat: 43.2141, lng: 2.3522 },
      homeBase: { lat: 43.2100, lng: 2.3500, name: 'Base Alpha' },
      currentMission: 'Patrol Route A',
      assignedTarget: null,
      flightPath: [
        { lat: 43.2141, lng: 2.3522, altitude: 120, action: 'start' },
        { lat: 43.2180, lng: 2.3550, altitude: 150, action: 'waypoint' },
        { lat: 43.2200, lng: 2.3600, altitude: 150, action: 'loiter', duration: 60 },
        { lat: 43.2141, lng: 2.3522, altitude: 120, action: 'return' },
      ],
      eta: '12 min',
      distanceFromBase: '1.2 km'
    },
    { 
      id: 2, 
      name: 'Drone M30T Narbonne', 
      status: 'active',
      mode: 'manual',
      emergencyState: null,
      pilot: 'Jean Dupont',
      batteryLevel: 65,
      altitude: '85m',
      speed: '30 km/h',
      heading: 'SW',
      location: { lat: 43.2098, lng: 2.3455 },
      homeBase: { lat: 43.2050, lng: 2.3400, name: 'Base Bravo' },
      currentMission: 'Manual Inspection',
      assignedTarget: null,
      flightPath: [],
      eta: '-',
      distanceFromBase: '0.8 km'
    },
    { 
      id: 3, 
      name: 'Drone H20T Limoux', 
      status: 'active',
      mode: 'autonomous',
      emergencyState: null,
      pilot: null,
      batteryLevel: 92,
      altitude: '200m',
      speed: '55 km/h',
      heading: 'N',
      location: { lat: 43.2200, lng: 2.3600 },
      homeBase: { lat: 43.2100, lng: 2.3500, name: 'Base Alpha' },
      currentMission: 'Fire Watch Sector 3',
      assignedTarget: { id: 4, name: 'Hazard - Downed Lines', type: 'marker' },
      flightPath: [
        { lat: 43.2200, lng: 2.3600, altitude: 200, action: 'start' },
        { lat: 43.2120, lng: 2.3480, altitude: 150, action: 'target', targetId: 4 },
        { lat: 43.2120, lng: 2.3480, altitude: 100, action: 'loiter', duration: 300 },
      ],
      eta: '3 min',
      distanceFromBase: '1.5 km'
    },
  ]);
  
  // Emergency actions configuration
  const emergencyActions = [
    { 
      id: 'halt', 
      label: 'EMERGENCY HALT', 
      icon: Pause, 
      color: 'red',
      description: 'Immediately stop and hover in place',
      confirmRequired: false 
    },
    { 
      id: 'standby', 
      label: 'STANDBY MODE', 
      icon: Clock, 
      color: 'yellow',
      description: 'Stop current mission, hover and await instructions',
      confirmRequired: false 
    },
    { 
      id: 'manual_wait', 
      label: 'AWAIT MANUAL', 
      icon: User, 
      color: 'cyan',
      description: 'Stop and wait for pilot to take manual control',
      confirmRequired: false 
    },
    { 
      id: 'rtb', 
      label: 'RETURN TO BASE', 
      icon: Home, 
      color: 'blue',
      description: 'Abort mission and return to home base',
      confirmRequired: true 
    },
    { 
      id: 'goto_marker', 
      label: 'GO TO MARKER', 
      icon: MapPin, 
      color: 'purple',
      description: 'Navigate to selected marker location',
      confirmRequired: false 
    },
    { 
      id: 'land_immediate', 
      label: 'LAND NOW', 
      icon: ArrowDownRight, 
      color: 'orange',
      description: 'Emergency landing at current position',
      confirmRequired: true 
    },
  ];
  
  // Handle emergency action
  const handleEmergencyAction = (action, droneIds = selectedDrones) => {
    if (action.confirmRequired && !confirm(`Confirm ${action.label} for ${droneIds.length} drone(s)?`)) {
      return;
    }
    
    setDroneFleet(prev => prev.map(drone => {
      if (droneIds.includes(drone.id)) {
        return {
          ...drone,
          emergencyState: action.id,
          mode: action.id === 'manual_wait' ? 'manual' : 'emergency',
          speed: action.id === 'halt' ? '0 km/h' : drone.speed,
          currentMission: action.label,
        };
      }
      return drone;
    }));
    
    // Show confirmation
    alert(`${action.label} executed for ${droneIds.length} drone(s)`);
  };
  
  // Handle drone selection toggle
  const toggleDroneSelection = (droneId) => {
    setSelectedDrones(prev => 
      prev.includes(droneId) 
        ? prev.filter(id => id !== droneId)
        : [...prev, droneId]
    );
  };
  
  // Select all drones
  const selectAllDrones = () => {
    setSelectedDrones(droneFleet.map(d => d.id));
  };
  
  // Clear drone selection
  const clearDroneSelection = () => {
    setSelectedDrones([]);
  };
  
  // Assign target to drones
  const assignTargetToDrones = (target, droneIds) => {
    setDroneFleet(prev => prev.map(drone => {
      if (droneIds.includes(drone.id)) {
        return {
          ...drone,
          assignedTarget: target,
          currentMission: `En route to: ${target.name}`,
          flightPath: [
            { ...drone.location, altitude: parseInt(drone.altitude), action: 'start' },
            { lat: parseFloat(target.lat), lng: parseFloat(target.lng), altitude: 100, action: 'target', targetId: target.id },
            { lat: parseFloat(target.lat), lng: parseFloat(target.lng), altitude: 50, action: 'loiter', duration: 300 },
          ]
        };
      }
      return drone;
    }));
    setShowTargetAssignment(false);
  };
  
  // Resume normal operations
  const resumeNormalOps = (droneId) => {
    setDroneFleet(prev => prev.map(drone => {
      if (drone.id === droneId) {
        return {
          ...drone,
          emergencyState: null,
          mode: 'autonomous',
          currentMission: 'Resuming patrol',
        };
      }
      return drone;
    }));
  };
  
  // Marker System State
  const [showMarkerEditor, setShowMarkerEditor] = useState(false);
  const [editingMarker, setEditingMarker] = useState(null);
  const [markerPickMode, setMarkerPickMode] = useState(false);
  const [markers, setMarkers] = useState([
    { id: 1, name: 'Command Post Alpha', type: 'command', icon: 'flag', color: '#f97316', lat: '43.2155', lng: '2.3510', notes: 'Primary command location', createdBy: 'Cpt. Dupont', createdAt: '2024-01-15 08:30', priority: 'high' },
    { id: 2, name: 'Water Point 1', type: 'resource', icon: 'droplet', color: '#3b82f6', lat: '43.2098', lng: '2.3455', notes: 'Lake access for water pickup', createdBy: 'Lt. Martin', createdAt: '2024-01-15 09:15', priority: 'normal' },
    { id: 3, name: 'Evacuation Assembly', type: 'evacuation', icon: 'users', color: '#22c55e', lat: '43.2180', lng: '2.3600', notes: 'Civilian assembly point', createdBy: 'Sgt. Bernard', createdAt: '2024-01-15 09:45', priority: 'high' },
    { id: 4, name: 'Hazard - Downed Lines', type: 'hazard', icon: 'alert', color: '#ef4444', lat: '43.2120', lng: '2.3480', notes: 'Power lines down - DANGER', createdBy: 'Cpt. Dupont', createdAt: '2024-01-15 10:00', priority: 'critical' },
    { id: 5, name: 'Staging Area B', type: 'staging', icon: 'truck', color: '#8b5cf6', lat: '43.2200', lng: '2.3550', notes: 'Vehicle staging for sector 2', createdBy: 'Lt. Martin', createdAt: '2024-01-15 10:30', priority: 'normal' },
  ]);
  const [newMarker, setNewMarker] = useState({
    name: '',
    type: 'waypoint',
    icon: 'pin',
    color: '#f97316',
    lat: '',
    lng: '',
    notes: '',
    priority: 'normal',
    temporary: false,
    expiresAt: '',
    visibleToAll: true,
  });
  
  // Marker types configuration
  const markerTypes = [
    { id: 'waypoint', label: 'Waypoint', icon: 'pin', color: '#f97316' },
    { id: 'command', label: 'Command Post', icon: 'flag', color: '#f97316' },
    { id: 'resource', label: 'Resource Point', icon: 'droplet', color: '#3b82f6' },
    { id: 'hazard', label: 'Hazard/Danger', icon: 'alert', color: '#ef4444' },
    { id: 'evacuation', label: 'Evacuation Point', icon: 'users', color: '#22c55e' },
    { id: 'staging', label: 'Staging Area', icon: 'truck', color: '#8b5cf6' },
    { id: 'medical', label: 'Medical Station', icon: 'cross', color: '#ec4899' },
    { id: 'landing', label: 'Landing Zone', icon: 'target', color: '#eab308' },
    { id: 'poi', label: 'Point of Interest', icon: 'eye', color: '#06b6d4' },
    { id: 'incident', label: 'Incident Location', icon: 'flame', color: '#ef4444' },
    // Field Collaborator types
    { id: 'collab-responder', label: 'First Responder', icon: 'flame', color: '#ef4444', isCollaborator: true, emoji: '🚒' },
    { id: 'collab-volunteer', label: 'Volunteer', icon: 'users', color: '#22c55e', isCollaborator: true, emoji: '🤝' },
    { id: 'collab-pilot', label: 'Drone Pilot', icon: 'plane', color: '#a855f7', isCollaborator: true, emoji: '🛩️' },
    { id: 'collab-coordinator', label: 'Coordinator', icon: 'flag', color: '#f97316', isCollaborator: true, emoji: '📋' },
    { id: 'collab-agency', label: 'Partner Agency', icon: 'home', color: '#3b82f6', isCollaborator: true, emoji: '🏛️' },
    { id: 'collab-medical', label: 'Medical', icon: 'cross', color: '#ec4899', isCollaborator: true, emoji: '⚕️' },
  ];
  
  // Marker icon mapping
  const getMarkerIcon = (iconName) => {
    const icons = {
      'pin': MapPin,
      'flag': Flag,
      'droplet': Droplets,
      'alert': AlertTriangle,
      'users': Users,
      'truck': Truck,
      'cross': Plus,
      'target': Target,
      'eye': Eye,
      'flame': Flame,
      'home': Home,
      'plane': Plane,
    };
    return icons[iconName] || MapPin;
  };
  
  // Handle marker creation
  const handleCreateMarker = () => {
    setEditingMarker(null);
    setNewMarker({
      name: '',
      type: 'waypoint',
      icon: 'pin',
      color: '#f97316',
      lat: '',
      lng: '',
      notes: '',
      priority: 'normal',
      temporary: false,
      expiresAt: '',
      visibleToAll: true,
    });
    setShowMarkerEditor(true);
  };
  
  // Handle marker edit
  const handleEditMarker = (marker) => {
    setEditingMarker(marker);
    setNewMarker({ ...marker });
    setShowMarkerEditor(true);
  };
  
  // Handle marker save
  const handleSaveMarker = () => {
    if (editingMarker) {
      setMarkers(prev => prev.map(m => m.id === editingMarker.id ? { ...newMarker, id: m.id } : m));
    } else {
      setMarkers(prev => {
        const newId = Math.max(...prev.map(m => m.id), 0) + 1;
        return [...prev, { 
          ...newMarker, 
          id: newId, 
          createdAt: new Date().toLocaleString(),
          createdBy: 'Current User'
        }];
      });
    }
    setShowMarkerEditor(false);
    setEditingMarker(null);
    setMarkerPickMode(false);
  };
  
  // Handle marker delete
  const handleDeleteMarker = (id) => {
    if (confirm('Delete this marker?')) {
      setMarkers(prev => prev.filter(m => m.id !== id));
    }
  };
  
  // Map Navigation Handlers
  const handleMapWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    setMapZoom(prev => Math.min(20, Math.max(1, prev + delta)));
  };
  
  const handleMapMouseDown = (e) => {
    if (markerPickMode) return;
    if (e.button === 0) { // Left click
      setIsPanning(true);
      setPanStart({ x: e.clientX - mapOffset.x, y: e.clientY - mapOffset.y });
    }
  };
  
  const handleMapMouseMove = (e) => {
    // Update cursor position display
    if (mapRef.current) {
      const rect = mapRef.current.getBoundingClientRect();
      const xPct = (e.clientX - rect.left) / rect.width;
      const yPct = (e.clientY - rect.top) / rect.height;
      const lat = (43.26 - (yPct * 0.12 / (mapZoom / 14))).toFixed(4);
      const lng = (2.28 + (xPct * 0.15 / (mapZoom / 14))).toFixed(4);
      setMapCenter({ lat: parseFloat(lat), lng: parseFloat(lng) });
    }
    
    if (isPanning) {
      setMapOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };
  
  const handleMapMouseUp = () => {
    setIsPanning(false);
  };
  
  const handleMapKeyDown = (e) => {
    if (!isMapFocused) return;
    const panStep = 50;
    const zoomStep = 1;
    
    switch(e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setMapOffset(prev => ({ ...prev, y: prev.y + panStep }));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setMapOffset(prev => ({ ...prev, y: prev.y - panStep }));
        break;
      case 'ArrowLeft':
        e.preventDefault();
        setMapOffset(prev => ({ ...prev, x: prev.x + panStep }));
        break;
      case 'ArrowRight':
        e.preventDefault();
        setMapOffset(prev => ({ ...prev, x: prev.x - panStep }));
        break;
      case '+':
      case '=':
        e.preventDefault();
        setMapZoom(prev => Math.min(20, prev + zoomStep));
        break;
      case '-':
        e.preventDefault();
        setMapZoom(prev => Math.max(1, prev - zoomStep));
        break;
      case '0':
        e.preventDefault();
        setMapOffset({ x: 0, y: 0 });
        setMapZoom(14);
        break;
    }
  };
  
  const resetMapView = () => {
    setMapOffset({ x: 0, y: 0 });
    setMapZoom(14);
  };

  // Geofence Editor State
  const [showGeofenceEditor, setShowGeofenceEditor] = useState(false);
  const [geoTab, setGeoTab] = useState('zone');
  const [editingGeofence, setEditingGeofence] = useState(null);
  const [geofenceDrawMode, setGeofenceDrawMode] = useState('circle'); // circle, polygon, rectangle, corridor
  const [newGeofence, setNewGeofence] = useState({
    name: '',
    type: 'operations',
    shape: 'circle',
    color: '#22c55e',
    fillOpacity: 20,
    strokeWidth: 2,
    // Circle specific
    centerLat: '',
    centerLng: '',
    radius: '',
    radiusUnit: 'meters',
    // Polygon/Rectangle specific
    points: [],
    // Corridor specific
    corridorWidth: '',
    // Altitude restrictions
    minAltitude: '',
    maxAltitude: '',
    altitudeUnit: 'meters',
    // Schedule
    scheduleEnabled: false,
    scheduleStart: '',
    scheduleEnd: '',
    activeDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    // Rules
    droneRule: 'alert', // allow, alert, block, rtb (return to base)
    cameraRule: 'allow',
    sensorRule: 'allow',
    alertOnEntry: true,
    alertOnExit: false,
    requireApproval: false,
    // Notifications
    notifyEmail: true,
    notifyPush: true,
    notifySMS: false,
    notifyWebhook: false,
    webhookUrl: '',
    // Metadata
    description: '',
    tags: [],
    priority: 'normal',
    active: true
  });
  
  // Sample geofences with enhanced data
  const [geofences, setGeofences] = useState([
    { 
      id: 1, 
      name: 'Primary Operations Zone', 
      type: 'operations', 
      shape: 'circle',
      color: '#22c55e', 
      coords: '43.2141, 2.3522', 
      radius: '2500',
      radiusUnit: 'meters',
      minAltitude: 0,
      maxAltitude: 500,
      droneRule: 'allow',
      alertOnEntry: false,
      active: true,
      description: 'Main operational area for all drone activities',
      createdBy: 'Admin',
      createdAt: '2024-01-05'
    },
    { 
      id: 2, 
      name: 'No-Fly Zone - Airport', 
      type: 'restricted', 
      shape: 'circle',
      color: '#ef4444', 
      coords: '43.2089, 2.3701', 
      radius: '5000',
      radiusUnit: 'meters',
      minAltitude: 0,
      maxAltitude: 3000,
      droneRule: 'block',
      alertOnEntry: true,
      active: true,
      description: 'Carcassonne Airport restricted airspace - NO ENTRY',
      createdBy: 'System',
      createdAt: '2024-01-01'
    },
    { 
      id: 3, 
      name: 'High Risk Area - Forest', 
      type: 'alert', 
      shape: 'polygon',
      color: '#f97316', 
      coords: '43.2205, 2.3412', 
      radius: '1800',
      radiusUnit: 'meters',
      minAltitude: 50,
      maxAltitude: 300,
      droneRule: 'alert',
      alertOnEntry: true,
      active: true,
      description: 'Forest area with high fire risk - enhanced monitoring required',
      createdBy: 'Admin',
      createdAt: '2024-01-08'
    },
    { 
      id: 4, 
      name: 'Water Source - Lake', 
      type: 'resource', 
      shape: 'circle',
      color: '#3b82f6', 
      coords: '43.2098, 2.3289', 
      radius: '500',
      radiusUnit: 'meters',
      minAltitude: 0,
      maxAltitude: 100,
      droneRule: 'allow',
      alertOnEntry: false,
      active: true,
      description: 'Emergency water source for firefighting operations',
      createdBy: 'Admin',
      createdAt: '2024-01-03'
    },
  ]);
  
  // Geofence type configurations
  const geofenceTypes = [
    { id: 'operations', label: 'Operations Zone', color: '#22c55e', icon: CheckCircle, description: 'Normal operating area' },
    { id: 'restricted', label: 'Restricted / No-Fly', color: '#ef4444', icon: XCircle, description: 'Entry prohibited' },
    { id: 'alert', label: 'Alert Zone', color: '#f97316', icon: AlertTriangle, description: 'Enhanced monitoring' },
    { id: 'resource', label: 'Resource Point', color: '#3b82f6', icon: Droplets, description: 'Water, fuel, equipment' },
    { id: 'landing', label: 'Landing Zone', color: '#8b5cf6', icon: Target, description: 'Designated landing area' },
    { id: 'charging', label: 'Charging Station', color: '#eab308', icon: Zap, description: 'Drone charging point' },
    { id: 'staging', label: 'Staging Area', color: '#06b6d4', icon: Flag, description: 'Equipment staging' },
    { id: 'evacuation', label: 'Evacuation Route', color: '#ec4899', icon: Navigation, description: 'Emergency evacuation path' },
  ];
  
  // Drone rules
  const droneRules = [
    { id: 'allow', label: 'Allow', color: 'green', description: 'Normal operations permitted' },
    { id: 'alert', label: 'Alert Only', color: 'orange', description: 'Trigger alert on entry' },
    { id: 'block', label: 'Block Entry', color: 'red', description: 'Prevent drone from entering' },
    { id: 'rtb', label: 'Return to Base', color: 'purple', description: 'Force RTB if entered' },
    { id: 'hover', label: 'Hover & Wait', color: 'blue', description: 'Stop and await instructions' },
    { id: 'approval', label: 'Require Approval', color: 'yellow', description: 'Request operator approval' },
  ];
  
  // Handle creating new geofence
  const handleCreateGeofence = () => {
    setEditingGeofence(null);
    setNewGeofence({
      name: '',
      type: 'operations',
      shape: 'circle',
      color: '#22c55e',
      fillOpacity: 20,
      strokeWidth: 2,
      centerLat: '',
      centerLng: '',
      radius: '',
      radiusUnit: 'meters',
      points: [],
      corridorWidth: '',
      minAltitude: '',
      maxAltitude: '',
      altitudeUnit: 'meters',
      scheduleEnabled: false,
      scheduleStart: '',
      scheduleEnd: '',
      activeDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      droneRule: 'alert',
      cameraRule: 'allow',
      sensorRule: 'allow',
      alertOnEntry: true,
      alertOnExit: false,
      requireApproval: false,
      notifyEmail: true,
      notifyPush: true,
      notifySMS: false,
      notifyWebhook: false,
      webhookUrl: '',
      description: '',
      tags: [],
      priority: 'normal',
      active: true
    });
    setShowGeofenceEditor(true);
    setGeoTab('zone');
    setGeofenceDrawMode('circle');
  };
  
  // Handle editing existing geofence
  const handleEditGeofence = (geofence) => {
    setEditingGeofence(geofence);
    setNewGeofence({
      ...geofence,
      centerLat: geofence.coords?.split(',')[0]?.trim() || '',
      centerLng: geofence.coords?.split(',')[1]?.trim() || '',
    });
    setShowGeofenceEditor(true);
    setGeoTab('zone');
    setGeofenceDrawMode(geofence.shape || 'circle');
  };
  
  // Handle save geofence
  const handleSaveGeofence = () => {
    if (editingGeofence) {
      setGeofences(geofences.map(g => g.id === editingGeofence.id ? { ...newGeofence, id: g.id, coords: `${newGeofence.centerLat}, ${newGeofence.centerLng}` } : g));
    } else {
      const newId = Math.max(...geofences.map(g => g.id)) + 1;
      setGeofences([...geofences, { ...newGeofence, id: newId, coords: `${newGeofence.centerLat}, ${newGeofence.centerLng}`, createdAt: new Date().toISOString().split('T')[0], createdBy: 'Admin' }]);
    }
    setShowGeofenceEditor(false);
    setEditingGeofence(null);
  };
  
  // Handle delete geofence
  const handleDeleteGeofence = (id) => {
    if (confirm('Are you sure you want to delete this geofence?')) {
      setGeofences(geofences.filter(g => g.id !== id));
    }
  };
  
  // Handle duplicate geofence
  const handleDuplicateGeofence = (geofence) => {
    const newId = Math.max(...geofences.map(g => g.id)) + 1;
    setGeofences([...geofences, { ...geofence, id: newId, name: `${geofence.name} (Copy)`, createdAt: new Date().toISOString().split('T')[0] }]);
  };
  
  // Sample custom overlays/maps
  const [customOverlays] = useState([
    { id: 1, name: 'Facility Blueprint - Main Site', type: 'blueprint', format: 'PDF', uploaded: '2024-01-10', active: false },
    { id: 2, name: 'Aerial Survey - North Sector', type: 'aerial', format: 'GeoTIFF', uploaded: '2024-01-08', active: true },
    { id: 3, name: 'Fire Risk Zones 2024', type: 'overlay', format: 'KML', uploaded: '2024-01-05', active: true },
    { id: 4, name: 'Emergency Routes', type: 'routes', format: 'GeoJSON', uploaded: '2024-01-03', active: false },
    { id: 5, name: 'Topographic Detail', type: 'topo', format: 'MBTiles', uploaded: '2023-12-20', active: false },
  ]);
  
  // Weather data
  const weatherData = {
    temperature: 18,
    humidity: 45,
    windSpeed: 12,
    windDirection: 'NW',
    visibility: '10km',
    fireRiskIndex: 72,
    conditions: 'Partly Cloudy'
  };
  
  // Pop-out map to new window/monitor
  const handlePopout = () => {
    console.log('Pop-out button clicked');

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      alert('Google Maps API key not configured. Please check your .env file.');
      console.error('Missing VITE_GOOGLE_MAPS_API_KEY');
      return;
    }

    console.log('Opening new window...');

    // Convert location strings to lat/lng positions
    const parseLocation = (locStr) => {
      // Parse format like: '43°22\'38.894"N 2°26\'53.859"E'
      const parts = locStr.match(/(\d+)°(\d+)'([\d.]+)"([NS])\s+(\d+)°(\d+)'([\d.]+)"([EW])/);
      if (!parts) return { lat: 43.2141, lng: 2.3522 }; // default

      const lat = parseFloat(parts[1]) + parseFloat(parts[2])/60 + parseFloat(parts[3])/3600;
      const lng = parseFloat(parts[5]) + parseFloat(parts[6])/60 + parseFloat(parts[7])/3600;

      return {
        lat: parts[4] === 'S' ? -lat : lat,
        lng: parts[8] === 'W' ? -lng : lng
      };
    };

    const devicesData = mockStreams.map(d => {
      const hasAlert = d.hasActiveDetection && !d.alertAcknowledged;
      let icon = '📍';
      if (hasAlert) {
        icon = '🔴';
      } else {
        switch(d.deviceType) {
          case 'drone': icon = '🚁'; break;
          case 'camera': icon = '📹'; break;
          case 'sensor': icon = '📡'; break;
        }
      }

      return {
        id: d.id,
        name: d.name,
        type: d.deviceType,
        position: parseLocation(d.location),
        icon: icon,
        status: d.status
      };
    });

    const windowFeatures = 'width=1920,height=1080,left=100,top=100,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no';
    const newWindow = window.open('', 'WatchtowerTacticalMap', windowFeatures);

    if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
      alert('Pop-up blocked! Please allow pop-ups for this site.\n\nIn your browser settings:\n1. Allow pop-ups for this site\n2. Click the Pop-out button again');
      console.error('Popup blocked by browser');
      return;
    }

    console.log('Window opened successfully, writing content...');

    newWindow.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>Watchtower Tactical Map - SDIS 11</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        margin: 0;
        background: #0f172a;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        overflow: hidden;
        width: 100vw;
        height: 100vh;
      }
      #map-root {
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
      }
      .popup-overlay {
        position: absolute;
        top: 20px;
        left: 20px;
        background: rgba(15,23,42,0.95);
        padding: 20px;
        border-radius: 12px;
        color: white;
        border: 1px solid #334155;
        z-index: 1000;
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      }
      .popup-status {
        position: absolute;
        bottom: 20px;
        right: 20px;
        background: rgba(15,23,42,0.95);
        padding: 15px;
        border-radius: 12px;
        color: white;
        border: 1px solid #334155;
        z-index: 1000;
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      }
      .marker-container {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        background: rgba(168, 85, 247, 0.2);
        border: 2px solid #a855f7;
        border-radius: 50%;
      }
      .marker-container.camera {
        width: 32px;
        height: 32px;
        background: rgba(59, 130, 246, 0.2);
        border-color: #3b82f6;
      }
      .marker-container.sensor {
        width: 32px;
        height: 32px;
        background: rgba(249, 115, 22, 0.2);
        border-color: #f97316;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.1); }
      }
      .marker-container.drone {
        animation: pulse 2s ease-in-out infinite;
      }
      .loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-size: 18px;
        z-index: 999;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div id="loading" class="loading">
      <div>🔥 Watchtower Tactical Map</div>
      <div style="margin-top: 10px; font-size: 14px; color: #94a3b8;">Loading map data...</div>
    </div>
    <div id="map-root"></div>
    <div class="popup-overlay">
      <h3 style="margin:0 0 10px 0;color:#f97316">🔥 Watchtower Tactical</h3>
      <p style="margin:5px 0;font-size:14px">SDIS 11 - Aude Operations</p>
      <p style="margin:5px 0;font-size:12px;color:#94a3b8">External Monitor Display</p>
    </div>
    <div class="popup-status">
      <p style="margin:0;font-size:14px">🟢 ${devicesData.length} Devices Total</p>
      <p style="margin:5px 0;font-size:14px">📡 ${devicesData.filter(d => d.status === 'active').length} Online</p>
    </div>
    <script>
      console.log('Popup window loaded');

      (function() {
        const API_KEY = "${apiKey}";
        const MAP_MODE = "${mapMode}";
        const DEVICES = ${JSON.stringify(devicesData)};

        console.log('Initializing with API key:', API_KEY ? 'Present' : 'Missing');
        console.log('Map mode:', MAP_MODE);
        console.log('Devices:', DEVICES.length);

        function initializeMap() {
          console.log('initializeMap called');
          try {
            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.style.display = 'none';

            const mapElement = document.getElementById('map-root');
            console.log('Map element:', mapElement);

            const map = new google.maps.Map(mapElement, {
              center: { lat: 43.2141, lng: 2.3522 },
              zoom: 14,
              mapTypeId: MAP_MODE,
              mapId: 'watchtower-tactical-map',
              disableDefaultUI: false,
              zoomControl: true,
              streetViewControl: false,
              fullscreenControl: true
            });

            console.log('Map created:', map);

            DEVICES.forEach(device => {
              const markerDiv = document.createElement('div');
              markerDiv.className = 'marker-container ' + device.type;
              markerDiv.innerHTML = '<span style="font-size: ' + (device.type === 'drone' ? '20px' : '16px') + '">' + device.icon + '</span>';

              const marker = new google.maps.marker.AdvancedMarkerElement({
                map: map,
                position: device.position,
                content: markerDiv,
                title: device.name
              });

              const infoWindow = new google.maps.InfoWindow({
                content: '<div style="padding:10px;color:#000"><strong>' + device.name + '</strong><br/>Type: ' + device.type + '<br/>Status: ' + device.status + '</div>'
              });

              marker.addListener('click', function() {
                infoWindow.open({ anchor: marker, map: map });
              });
            });

            console.log('All markers created successfully');
          } catch (error) {
            console.error('Map initialization error:', error);
            const loadingEl = document.getElementById('loading');
            if (loadingEl) {
              loadingEl.innerHTML = '<div>Error loading map</div><div style="margin-top: 10px; font-size: 12px; color: #ef4444;">' + error.message + '</div>';
            }
          }
        }

        const script = document.createElement('script');
        script.src = 'https://maps.googleapis.com/maps/api/js?key=' + API_KEY + '&libraries=marker&v=beta&callback=initializeMap';
        script.async = true;
        script.defer = true;
        script.onerror = function() {
          console.error('Failed to load Google Maps script');
          document.getElementById('loading').innerHTML = '<div>Failed to load Google Maps</div><div style="margin-top: 10px; font-size: 12px; color: #ef4444;">Check your API key configuration</div>';
        };

        window.initializeMap = initializeMap;
        document.head.appendChild(script);

        console.log('Google Maps script tag added');
      })();
    </script>
  </body>
</html>`);

    newWindow.document.close();
    setPopoutWindow(newWindow);

    console.log('Content written to popup window');
  };
  
  // Device icon based on type
  const getDeviceMarkerIcon = (device) => {
    const hasAlert = device.hasActiveDetection && !device.alertAcknowledged;
    if (hasAlert) return '🔴';
    switch(device.deviceType) {
      case 'drone': return '🚁';
      case 'camera': return '📹';
      case 'sensor': return '📡';
      default: return '📍';
    }
  };

  // Live mode: the tactical picture comes from real devices and positions.
  if (isLive) {
    const placed = devices.filter(d => d.lat != null && d.lng != null);
    const nameOf = Object.fromEntries(liveMembers.map(m => [m.id, m.name]));
    const FRESH_MS = 10 * 60 * 1000; // team fixes older than 10 min are stale
    const teamMarkers = teamPositions
      .filter(p => Date.now() - new Date(p.at) < FRESH_MS)
      .map(p => ({
        id: `pos-${p.profile_id}`,
        name: `${nameOf[p.profile_id] ?? 'Team member'} (${new Date(p.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
        type: 'person',
        status: 'live',
        position: { lat: p.lat, lng: p.lng },
        icon: '🧍',
      }));

    const KIND_ICON = { drone: '🚁', ptz_camera: '📹', camera: '📷', sensor: '📡', edge_box: '🖥️' };
    const KIND_TYPE = { drone: 'drone', ptz_camera: 'camera', camera: 'camera', sensor: 'sensor', edge_box: 'sensor' };
    const mapDevices = [
      ...placed.map(d => ({
        id: d.id,
        name: d.name,
        type: KIND_TYPE[d.kind] ?? 'sensor',
        status: d.status,
        position: { lat: d.lat, lng: d.lng },
        icon: KIND_ICON[d.kind] ?? '📍',
      })),
      ...teamMarkers,
      ...(myPos ? [{ id: 'me', name: 'My position', type: 'person', status: 'here', position: myPos, icon: '📍' }] : []),
    ];

    const tacticalMarkers = liveMarkers.map(m => {
      const meta = markerMeta(m.kind);
      return {
        id: m.id,
        name: m.label || meta.label,
        rawLabel: m.label,
        kindLabel: meta.label,
        icon: meta.icon,
        position: { lat: m.lat, lng: m.lng },
        notes: m.notes,
        meta: `${nameOf[m.created_by] ?? 'Team'} · ${new Date(m.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`,
      };
    });

    // Tap a type -> drop instantly at the middle of the current view,
    // then drag into place and tap to fill in details.
    const quickDrop = async (kindId) => {
      const c = cameraCenterRef.current ?? myPos ?? center;
      setMarkerBusy(true);
      try {
        await createMarker({ kind: kindId, label: '', lat: c.lat, lng: c.lng });
        setMarkerPanelOpen(false);
      } catch { /* refused — keep panel open */ }
      setMarkerBusy(false);
    };

    const anchors = [...placed.map(d => ({ lat: d.lat, lng: d.lng })), ...teamMarkers.map(t => t.position)];
    const center = myPos ?? (anchors.length
      ? {
          lat: anchors.reduce((a, p) => a + p.lat, 0) / anchors.length,
          lng: anchors.reduce((a, p) => a + p.lng, 0) / anchors.length,
        }
      : { lat: 20, lng: 0 });
    const zoom = myPos ? 14 : anchors.length ? 11 : 2;

    const zeroIn = () => {
      if (!navigator.geolocation) return;
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          setMyPos({ lat: p.coords.latitude, lng: p.coords.longitude });
          setZeroKey(k => k + 1); // remount the map centered on me
          setLocating(false);
        },
        () => setLocating(false),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    return (
      <div className="h-full flex flex-col gap-2 min-h-0">
        <div className="flex items-center justify-between flex-shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Map className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-bold text-white">Tactical Map</h2>
            <span className="text-xs text-slate-500">
              {placed.length} device{placed.length === 1 ? '' : 's'} · {teamMarkers.length} live crew
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMarkerPanelOpen(o => !o)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                markerPanelOpen ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Marker
            </button>
            <button
              onClick={zeroIn}
              disabled={locating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/15 border border-sky-500/30 text-sky-300 rounded-lg text-xs font-medium hover:bg-sky-500/25 disabled:opacity-50"
            >
              <Crosshair className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
              My area
            </button>
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
              {['satellite', 'roadmap', 'terrain', 'hybrid'].map(m => (
                <button
                  key={m}
                  onClick={() => setMapMode(m)}
                  className={`px-2 py-1 rounded text-xs capitalize ${mapMode === m ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* Marker creation: tap a type -> it drops at the center of your view */}
        {markerPanelOpen && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex-shrink-0 space-y-1.5">
            <div className="grid grid-cols-3 sm:grid-cols-9 gap-1">
              {MARKER_KINDS.map(k => (
                <button
                  key={k.id}
                  onClick={() => quickDrop(k.id)}
                  disabled={markerBusy}
                  className="flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg border text-[9px] bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-orange-500/15 hover:border-orange-500/40 hover:text-orange-300 disabled:opacity-50"
                >
                  <span className="text-base leading-none">{k.icon}</span>
                  {k.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500">
              Tap a type — it drops at the center of your view. <b className="text-slate-400">Drag</b> it into position, <b className="text-slate-400">tap</b> it to add label &amp; notes. Everyone sees changes live.
            </p>
          </div>
        )}

        <div className="flex-1 min-h-[400px] rounded-xl overflow-hidden border border-slate-800 relative">
          <TacticalMap
            key={zeroKey}
            mapMode={mapMode}
            devices={mapDevices}
            center={center}
            zoom={zoom}
            geofences={[]}
            alerts={[]}
            markers={tacticalMarkers}
            onMarkerMove={(id, pos) => updateMarker(id, pos).catch(() => {})}
            onMarkerEdit={(id, patch) => updateMarker(id, patch).catch(() => {})}
            onMarkerDelete={(id) => removeMarker(id).catch(() => {})}
            onCameraChanged={(c) => { if (c) cameraCenterRef.current = c; }}
          />
          {placed.length === 0 && teamMarkers.length === 0 && tacticalMarkers.length === 0 && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900/85 border border-slate-700 rounded-lg px-3 py-1.5 pointer-events-none">
              <p className="text-[10px] text-slate-300">
                Nothing on the map yet — drop a marker, register devices, or share your position from the Field Log
              </p>
            </div>
          )}
        </div>
        <p className="text-xs text-slate-600 flex items-center gap-1.5 flex-shrink-0">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
          Connected to Supabase · devices and live crew positions (Field Log → share position)
        </p>
      </div>
    );
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-slate-950' : 'h-full flex flex-col'}`}>
      {/* Map Header / Toolbar */}
      <div className={`flex-shrink-0 flex items-center justify-between ${isFullscreen ? 'absolute top-0 left-0 right-0 z-10 bg-slate-900/90 backdrop-blur px-4 py-3 border-b border-slate-700' : 'bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 mb-4'}`}>
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Map className="w-5 h-5 text-orange-400" />
            Tactical Map
          </h2>
          
          {/* Map Type Selector */}
          <div className="flex items-center bg-slate-800 rounded-lg p-1">
            {[
              { id: 'satellite', label: 'Satellite', icon: Satellite },
              { id: 'roadmap', label: 'Road', icon: Navigation },
              { id: 'terrain', label: 'Terrain', icon: Triangle },
              { id: 'hybrid', label: 'Hybrid', icon: Layers },
            ].map(mode => (
              <button
                key={mode.id}
                onClick={() => setMapMode(mode.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  mapMode === mode.id ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <mode.icon className="w-3.5 h-3.5" />
                {mode.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Map Tools */}
          <div className="flex items-center bg-slate-800 rounded-lg p-1 mr-2">
            {[
              { id: 'select', icon: Crosshair, label: 'Select' },
              { id: 'measure', icon: Ruler, label: 'Measure' },
              { id: 'geofence', icon: Circle, label: 'Geofence' },
              { id: 'marker', icon: MapPin, label: 'Marker' },
            ].map(tool => (
              <button
                key={tool.id}
                onClick={() => setMapTool(tool.id)}
                className={`p-2 rounded-md transition-all ${
                  mapTool === tool.id ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
                title={tool.label}
              >
                <tool.icon className="w-4 h-4" />
              </button>
            ))}
          </div>
          
          {/* Quick Actions */}
          <button className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white" title="Zoom In">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white" title="Zoom Out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white" title="Reset View">
            <RotateCcw className="w-4 h-4" />
          </button>
          
          <div className="w-px h-6 bg-slate-700 mx-1" />
          
          {/* Pop-out / Fullscreen */}
          <button
            onClick={() => {
              console.log('Button click detected!');
              handlePopout();
            }}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm transition-colors"
            title="Open in new window"
            type="button"
          >
            <ExternalLink className="w-4 h-4" />
            Pop-out
          </button>
          {/* Field Intel indicators */}
          {fieldCollaborators.length > 0 && (
            <button onClick={() => { setSidePanel('field'); setSidePanelOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg text-xs hover:bg-green-500/20 transition-all">
              <span className="text-green-400 font-bold">📱 {fieldCollaborators.length}</span>
              {fieldReports.filter(r => !r.acknowledged).length > 0 && (
                <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse">{fieldReports.filter(r => !r.acknowledged).length}</span>
              )}
            </button>
          )}
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      {/* Main Map Area with Side Panel */}
      <div className={`flex gap-4 ${isFullscreen ? 'h-[calc(100vh-60px)] pt-16 p-4' : 'flex-1 min-h-0'}`}>
        {/* Side Panel — Collapsible */}
        <div
          className="flex-shrink-0 flex transition-all duration-300 ease-in-out overflow-hidden"
          style={{ width: sidePanelOpen ? '320px' : '0px', opacity: sidePanelOpen ? 1 : 0 }}
        >
        <div style={{ minWidth: '320px' }} className={`bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden flex flex-col ${isFullscreen ? 'h-full' : 'min-h-0'}`}>
          {/* Panel Tabs */}
          <div className="flex border-b border-slate-700 bg-slate-800/50">
            {[
              { id: 'devices', icon: Radio, label: 'All' },
              { id: 'field', icon: Users, label: 'Field' },
              { id: 'drones', icon: Navigation, label: 'Drones' },
              { id: 'markers', icon: MapPin, label: 'Markers' },
              { id: 'geofences', icon: Circle, label: 'Zones' },
              { id: 'layers', icon: Layers, label: 'Layers' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSidePanel(tab.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-all ${
                  sidePanel === tab.id ? 'text-orange-400 border-b-2 border-orange-500 bg-slate-800' : 'text-slate-400 hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
            <button
              onClick={() => setSidePanelOpen(false)}
              className="px-2 flex items-center text-slate-500 hover:text-white hover:bg-slate-700/50 transition-colors"
              title="Collapse panel"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          
          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-3">
            
            {/* DEVICES Panel */}
            {sidePanel === 'devices' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-slate-400">{mockStreams.length} devices</span>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={showDevices} onChange={(e) => setShowDevices(e.target.checked)} className="w-3 h-3 rounded" />
                    <span className="text-slate-400">Show all</span>
                  </label>
                </div>
                {mockStreams.map(device => {
                  const hasAlert = device.hasActiveDetection && !device.alertAcknowledged;
                  return (
                    <div 
                      key={device.id}
                      onClick={() => setSelectedDevice(device)}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        hasAlert ? 'bg-red-500/20 border border-red-500/50 animate-pulse' :
                        selectedDevice?.id === device.id ? 'bg-orange-500/20 border border-orange-500/50' :
                        'bg-slate-800/50 border border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{getDeviceMarkerIcon(device)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm truncate">{device.name}</p>
                          <p className="text-slate-500 text-xs">{device.location}</p>
                        </div>
                        {device.status === 'active' && <div className="w-2 h-2 bg-green-500 rounded-full" />}
                      </div>
                      {hasAlert && (
                        <div className="mt-2 flex items-center gap-2 text-red-400 text-xs">
                          <Flame className="w-3 h-3" />
                          <span>{device.detectionType} detected</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* DRONES Panel - Dedicated Drone Control */}

            {/* FIELD INTEL Panel */}
            {sidePanel === 'field' && (
              <div className="space-y-2">
                {/* Header with counts */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Field Intel</span>
                    {fieldReports.filter(r => !r.acknowledged).length > 0 && (
                      <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse">
                        {fieldReports.filter(r => !r.acknowledged).length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={showFieldCollaborators} onChange={(e) => setShowFieldCollaborators(e.target.checked)} className="w-3 h-3 rounded" />
                      <span className="text-slate-500">Map</span>
                    </label>
                  </div>
                </div>

                {/* COLLABORATORS section */}
                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-2.5 py-2 bg-slate-800/70">
                    <span className="text-[10px] font-bold text-green-400 tracking-wider">👥 COLLABORATORS ({fieldCollaborators.length})</span>
                  </div>
                  {fieldCollaborators.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500">
                      No field collaborators yet.<br/>
                      <span className="text-[10px] text-slate-600">Use Comms → Quick Add → Field App to onboard</span>
                    </div>
                  ) : (
                    <div className="max-h-44 overflow-y-auto">
                      {fieldCollaborators.map(collab => {
                        const assignment = actionAssignments.find(a => a.collaboratorId === collab.id && a.status === 'dispatched');
                        return (
                          <div key={collab.id} className="flex items-center gap-2 px-2.5 py-2 border-t border-slate-800 hover:bg-slate-800/50 cursor-pointer group"
                            onClick={() => { setAssignTarget({ type: 'collaborator', ...collab }); setShowAssignAction(true); }}
                          >
                            <div className="w-7 h-7 rounded-full flex items-center justify-center border-2 flex-shrink-0"
                              style={{ borderColor: roleColors[collab.role] || '#f97316', backgroundColor: (roleColors[collab.role] || '#f97316') + '25' }}>
                              <span className="text-sm">{roleIcons[collab.role] || '👤'}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-white truncate">{collab.name}</div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColors[collab.lastStatus] || '#22c55e' }} />
                                {collab.lastStatus?.toUpperCase() || 'OK'}
                                <span className="ml-0.5" style={{ color: roleColors[collab.role] || '#f97316' }}>· {roleLabels[collab.role] || collab.role}</span>
                                {assignment && <span className="text-orange-400 ml-1">→ {assignment.target?.name?.substring(0, 12) || 'target'}</span>}
                              </div>
                            </div>
                            <button className="opacity-0 group-hover:opacity-100 px-1.5 py-1 bg-orange-500/20 text-orange-400 rounded text-[9px] font-bold flex-shrink-0">
                              ASSIGN
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* FIELD REPORTS section */}
                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  <div className="px-2.5 py-2 bg-slate-800/70">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-red-400 tracking-wider">📋 REPORTS & REQUESTS ({fieldReports.length})</span>
                    </div>
                    {/* Filter chips */}
                    <div className="flex gap-1 flex-wrap">
                      {[
                        { id: 'all', label: 'All' },
                        { id: 'new', label: 'New', color: 'red' },
                        { id: 'critical', label: 'Critical', color: 'red' },
                        { id: 'high', label: 'High', color: 'yellow' },
                        { id: 'normal', label: 'Normal', color: 'slate' },
                      ].map(f => (
                        <button key={f.id} onClick={() => setReportFilter(f.id)}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all ${
                            reportFilter === f.id
                              ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                              : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-white'
                          }`}
                        >{f.label}{f.id === 'new' && fieldReports.filter(r => !r.acknowledged).length > 0 ? ` (${fieldReports.filter(r => !r.acknowledged).length})` : ''}</button>
                      ))}
                    </div>
                  </div>
                  {filteredReports.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500">
                      {fieldReports.length === 0 ? 'No field reports yet' : 'No reports match filter'}
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto">
                      {filteredReports.map(report => {
                        const meta = reportTypeMeta[report.type] || { icon: '📢', label: report.type, color: '#64748b' };
                        return (
                          <div key={report.id}
                            className={`px-2.5 py-2 border-t cursor-pointer hover:bg-slate-800/50 transition-all ${
                              !report.acknowledged ? 'border-l-2' : 'border-l-0'
                            }`}
                            style={{ borderColor: !report.acknowledged ? meta.color : '#1e293b', borderLeftColor: !report.acknowledged ? meta.color : 'transparent' }}
                            onClick={() => setSelectedFieldReport(selectedFieldReport?.id === report.id ? null : report)}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base">{meta.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-white">{report.mode === 'support' ? '🤝 ' : ''}{meta.label}</span>
                                  <span className={`px-1 py-0 rounded text-[8px] font-bold ${
                                    report.priority === 'critical' ? 'bg-red-500/30 text-red-400' :
                                    report.priority === 'high' ? 'bg-yellow-500/30 text-yellow-400' :
                                    'bg-slate-700 text-slate-400'
                                  }`}>{report.priority?.toUpperCase()}</span>
                                  {!report.acknowledged && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  📍 {report.location?.lat}, {report.location?.lng} · {report.time}
                                  {report.captures > 0 && ` · 📎${report.captures}`}
                                </div>
                              </div>
                            </div>
                            {/* Expanded detail */}
                            {selectedFieldReport?.id === report.id && (
                              <div className="mt-2 pt-2 border-t border-slate-800">
                                {report.note && <p className="text-xs text-slate-300 mb-2">"{report.note}"</p>}
                                <div className="flex gap-1.5 flex-wrap">
                                  {!report.acknowledged && (
                                    <button onClick={(e) => { e.stopPropagation(); acknowledgeReport(report.id); }}
                                      className="px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-[10px] font-bold hover:bg-green-500/30">
                                      ✓ ACK
                                    </button>
                                  )}
                                  <button onClick={(e) => { e.stopPropagation(); setAssignTarget({ type: 'report', ...report, name: meta.label, lat: report.location?.lat, lng: report.location?.lng }); setShowAssignAction(true); }}
                                    className="px-2 py-1 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded text-[10px] font-bold hover:bg-orange-500/30">
                                    📌 ASSIGN
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); setFieldReports(prev => prev.map(r => r.id === report.id ? { ...r, priority: 'critical' } : r)); }}
                                    className="px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[10px] font-bold hover:bg-red-500/30">
                                    ⬆ ESCALATE
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ACTIVE ASSIGNMENTS section */}
                {actionAssignments.length > 0 && (
                  <div className="border border-slate-700 rounded-lg overflow-hidden">
                    <div className="px-2.5 py-2 bg-slate-800/70">
                      <span className="text-[10px] font-bold text-orange-400 tracking-wider">📌 ACTIVE ASSIGNMENTS ({actionAssignments.length})</span>
                    </div>
                    <div className="max-h-32 overflow-y-auto">
                      {actionAssignments.map(assign => {
                        const collab = fieldCollaborators.find(c => c.id === assign.collaboratorId);
                        return (
                          <div key={assign.id} className="flex items-center gap-2 px-2.5 py-2 border-t border-slate-800">
                            <span className="text-sm">{roleIcons[collab?.role] || '👤'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] text-white font-bold truncate">{collab?.name || 'Unknown'}</div>
                              <div className="text-[9px] text-slate-500">→ {assign.target?.name || 'target'} · {assign.actionType}</div>
                            </div>
                            <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[8px] font-bold">{assign.status?.toUpperCase()}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            {sidePanel === 'drones' && (
              <div className="space-y-3">
                {/* Emergency Button - Always Visible */}
                <button 
                  onClick={() => setShowEmergencyPanel(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold animate-pulse"
                >
                  <AlertTriangle className="w-5 h-5" />
                  EMERGENCY CONTROLS
                </button>
                
                {/* Selection Controls */}
                <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg">
                  <span className="text-xs text-slate-400">
                    {selectedDrones.length} of {droneFleet.length} selected
                  </span>
                  <div className="flex gap-1">
                    <button 
                      onClick={selectAllDrones}
                      className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded"
                    >
                      All
                    </button>
                    <button 
                      onClick={clearDroneSelection}
                      className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded"
                    >
                      None
                    </button>
                  </div>
                </div>
                
                {/* Quick Actions for Selected */}
                {selectedDrones.length > 0 && (
                  <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <p className="text-xs text-purple-400 mb-2 font-medium">Quick Actions ({selectedDrones.length} drones)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setShowTargetAssignment(true)}
                        className="px-2 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded text-xs flex items-center justify-center gap-1"
                      >
                        <Target className="w-3 h-3" /> Assign Target
                      </button>
                      <button 
                        onClick={() => setShowPathEditor(true)}
                        className="px-2 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded text-xs flex items-center justify-center gap-1"
                      >
                        <Navigation className="w-3 h-3" /> Set Path
                      </button>
                      <button 
                        onClick={() => handleEmergencyAction(emergencyActions.find(a => a.id === 'rtb'))}
                        className="px-2 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded text-xs flex items-center justify-center gap-1"
                      >
                        <Home className="w-3 h-3" /> Return Home
                      </button>
                      <button 
                        onClick={() => handleEmergencyAction(emergencyActions.find(a => a.id === 'halt'))}
                        className="px-2 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs flex items-center justify-center gap-1"
                      >
                        <Pause className="w-3 h-3" /> Halt All
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Drone Fleet List */}
                <div className="space-y-2">
                  {droneFleet.map(drone => (
                    <div 
                      key={drone.id}
                      className={`p-3 rounded-lg border transition-all ${
                        drone.emergencyState 
                          ? 'bg-red-500/20 border-red-500/50 animate-pulse' 
                          : selectedDrones.includes(drone.id)
                            ? 'bg-purple-500/20 border-purple-500/50'
                            : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox"
                          checked={selectedDrones.includes(drone.id)}
                          onChange={() => toggleDroneSelection(drone.id)}
                          className="w-4 h-4 rounded border-slate-600"
                        />
                        <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                          <Navigation className={`w-4 h-4 text-purple-400 ${drone.mode === 'autonomous' ? 'animate-pulse' : ''}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{drone.name}</p>
                          <p className="text-slate-500 text-xs">{drone.currentMission}</p>
                        </div>
                      </div>
                      
                      {/* Status Badges */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          drone.mode === 'autonomous' ? 'bg-orange-500/20 text-orange-400' :
                          drone.mode === 'manual' ? 'bg-cyan-500/20 text-cyan-400' :
                          drone.mode === 'emergency' ? 'bg-red-500/20 text-red-400' :
                          drone.mode === 'standby' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {drone.mode === 'autonomous' ? '🤖 AI' : 
                           drone.mode === 'manual' ? `👤 ${drone.pilot}` :
                           drone.mode === 'emergency' ? '🚨 EMERGENCY' :
                           drone.mode === 'standby' ? '⏸️ STANDBY' :
                           '🏠 RTB'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          drone.batteryLevel > 50 ? 'bg-green-500/20 text-green-400' :
                          drone.batteryLevel > 20 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          🔋 {drone.batteryLevel}%
                        </span>
                        {drone.assignedTarget && (
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs">
                            🎯 {drone.assignedTarget.name}
                          </span>
                        )}
                      </div>
                      
                      {/* Stats */}
                      <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                        <div className="text-center p-1 bg-slate-900/50 rounded">
                          <p className="text-slate-500">ALT</p>
                          <p className="text-white font-medium">{drone.altitude}</p>
                        </div>
                        <div className="text-center p-1 bg-slate-900/50 rounded">
                          <p className="text-slate-500">SPD</p>
                          <p className="text-white font-medium">{drone.speed}</p>
                        </div>
                        <div className="text-center p-1 bg-slate-900/50 rounded">
                          <p className="text-slate-500">HDG</p>
                          <p className="text-white font-medium">{drone.heading}</p>
                        </div>
                        <div className="text-center p-1 bg-slate-900/50 rounded">
                          <p className="text-slate-500">ETA</p>
                          <p className="text-white font-medium">{drone.eta}</p>
                        </div>
                      </div>
                      
                      {/* Emergency State Actions */}
                      {drone.emergencyState && (
                        <div className="mt-2 p-2 bg-red-500/10 rounded border border-red-500/30">
                          <p className="text-xs text-red-400 font-medium mb-2">
                            ⚠️ {emergencyActions.find(a => a.id === drone.emergencyState)?.label}
                          </p>
                          <button 
                            onClick={() => resumeNormalOps(drone.id)}
                            className="w-full px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded text-xs"
                          >
                            ✓ Resume Normal Operations
                          </button>
                        </div>
                      )}
                      
                      {/* Quick Actions */}
                      {!drone.emergencyState && (
                        <div className="flex gap-1 mt-2">
                          <button 
                            onClick={() => { setSelectedDrones([drone.id]); setShowEmergencyPanel(true); }}
                            className="flex-1 px-2 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs"
                          >
                            Emergency
                          </button>
                          <button 
                            onClick={() => { setSelectedDrones([drone.id]); setShowTargetAssignment(true); }}
                            className="flex-1 px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
                          >
                            Target
                          </button>
                          <button 
                            onClick={() => { setSelectedDrones([drone.id]); setShowPathEditor(true); }}
                            className="flex-1 px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
                          >
                            Path
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* MARKERS Panel */}
            {sidePanel === 'markers' && (
              <div className="space-y-3">
                <button 
                  onClick={handleCreateMarker}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Marker
                </button>
                
                {/* Quick Place Tools */}
                <div className="p-2 bg-slate-800/50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-2">Quick Place on Map</p>
                  <div className="grid grid-cols-5 gap-1">
                    {markerTypes.filter(t => !t.isCollaborator).slice(0, 10).map(type => {
                      const IconComponent = getMarkerIcon(type.icon);
                      return (
                        <button
                          key={type.id}
                          onClick={() => {
                            setNewMarker({...newMarker, type: type.id, icon: type.icon, color: type.color});
                            setMapTool('marker');
                          }}
                          className={`p-2 rounded-lg text-xs transition-all flex flex-col items-center gap-1 ${
                            mapTool === 'marker' && newMarker.type === type.id
                              ? 'bg-orange-500 text-white'
                              : 'bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700'
                          }`}
                          title={type.label}
                        >
                          <IconComponent className="w-4 h-4" style={{ color: mapTool === 'marker' && newMarker.type === type.id ? 'white' : type.color }} />
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Filter */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{markers.length} markers</span>
                  <select className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300">
                    <option value="">All Types</option>
                    {markerTypes.filter(t => !t.isCollaborator).map(type => (
                      <option key={type.id} value={type.id}>{type.label}</option>
                    ))}
                  </select>
                </div>
                
                {/* Markers List */}
                <div className="space-y-2">
                  {markers.map(marker => {
                    const IconComponent = getMarkerIcon(marker.icon);
                    return (
                      <div 
                        key={marker.id} 
                        className={`p-3 rounded-lg border transition-all cursor-pointer hover:border-slate-600 ${
                          marker.priority === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                          marker.priority === 'high' ? 'bg-orange-500/10 border-orange-500/30' :
                          'bg-slate-800/50 border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${marker.color}30` }}
                          >
                            <IconComponent className="w-4 h-4" style={{ color: marker.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{marker.name}</p>
                            <p className="text-slate-500 text-xs">{marker.lat}, {marker.lng}</p>
                          </div>
                          {marker.priority === 'critical' && (
                            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">!</span>
                          )}
                        </div>
                        
                        {marker.notes && (
                          <p className="text-xs text-slate-400 mt-2 line-clamp-1">{marker.notes}</p>
                        )}
                        
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/50 text-xs text-slate-500">
                          <span>{marker.createdBy}</span>
                          <span>•</span>
                          <span>{marker.createdAt}</span>
                        </div>
                        
                        <div className="flex items-center gap-1 mt-2">
                          <button 
                            onClick={() => handleEditMarker(marker)}
                            className="flex-1 text-xs text-slate-400 hover:text-white py-1 hover:bg-slate-700/50 rounded"
                          >
                            Edit
                          </button>
                          <button 
                            className="flex-1 text-xs text-slate-400 hover:text-white py-1 hover:bg-slate-700/50 rounded"
                          >
                            Go To
                          </button>
                          <button 
                            onClick={() => handleDeleteMarker(marker.id)}
                            className="flex-1 text-xs text-slate-400 hover:text-red-400 py-1 hover:bg-red-500/10 rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Marker Types Legend */}
                <div className="border-t border-slate-700 pt-3 mt-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Marker Types</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {markerTypes.filter(t => !t.isCollaborator).slice(0, 10).map(type => {
                      const IconComponent = getMarkerIcon(type.icon);
                      return (
                        <div key={type.id} className="flex items-center gap-2 py-1">
                          <IconComponent className="w-3 h-3" style={{ color: type.color }} />
                          <span className="text-slate-300">{type.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Collaborator Types Legend */}
                <div className="border-t border-slate-700 pt-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Collaborator Types</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {markerTypes.filter(t => t.isCollaborator).map(type => (
                      <div key={type.id} className="flex items-center gap-2 py-1">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center border"
                          style={{ borderColor: type.color, backgroundColor: type.color + '25' }}>
                          <span className="text-[8px]">{type.emoji}</span>
                        </div>
                        <span className="text-slate-300">{type.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Import/Export */}
                <div className="border-t border-slate-700 pt-3">
                  <div className="flex gap-2">
                    <button className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg flex items-center justify-center gap-1">
                      <Upload className="w-3 h-3" /> Import
                    </button>
                    <button className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg flex items-center justify-center gap-1">
                      <Download className="w-3 h-3" /> Export
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* LAYERS Panel */}
            {sidePanel === 'layers' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Toggle Layers</p>
                {[
                  { id: 'devices', label: 'Device Markers', icon: Radio, checked: showDevices, onChange: setShowDevices },
                  { id: 'markers', label: 'Operator Markers', icon: MapPin, checked: showMarkers, onChange: setShowMarkers },
                  { id: 'fieldCollab', label: 'Field Collaborators', icon: Users, checked: showFieldCollaborators, onChange: setShowFieldCollaborators },
                  { id: 'fieldReports', label: 'Field Reports', icon: AlertTriangle, checked: showFieldReports, onChange: setShowFieldReports },
                  { id: 'geofences', label: 'Geofence Zones', icon: Circle, checked: showGeofences, onChange: setShowGeofences },
                  { id: 'weather', label: 'Weather Overlay', icon: Wind, checked: showWeather, onChange: setShowWeather },
                  { id: 'alerts', label: 'Alert Indicators', icon: AlertTriangle, checked: showAlerts, onChange: setShowAlerts },
                  { id: 'flightPaths', label: 'Drone Flight Paths', icon: Navigation, checked: showFlightPaths, onChange: setShowFlightPaths },
                ].map(layer => (
                  <label key={layer.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800">
                    <input 
                      type="checkbox" 
                      checked={layer.checked} 
                      onChange={(e) => layer.onChange(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-orange-500"
                    />
                    <layer.icon className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-white">{layer.label}</span>
                  </label>
                ))}
                
                <div className="border-t border-slate-700 pt-3 mt-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Map Labels</p>
                  {['Roads', 'Buildings', 'Points of Interest', 'Terrain Contours'].map(label => (
                    <label key={label} className="flex items-center gap-3 p-2 cursor-pointer">
                      <input type="checkbox" defaultChecked className="w-3 h-3 rounded" />
                      <span className="text-xs text-slate-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            
            {/* GEOFENCES Panel */}
            {sidePanel === 'geofences' && (
              <div className="space-y-3">
                <button 
                  onClick={handleCreateGeofence}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Create Geofence
                </button>
                
                {/* Quick Draw Tools */}
                <div className="p-2 bg-slate-800/50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-2">Quick Draw on Map</p>
                  <div className="flex gap-1">
                    {[
                      { id: 'circle', icon: Circle, label: 'Circle' },
                      { id: 'polygon', icon: Triangle, label: 'Polygon' },
                      { id: 'rectangle', icon: Square, label: 'Rectangle' },
                      { id: 'corridor', icon: Navigation, label: 'Corridor' },
                    ].map(shape => (
                      <button
                        key={shape.id}
                        onClick={() => { setGeofenceDrawMode(shape.id); setMapTool('geofence'); }}
                        className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-all ${
                          geofenceDrawMode === shape.id && mapTool === 'geofence'
                            ? 'bg-orange-500 text-white'
                            : 'bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                      >
                        <shape.icon className="w-4 h-4" />
                        {shape.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Geofence List */}
                <div className="space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{geofences.length} zones defined</span>
                    <select className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300">
                      <option>All Types</option>
                      <option>Operations</option>
                      <option>Restricted</option>
                      <option>Alert</option>
                      <option>Resource</option>
                    </select>
                  </div>
                  
                  {geofences.map(zone => (
                    <div key={zone.id} className={`p-3 rounded-lg border transition-all ${
                      zone.type === 'restricted' ? 'bg-red-500/10 border-red-500/30' :
                      zone.type === 'alert' ? 'bg-orange-500/10 border-orange-500/30' :
                      'bg-slate-800/50 border-slate-700'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{zone.name}</p>
                          <p className="text-slate-500 text-xs">{zone.coords}</p>
                        </div>
                        <label className="flex items-center gap-1">
                          <input 
                            type="checkbox" 
                            checked={zone.active} 
                            onChange={() => setGeofences(geofences.map(g => g.id === zone.id ? {...g, active: !g.active} : g))}
                            className="w-3 h-3 rounded" 
                          />
                        </label>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          zone.type === 'restricted' ? 'bg-red-500/20 text-red-400' :
                          zone.type === 'alert' ? 'bg-orange-500/20 text-orange-400' :
                          zone.type === 'resource' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {zone.type}
                        </span>
                        <span className="text-xs text-slate-500">{zone.radius}{zone.radiusUnit === 'meters' ? 'm' : 'km'}</span>
                        {zone.droneRule === 'block' && (
                          <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-xs flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> No-Fly
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-700/50">
                        <button 
                          onClick={() => handleEditGeofence(zone)}
                          className="flex-1 text-xs text-slate-400 hover:text-white py-1 hover:bg-slate-700/50 rounded"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDuplicateGeofence(zone)}
                          className="flex-1 text-xs text-slate-400 hover:text-white py-1 hover:bg-slate-700/50 rounded"
                        >
                          Duplicate
                        </button>
                        <button 
                          onClick={() => handleDeleteGeofence(zone.id)}
                          className="flex-1 text-xs text-slate-400 hover:text-red-400 py-1 hover:bg-red-500/10 rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Zone Types Legend */}
                <div className="border-t border-slate-700 pt-3 mt-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Zone Types</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {geofenceTypes.slice(0, 8).map(type => (
                      <div key={type.id} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }} />
                        <span className="text-slate-300">{type.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Import/Export */}
                <div className="border-t border-slate-700 pt-3">
                  <div className="flex gap-2">
                    <button className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg flex items-center justify-center gap-1">
                      <Upload className="w-3 h-3" /> Import
                    </button>
                    <button className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg flex items-center justify-center gap-1">
                      <Download className="w-3 h-3" /> Export
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 text-center">KML, GeoJSON, Shapefile</p>
                </div>
              </div>
            )}
            
            {/* OVERLAYS Panel */}
            {sidePanel === 'overlays' && (
              <div className="space-y-3">
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium">
                  <Upload className="w-4 h-4" />
                  Upload Map/Overlay
                </button>
                
                <div className="p-3 bg-slate-800/30 rounded-lg border border-dashed border-slate-600 text-center">
                  <p className="text-xs text-slate-400 mb-1">Supported formats:</p>
                  <p className="text-xs text-slate-500">KML, KMZ, GeoJSON, GeoTIFF, PDF, PNG, JPG, MBTiles, Shapefile</p>
                </div>
                
                <div className="space-y-2 mt-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Uploaded Overlays</p>
                  {customOverlays.map(overlay => (
                    <div key={overlay.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          overlay.type === 'aerial' ? 'bg-blue-500/20' :
                          overlay.type === 'blueprint' ? 'bg-purple-500/20' :
                          overlay.type === 'overlay' ? 'bg-orange-500/20' :
                          'bg-slate-600/50'
                        }`}>
                          {overlay.type === 'aerial' ? <Satellite className="w-4 h-4 text-blue-400" /> :
                           overlay.type === 'blueprint' ? <FileText className="w-4 h-4 text-purple-400" /> :
                           <Layers className="w-4 h-4 text-orange-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{overlay.name}</p>
                          <p className="text-slate-500 text-xs">{overlay.format} • {overlay.uploaded}</p>
                        </div>
                        <label className="flex items-center">
                          <input type="checkbox" checked={overlay.active} readOnly className="w-4 h-4 rounded" />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* WEATHER Panel */}
            {sidePanel === 'weather' && (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-br from-blue-500/20 to-transparent rounded-xl border border-blue-500/30">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-slate-400 text-sm">Current Conditions</span>
                    <span className="text-xs text-slate-500">Updated 5m ago</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Sun className="w-12 h-12 text-yellow-400" />
                    <div>
                      <p className="text-3xl font-bold text-white">{weatherData.temperature}°C</p>
                      <p className="text-slate-400">{weatherData.conditions}</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                      <Wind className="w-3 h-3" /> Wind
                    </div>
                    <p className="text-white font-medium">{weatherData.windSpeed} km/h</p>
                    <p className="text-slate-500 text-xs">{weatherData.windDirection}</p>
                  </div>
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                      <Droplets className="w-3 h-3" /> Humidity
                    </div>
                    <p className="text-white font-medium">{weatherData.humidity}%</p>
                  </div>
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                      <Eye className="w-3 h-3" /> Visibility
                    </div>
                    <p className="text-white font-medium">{weatherData.visibility}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${weatherData.fireRiskIndex > 70 ? 'bg-red-500/20 border border-red-500/30' : weatherData.fireRiskIndex > 40 ? 'bg-orange-500/20 border border-orange-500/30' : 'bg-green-500/20 border border-green-500/30'}`}>
                    <div className="flex items-center gap-2 text-xs mb-1">
                      <Flame className={`w-3 h-3 ${weatherData.fireRiskIndex > 70 ? 'text-red-400' : weatherData.fireRiskIndex > 40 ? 'text-orange-400' : 'text-green-400'}`} /> Fire Risk
                    </div>
                    <p className={`font-bold ${weatherData.fireRiskIndex > 70 ? 'text-red-400' : weatherData.fireRiskIndex > 40 ? 'text-orange-400' : 'text-green-400'}`}>{weatherData.fireRiskIndex}%</p>
                    <p className="text-xs text-slate-500">{weatherData.fireRiskIndex > 70 ? 'HIGH' : weatherData.fireRiskIndex > 40 ? 'MODERATE' : 'LOW'}</p>
                  </div>
                </div>
                
                <div className="border-t border-slate-700 pt-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Weather Layers</p>
                  {['Temperature Map', 'Wind Flow', 'Precipitation Radar', 'Fire Risk Overlay'].map(layer => (
                    <label key={layer} className="flex items-center gap-3 p-2 cursor-pointer">
                      <input type="checkbox" defaultChecked={layer === 'Fire Risk Overlay'} className="w-3 h-3 rounded" />
                      <span className="text-xs text-slate-300">{layer}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
        
        {/* Geofence Editor Modal - Tabbed */}
        {showGeofenceEditor && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 bg-slate-800/50 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded flex items-center justify-center" style={{ backgroundColor: `${newGeofence.color}30` }}>
                    <Circle className="w-3.5 h-3.5" style={{ color: newGeofence.color }} />
                  </div>
                  <h3 className="text-sm font-bold text-white">
                    {editingGeofence ? 'Edit Geofence' : 'New Geofence'}
                  </h3>
                </div>
                <button onClick={() => setShowGeofenceEditor(false)} className="p-1.5 hover:bg-slate-700 rounded-lg">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-700 bg-slate-800/30 flex-shrink-0 overflow-x-auto">
                {[
                  { id: 'zone', label: 'Zone' },
                  { id: 'boundary', label: 'Boundary' },
                  { id: 'rules', label: 'Rules' },
                  { id: 'alerts', label: 'Alerts' },
                  { id: 'style', label: 'Style' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setGeoTab(tab.id)}
                    className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-all ${
                      geoTab === tab.id
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content - Scrollable */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">

                {/* ZONE TAB - Name, Type, Priority, Description */}
                {geoTab === 'zone' && (
                  <>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Zone Name *</label>
                      <input type="text" value={newGeofence.name} onChange={(e) => setNewGeofence({...newGeofence, name: e.target.value})} placeholder="e.g., North Sector Operations Zone" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Zone Type *</label>
                        <select value={newGeofence.type} onChange={(e) => { const type = geofenceTypes.find(t => t.id === e.target.value); setNewGeofence({...newGeofence, type: e.target.value, color: type?.color || '#22c55e'}); }} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm">
                          {geofenceTypes.map(type => (<option key={type.id} value={type.id}>{type.label}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Priority</label>
                        <select value={newGeofence.priority} onChange={(e) => setNewGeofence({...newGeofence, priority: e.target.value})} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm">
                          <option value="low">Low</option>
                          <option value="normal">Normal</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Description / Notes</label>
                      <textarea value={newGeofence.description} onChange={(e) => setNewGeofence({...newGeofence, description: e.target.value})} rows={2} placeholder="Add notes about this geofence..." className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm resize-none" />
                    </div>
                  </>
                )}

                {/* BOUNDARY TAB - Shape, Coordinates, Altitude */}
                {geoTab === 'boundary' && (
                  <>
                    <div>
                      <label className="block text-xs text-slate-400 mb-2">Zone Shape *</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { id: 'circle', icon: Circle, label: 'Circle' },
                          { id: 'polygon', icon: Triangle, label: 'Polygon' },
                          { id: 'rectangle', icon: Square, label: 'Rectangle' },
                          { id: 'corridor', icon: Navigation, label: 'Corridor' },
                        ].map(shape => (
                          <button key={shape.id} onClick={() => setNewGeofence({...newGeofence, shape: shape.id})} className={`p-2.5 rounded-lg border transition-all text-center ${newGeofence.shape === shape.id ? 'bg-orange-500/20 border-orange-500 text-white' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                            <shape.icon className="w-5 h-5 mx-auto mb-1" />
                            <p className="text-xs font-medium">{shape.label}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Circle coords */}
                    {newGeofence.shape === 'circle' && (
                      <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700 space-y-2">
                        <h4 className="text-white font-medium text-xs flex items-center gap-1.5"><Crosshair className="w-3.5 h-3.5 text-orange-400" /> Circle Definition</h4>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Latitude *</label>
                            <input type="text" value={newGeofence.centerLat} onChange={(e) => setNewGeofence({...newGeofence, centerLat: e.target.value})} placeholder="43.2141" className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Longitude *</label>
                            <input type="text" value={newGeofence.centerLng} onChange={(e) => setNewGeofence({...newGeofence, centerLng: e.target.value})} placeholder="2.3522" className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Radius *</label>
                            <div className="flex gap-1">
                              <input type="number" value={newGeofence.radius} onChange={(e) => setNewGeofence({...newGeofence, radius: e.target.value})} placeholder="500" className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm" />
                              <select value={newGeofence.radiusUnit} onChange={(e) => setNewGeofence({...newGeofence, radiusUnit: e.target.value})} className="px-1.5 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs">
                                <option value="meters">m</option><option value="kilometers">km</option><option value="feet">ft</option><option value="miles">mi</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        <button className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded text-xs flex items-center gap-1 hover:bg-blue-500/30"><Crosshair className="w-3 h-3" /> Pick on Map</button>
                      </div>
                    )}

                    {/* Polygon coords */}
                    {newGeofence.shape === 'polygon' && (
                      <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700 space-y-2">
                        <h4 className="text-white font-medium text-xs flex items-center gap-1.5"><Triangle className="w-3.5 h-3.5 text-orange-400" /> Polygon Points</h4>
                        <div className="space-y-1.5 max-h-28 overflow-y-auto">
                          {(newGeofence.points?.length > 0 ? newGeofence.points : [{lat: '', lng: ''}, {lat: '', lng: ''}, {lat: '', lng: ''}]).map((point, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-500 w-5">{idx + 1}.</span>
                              <input type="text" placeholder="Lat" className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-xs" />
                              <input type="text" placeholder="Lng" className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-xs" />
                              <button className="p-0.5 text-slate-400 hover:text-red-400"><X className="w-3 h-3" /></button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs">+ Add Point</button>
                          <button className="px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded text-xs flex items-center gap-1"><Crosshair className="w-3 h-3" /> Draw on Map</button>
                        </div>
                      </div>
                    )}

                    {/* Altitude */}
                    <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700 space-y-2">
                      <h4 className="text-white font-medium text-xs flex items-center gap-1.5"><ArrowUpRight className="w-3.5 h-3.5 text-orange-400" /> Altitude Restrictions</h4>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Min Altitude</label>
                          <input type="number" value={newGeofence.minAltitude} onChange={(e) => setNewGeofence({...newGeofence, minAltitude: e.target.value})} placeholder="0" className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Max Altitude</label>
                          <input type="number" value={newGeofence.maxAltitude} onChange={(e) => setNewGeofence({...newGeofence, maxAltitude: e.target.value})} placeholder="500" className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Unit</label>
                          <select value={newGeofence.altitudeUnit} onChange={(e) => setNewGeofence({...newGeofence, altitudeUnit: e.target.value})} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm">
                            <option value="meters">Meters (m)</option><option value="feet">Feet (ft)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* RULES TAB - Device behaviors */}
                {geoTab === 'rules' && (
                  <>
                    <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700 space-y-2">
                      <h4 className="text-white font-medium text-xs flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-orange-400" /> Device Behavior</h4>
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Drone Behavior</label>
                          <select value={newGeofence.droneRule} onChange={(e) => setNewGeofence({...newGeofence, droneRule: e.target.value})} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm">
                            {droneRules.map(rule => (<option key={rule.id} value={rule.id}>{rule.label}</option>))}
                          </select>
                          <p className="text-xs text-slate-500 mt-0.5">{droneRules.find(r => r.id === newGeofence.droneRule)?.description}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Camera Behavior</label>
                            <select value={newGeofence.cameraRule} onChange={(e) => setNewGeofence({...newGeofence, cameraRule: e.target.value})} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm">
                              <option value="allow">Allow</option><option value="alert">Alert on Motion</option><option value="record">Force Recording</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Sensor Behavior</label>
                            <select value={newGeofence.sensorRule} onChange={(e) => setNewGeofence({...newGeofence, sensorRule: e.target.value})} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm">
                              <option value="allow">Normal</option><option value="enhanced">Enhanced Monitoring</option><option value="alert">Alert Threshold Lowered</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Schedule */}
                    <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-white font-medium text-xs flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-orange-400" /> Schedule</h4>
                        <label className="flex items-center gap-1.5">
                          <input type="checkbox" checked={newGeofence.scheduleEnabled} onChange={(e) => setNewGeofence({...newGeofence, scheduleEnabled: e.target.checked})} className="w-3.5 h-3.5 rounded" />
                          <span className="text-xs text-slate-300">Enable</span>
                        </label>
                      </div>
                      {newGeofence.scheduleEnabled && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">From</label>
                              <input type="time" className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Until</label>
                              <input type="time" className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm" />
                            </div>
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                              <button key={day} className={`px-2.5 py-1 rounded text-xs font-medium ${newGeofence.activeDays?.includes(day.toLowerCase()) ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-400'}`}>{day}</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ALERTS TAB */}
                {geoTab === 'alerts' && (
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer">
                      <input type="checkbox" checked={newGeofence.alertOnEntry} onChange={(e) => setNewGeofence({...newGeofence, alertOnEntry: e.target.checked})} className="w-4 h-4 rounded" />
                      <div>
                        <span className="text-white text-sm">Alert on Entry</span>
                        <p className="text-xs text-slate-500">Notify when device enters zone</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer">
                      <input type="checkbox" checked={newGeofence.alertOnExit} onChange={(e) => setNewGeofence({...newGeofence, alertOnExit: e.target.checked})} className="w-4 h-4 rounded" />
                      <div>
                        <span className="text-white text-sm">Alert on Exit</span>
                        <p className="text-xs text-slate-500">Notify when device leaves zone</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer">
                      <input type="checkbox" checked={newGeofence.requireApproval} onChange={(e) => setNewGeofence({...newGeofence, requireApproval: e.target.checked})} className="w-4 h-4 rounded" />
                      <div>
                        <span className="text-white text-sm">Require Approval</span>
                        <p className="text-xs text-slate-500">Operator must approve entry</p>
                      </div>
                    </label>
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <span className="text-white text-sm">Notification Channels</span>
                      <div className="flex gap-4 mt-2">
                        <label className="flex items-center gap-1.5 text-sm">
                          <input type="checkbox" checked={newGeofence.notifyEmail} onChange={(e) => setNewGeofence({...newGeofence, notifyEmail: e.target.checked})} className="w-3.5 h-3.5 rounded" />
                          <span className="text-slate-300">Email</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-sm">
                          <input type="checkbox" checked={newGeofence.notifyPush} onChange={(e) => setNewGeofence({...newGeofence, notifyPush: e.target.checked})} className="w-3.5 h-3.5 rounded" />
                          <span className="text-slate-300">Push</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-sm">
                          <input type="checkbox" checked={newGeofence.notifySMS} onChange={(e) => setNewGeofence({...newGeofence, notifySMS: e.target.checked})} className="w-3.5 h-3.5 rounded" />
                          <span className="text-slate-300">SMS</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* STYLE TAB */}
                {geoTab === 'style' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Color</label>
                        <div className="flex gap-2">
                          <input type="color" value={newGeofence.color} onChange={(e) => setNewGeofence({...newGeofence, color: e.target.value})} className="w-10 h-10 rounded cursor-pointer border border-slate-600" />
                          <input type="text" value={newGeofence.color} onChange={(e) => setNewGeofence({...newGeofence, color: e.target.value})} className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Stroke Width</label>
                        <select value={newGeofence.strokeWidth} onChange={(e) => setNewGeofence({...newGeofence, strokeWidth: parseInt(e.target.value)})} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm">
                          <option value="1">Thin (1px)</option><option value="2">Normal (2px)</option><option value="3">Medium (3px)</option><option value="4">Thick (4px)</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Fill Opacity: {newGeofence.fillOpacity}%</label>
                      <input type="range" min="0" max="100" value={newGeofence.fillOpacity} onChange={(e) => setNewGeofence({...newGeofence, fillOpacity: parseInt(e.target.value)})} className="w-full" />
                    </div>
                    {/* Preview */}
                    <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                      <p className="text-xs text-slate-400 mb-2">Preview</p>
                      <div className="h-16 rounded-lg border-2 flex items-center justify-center" style={{ borderColor: newGeofence.color, backgroundColor: `${newGeofence.color}${Math.round(newGeofence.fillOpacity * 2.55).toString(16).padStart(2, '0')}` }}>
                        <span className="text-white text-xs font-medium drop-shadow">{newGeofence.name || 'Zone Name'}</span>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-700 bg-slate-800/50 flex-shrink-0">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={newGeofence.active} onChange={(e) => setNewGeofence({...newGeofence, active: e.target.checked})} className="w-4 h-4 rounded" />
                  <span className="text-sm text-slate-300">Active</span>
                </label>
                <div className="flex gap-2">
                  <button onClick={() => setShowGeofenceEditor(false)} className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">Cancel</button>
                  <button onClick={handleSaveGeofence} className="px-5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium">{editingGeofence ? 'Save' : 'Create'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Side Panel Expand Button */}
        {!sidePanelOpen && (
          <div className="flex-shrink-0 flex flex-col items-center pt-2">
            <button
              onClick={() => setSidePanelOpen(true)}
              className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 hover:border-orange-500/50 text-slate-400 hover:text-orange-400 transition-all"
              title="Show panel"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="mt-2 flex flex-col items-center gap-1">
              <span className="text-xs text-slate-600 font-medium" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                {sidePanel.toUpperCase()}
              </span>
            </div>
          </div>
        )}
        
        {/* Map Container */}
        <div className={`flex-1 bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden relative ${isFullscreen ? 'h-full' : 'min-h-0'}`}>
          {/* Simulated Google Map */}
          <div 
            ref={mapRef}
            tabIndex={0}
            className={`w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 relative outline-none ${
              markerPickMode ? 'cursor-crosshair' : isPanning ? 'cursor-grabbing' : 'cursor-grab'
            } ${isMapFocused ? 'ring-2 ring-orange-500/50 ring-inset' : ''}`}
            onWheel={handleMapWheel}
            onMouseDown={handleMapMouseDown}
            onMouseMove={handleMapMouseMove}
            onMouseUp={handleMapMouseUp}
            onMouseLeave={() => { setIsPanning(false); setIsMapFocused(false); }}
            onFocus={() => setIsMapFocused(true)}
            onBlur={() => setIsMapFocused(false)}
            onKeyDown={handleMapKeyDown}
            onClick={(e) => {
              if (markerPickMode && showMarkerEditor) {
                const rect = e.currentTarget.getBoundingClientRect();
                const xPct = (e.clientX - rect.left) / rect.width;
                const yPct = (e.clientY - rect.top) / rect.height;
                const lat = (43.26 - (yPct * 0.12)).toFixed(4);
                const lng = (2.28 + (xPct * 0.15)).toFixed(4);
                setNewMarker(prev => ({...prev, lat, lng}));
                setMarkerPickMode(false);
              }
            }}
          >
            {/* Pick mode banner */}
            {markerPickMode && (
              <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-30 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium animate-pulse">
                <Crosshair className="w-4 h-4" />
                Click anywhere on map to set marker location
              </div>
            )}

            {/* Compass Rose — fixed in top-right corner of tactical map */}
            <div className="absolute top-3 right-3 z-25" style={{ width: '52px' }}>
              <svg viewBox="0 0 60 60" width="52" height="52">
                <circle cx="30" cy="30" r="28" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />
                {/* Outer ring ticks (every 30°) */}
                {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg => (
                  <line key={deg} x1="30" y1="4" x2="30" y2={deg % 90 === 0 ? "8" : "6"} stroke={deg % 90 === 0 ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)"} strokeWidth={deg % 90 === 0 ? "1" : "0.5"} transform={`rotate(${deg}, 30, 30)`} />
                ))}
                {/* N pointer (red) */}
                <polygon points="30,5 27,17 33,17" fill="#ef4444" />
                {/* S pointer */}
                <polygon points="30,55 27,43 33,43" fill="rgba(255,255,255,0.3)" />
                {/* E/W lines */}
                <line x1="53" y1="30" x2="43" y2="30" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
                <line x1="7" y1="30" x2="17" y2="30" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
                {/* Cardinal labels */}
                <text x="30" y="16" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#ef4444" fontFamily="system-ui">N</text>
                <text x="30" y="51" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.5)" fontFamily="system-ui">S</text>
                <text x="47" y="33" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.5)" fontFamily="system-ui">E</text>
                <text x="13" y="33" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.5)" fontFamily="system-ui">W</text>
                {/* Intercardinals */}
                <text x="42" y="18" textAnchor="middle" fontSize="4.5" fill="rgba(255,255,255,0.25)" fontFamily="system-ui">NE</text>
                <text x="42" y="47" textAnchor="middle" fontSize="4.5" fill="rgba(255,255,255,0.25)" fontFamily="system-ui">SE</text>
                <text x="18" y="47" textAnchor="middle" fontSize="4.5" fill="rgba(255,255,255,0.25)" fontFamily="system-ui">SW</text>
                <text x="18" y="18" textAnchor="middle" fontSize="4.5" fill="rgba(255,255,255,0.25)" fontFamily="system-ui">NW</text>
                {/* Center dot */}
                <circle cx="30" cy="30" r="2" fill="white" />
                <circle cx="30" cy="30" r="1" fill="rgba(0,0,0,0.5)" />
              </svg>
            </div>

            {/* Cardinal Edge Labels — along map borders */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20">
              <span className="text-[10px] font-bold text-red-400/60 tracking-widest">N</span>
            </div>
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-20">
              <span className="text-[10px] font-medium text-slate-500/60 tracking-widest">S</span>
            </div>
            <div className="absolute right-1 top-1/2 -translate-y-1/2 z-20">
              <span className="text-[10px] font-medium text-slate-500/60">E</span>
            </div>
            <div className="absolute left-1 top-1/2 -translate-y-1/2 z-20">
              <span className="text-[10px] font-medium text-slate-500/60">W</span>
            </div>
            
            {/* Google Maps Integration */}
            <div className="absolute inset-0">
              <TacticalMap
                mapMode={mapMode}
                showDevices={showDevices}
                showGeofences={showGeofences}
                showAlerts={showAlerts}
                showFlightPaths={showFlightPaths}
                showMarkers={showMarkers}
                center={mapCenter}
                zoom={mapZoom}
              />
            </div>
          </div>
          
          {/* Map Overlays - Fixed position, not affected by pan/zoom */}
          {/* Coordinates Display */}
          <div className="absolute bottom-4 left-4 px-3 py-2 bg-slate-900/90 rounded-lg text-xs text-slate-300 border border-slate-700">
            <span className="text-slate-500">Cursor:</span> <span className="text-orange-400 font-mono">{mapCenter.lat.toFixed(4)}°N, {mapCenter.lng.toFixed(4)}°E</span> | <span className="text-slate-500">Zoom:</span> <span className="text-orange-400 font-mono">{mapZoom}</span>
          </div>
          
          {/* Zoom Controls */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-1 bg-slate-900/90 rounded-lg border border-slate-700 p-1">
            <button
              onClick={() => setMapZoom(prev => Math.max(1, prev - 1))}
              className="p-2 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <input
              type="range"
              min="1"
              max="20"
              value={mapZoom}
              onChange={(e) => setMapZoom(parseInt(e.target.value))}
              className="w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
            <button
              onClick={() => setMapZoom(prev => Math.min(20, prev + 1))}
              className="p-2 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-slate-700 mx-1" />
            <button
              onClick={resetMapView}
              className="p-2 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
              title="Reset View (0)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
          
          {/* Scale Bar - dynamic based on zoom */}
          <div className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 bg-slate-900/90 rounded-lg border border-slate-700">
            <div className="w-16 h-1 bg-white rounded" />
            <span className="text-xs text-slate-300 font-mono">{Math.round(500 * (14 / mapZoom))}m</span>
          </div>
          
          {/* Legend — collapsed: icon-only strip; expanded: full panel */}
          <div className="absolute top-4 right-4 z-10">
            {!showLegend ? (
              /* Collapsed — tiny bar */
              <button onClick={() => setShowLegend(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900/85 hover:bg-slate-800/95 border border-slate-700 rounded-lg backdrop-blur-sm transition-all text-[10px] text-slate-400 hover:text-white">
                <Layers className="w-3 h-3" />
                <span className="font-bold tracking-wide">KEY</span>
                {fieldCollaborators.length > 0 && <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />}
                {fieldReports.filter(r => !r.acknowledged).length > 0 && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
              </button>
            ) : (
              /* Expanded */
              <div className="bg-slate-900/92 backdrop-blur-sm rounded-lg border border-slate-700 overflow-hidden shadow-xl" style={{ width: 200, maxHeight: 'min(55vh, 420px)' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-800 bg-slate-800/50">
                  <span className="text-[9px] text-slate-500 font-bold tracking-widest">LEGEND</span>
                  <button onClick={() => setShowLegend(false)} className="p-0.5 hover:bg-slate-700 rounded text-slate-500 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                {/* Scrollable content */}
                <div className="overflow-y-auto p-2 space-y-2" style={{ maxHeight: 'min(50vh, 380px)' }}>
                  {/* Devices — inline row */}
                  <div>
                    <p className="text-[8px] text-slate-600 uppercase tracking-widest mb-1">Devices</p>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                      <div className="flex items-center gap-1.5"><span className="text-xs">🚁</span><span className="text-slate-400">Drone</span></div>
                      <div className="flex items-center gap-1.5"><span className="text-xs">📹</span><span className="text-slate-400">Camera</span></div>
                      <div className="flex items-center gap-1.5"><span className="text-xs">📡</span><span className="text-slate-400">Sensor</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-slate-400">Alert</span></div>
                    </div>
                  </div>
                  {/* Collaborators — compact 2-col grid */}
                  <div className="border-t border-slate-800 pt-1.5">
                    <p className="text-[8px] text-slate-600 uppercase tracking-widest mb-1">Collaborators</p>
                    <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 text-[10px]">
                      {Object.entries(roleIcons).map(([role, icon]) => {
                        const count = fieldCollaborators.filter(c => c.role === role).length;
                        return (
                          <div key={role} className="flex items-center gap-1">
                            <div className="w-4 h-4 rounded-full flex items-center justify-center border flex-shrink-0"
                              style={{ borderColor: roleColors[role], backgroundColor: roleColors[role] + '20' }}>
                              <span className="text-[8px]">{icon}</span>
                            </div>
                            <span className={`truncate ${count > 0 ? 'text-slate-300' : 'text-slate-600'}`}>{roleLabels[role]}</span>
                            {count > 0 && <span className="font-bold ml-auto" style={{ color: roleColors[role] }}>{count}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* Status — single row of dots */}
                  <div className="border-t border-slate-800 pt-1.5">
                    <p className="text-[8px] text-slate-600 uppercase tracking-widest mb-1">Status</p>
                    <div className="flex flex-wrap gap-x-2 gap-y-0 text-[9px]">
                      {[
                        { l: 'OK', c: '#22c55e' }, { l: 'Move', c: '#3b82f6' }, { l: 'H₂O', c: '#f59e0b' },
                        { l: 'Help', c: '#ef4444' }, { l: 'Evac', c: '#a855f7' }, { l: 'SOS', c: '#dc2626' },
                      ].map(s => (
                        <div key={s.l} className="flex items-center gap-0.5"><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.c }} /><span className="text-slate-500">{s.l}</span></div>
                      ))}
                    </div>
                  </div>
                  {/* Field Reports — only if any exist */}
                  {fieldReports.length > 0 && (
                    <div className="border-t border-slate-800 pt-1.5">
                      <p className="text-[8px] text-slate-600 uppercase tracking-widest mb-1">Reports</p>
                      <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 text-[10px]">
                        {Object.entries(
                          fieldReports.reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {})
                        ).map(([type, count]) => {
                          const meta = reportTypeMeta[type] || { icon: '📢', label: type, color: '#64748b' };
                          return (
                            <div key={type} className="flex items-center gap-1">
                              <span className="text-[9px]">{meta.icon}</span>
                              <span className="text-slate-400 truncate">{meta.label}</span>
                              <span className="ml-auto text-slate-600">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Assignments count */}
                  {actionAssignments.length > 0 && (
                    <div className="border-t border-slate-800 pt-1.5 flex items-center gap-1.5 text-[10px]">
                      <span>📌</span>
                      <span className="text-orange-400 font-bold">{actionAssignments.length} Assignment{actionAssignments.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Keyboard Hint - shows when map is focused */}
          {isMapFocused && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 px-3 py-1.5 bg-slate-900/90 rounded-lg border border-orange-500/50 text-xs text-slate-400">
              <span className="text-orange-400">↑↓←→</span> Pan • <span className="text-orange-400">+/-</span> Zoom • <span className="text-orange-400">0</span> Reset • <span className="text-orange-400">Scroll</span> Zoom
            </div>
          )}
          
          {/* Selected Device Info Panel */}
          {selectedDevice && (
            <div className="absolute top-4 left-4 w-80 bg-slate-900/95 rounded-xl border border-slate-700 overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between p-3 bg-slate-800/50 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getDeviceMarkerIcon(selectedDevice)}</span>
                  <span className="text-white font-medium">{selectedDevice.name}</span>
                  {selectedDevice.hasActiveDetection && !selectedDevice.alertAcknowledged && (
                    <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded animate-pulse">
                      {selectedDevice.detectionType?.toUpperCase()}
                    </span>
                  )}
                </div>
                <button onClick={() => { setSelectedDevice(null); setShowDeviceView(false); }} className="p-1 hover:bg-slate-700 rounded">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              
              {/* Device Camera/Sensor View */}
              {showDeviceView && (selectedDevice.deviceType === 'camera' || selectedDevice.deviceType === 'drone') && (
                <div className="relative aspect-video bg-slate-950">
                  {/* Simulated Video Feed */}
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
                    {selectedDevice.hasActiveDetection && !selectedDevice.alertAcknowledged ? (
                      <div className="text-center">
                        <div className="relative">
                          <Camera className="w-16 h-16 text-slate-600 mx-auto" />
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                            <Flame className="w-4 h-4 text-white" />
                          </div>
                        </div>
                        <p className="text-red-400 font-medium mt-2">{selectedDevice.detectionType?.toUpperCase()} DETECTED</p>
                        <p className="text-slate-500 text-xs mt-1">Live feed from {selectedDevice.name}</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Camera className="w-12 h-12 text-slate-600 mx-auto" />
                        <p className="text-slate-400 text-sm mt-2">Live Feed</p>
                        <p className="text-slate-500 text-xs">{selectedDevice.name}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Video Overlay Info */}
                  <div className="absolute top-2 left-2 flex items-center gap-2">
                    <span className="px-2 py-1 bg-black/70 rounded text-xs text-white flex items-center gap-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      LIVE
                    </span>
                    <span className="px-2 py-1 bg-black/70 rounded text-xs text-white">{selectedDevice.fps} FPS</span>
                  </div>
                  
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <button 
                      onClick={() => setDeviceViewSize(deviceViewSize === 'large' ? 'medium' : 'large')}
                      className="p-1.5 bg-black/70 rounded hover:bg-black/90"
                    >
                      {deviceViewSize === 'large' ? <Minimize2 className="w-3 h-3 text-white" /> : <Maximize2 className="w-3 h-3 text-white" />}
                    </button>
                  </div>
                  
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                    <span className="px-2 py-1 bg-black/70 rounded text-xs text-white">{selectedDevice.location}</span>
                    <span className="px-2 py-1 bg-black/70 rounded text-xs text-white">{selectedDevice.altitude}</span>
                  </div>
                  
                  {/* Detection Bounding Box Simulation */}
                  {selectedDevice.hasActiveDetection && !selectedDevice.alertAcknowledged && (
                    <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 border-2 border-red-500 rounded animate-pulse">
                      <span className="absolute -top-5 left-0 px-2 py-0.5 bg-red-500 text-white text-xs rounded">
                        {selectedDevice.detectionType} 94%
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Sensor View */}
              {showDeviceView && selectedDevice.deviceType === 'sensor' && (
                <div className="p-3 bg-slate-950">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-slate-800/50 rounded-lg text-center">
                      <Thermometer className="w-4 h-4 text-orange-400 mx-auto" />
                      <p className="text-lg font-bold text-white mt-1">24°C</p>
                      <p className="text-xs text-slate-500">Temperature</p>
                    </div>
                    <div className="p-2 bg-slate-800/50 rounded-lg text-center">
                      <Droplets className="w-4 h-4 text-blue-400 mx-auto" />
                      <p className="text-lg font-bold text-white mt-1">45%</p>
                      <p className="text-xs text-slate-500">Humidity</p>
                    </div>
                    <div className="p-2 bg-slate-800/50 rounded-lg text-center">
                      <Wind className="w-4 h-4 text-cyan-400 mx-auto" />
                      <p className="text-lg font-bold text-white mt-1">12 km/h</p>
                      <p className="text-xs text-slate-500">Wind</p>
                    </div>
                    <div className={`p-2 rounded-lg text-center ${selectedDevice.hasActiveDetection ? 'bg-red-500/20' : 'bg-slate-800/50'}`}>
                      <Flame className={`w-4 h-4 mx-auto ${selectedDevice.hasActiveDetection ? 'text-red-400' : 'text-slate-400'}`} />
                      <p className={`text-lg font-bold mt-1 ${selectedDevice.hasActiveDetection ? 'text-red-400' : 'text-white'}`}>
                        {selectedDevice.hasActiveDetection ? 'HIGH' : 'LOW'}
                      </p>
                      <p className="text-xs text-slate-500">Fire Risk</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Device Info */}
              <div className="p-3 space-y-2 text-sm border-t border-slate-700">
                <div className="flex justify-between"><span className="text-slate-400">Type</span><span className="text-white capitalize">{selectedDevice.deviceType}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Status</span><span className={selectedDevice.status === 'active' ? 'text-green-400' : 'text-yellow-400'}>{selectedDevice.status}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Signal</span><span className="text-white">{selectedDevice.signalStrength}%</span></div>
                {selectedDevice.deviceType === 'drone' && (
                  <>
                    <div className="flex justify-between"><span className="text-slate-400">Battery</span><span className={selectedDevice.batteryLevel > 50 ? 'text-green-400' : selectedDevice.batteryLevel > 20 ? 'text-yellow-400' : 'text-red-400'}>{selectedDevice.batteryLevel}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Control</span><span className={selectedDevice.controlMode === 'watchtower' ? 'text-orange-400' : 'text-cyan-400'}>{selectedDevice.controlMode === 'watchtower' ? 'Watchtower AI' : selectedDevice.pilot}</span></div>
                  </>
                )}
              </div>
              
              {/* Actions */}
              <div className="p-3 border-t border-slate-700 space-y-2">
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowDeviceView(!showDeviceView)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 ${
                      showDeviceView ? 'bg-orange-500 text-white' : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                    }`}
                  >
                    {selectedDevice.deviceType === 'sensor' ? <Activity className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                    {showDeviceView ? 'Hide Feed' : 'Show Feed'}
                  </button>
                  <button className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs flex items-center justify-center gap-1">
                    <Crosshair className="w-3 h-3" />
                    Center
                  </button>
                </div>
                {selectedDevice.hasActiveDetection && !selectedDevice.alertAcknowledged && (
                  <button className="w-full px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold">
                    ACKNOWLEDGE ALERT
                  </button>
                )}
              </div>
            </div>
          )}
          
          {/* Operator Markers on Map */}
          {showMarkers && markers.map(marker => {
            const IconComponent = getMarkerIcon(marker.icon);
            return (
              <div 
                key={marker.id}
                className="absolute cursor-pointer group"
                style={{ 
                  top: `${20 + (marker.id * 8)}%`, 
                  left: `${15 + (marker.id * 12)}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-transform hover:scale-110 ${
                    marker.priority === 'critical' ? 'animate-pulse' : ''
                  }`}
                  style={{ 
                    backgroundColor: `${marker.color}30`,
                    borderColor: marker.color
                  }}
                >
                  <IconComponent className="w-4 h-4" style={{ color: marker.color }} />
                </div>
                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 px-2 py-1 rounded text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-slate-700">
                  {marker.name}
                </div>
              </div>
            );
          })}

          {/* Field Collaborator Markers */}
          {showFieldCollaborators && fieldCollaborators.map((collab, idx) => {
            const posTop = 15 + ((idx * 17 + 7) % 65);
            const posLeft = 10 + ((idx * 23 + 11) % 70);
            const rColor = roleColors[collab.role] || '#f97316';
            const sColor = statusColors[collab.lastStatus] || '#22c55e';
            const assignment = actionAssignments.find(a => a.collaboratorId === collab.id && a.status === 'dispatched');
            return (
              <div
                key={`fc-${collab.id}`}
                className="absolute cursor-pointer group z-10"
                style={{ top: `${posTop}%`, left: `${posLeft}%`, transform: 'translate(-50%, -50%)' }}
                onClick={() => { setAssignTarget({ type: 'collaborator', ...collab }); setShowAssignAction(true); }}
              >
                {/* Outer status ring */}
                <div className="absolute -inset-1 rounded-full border-2 opacity-70"
                  style={{ borderColor: sColor, boxShadow: `0 0 8px ${sColor}50` }} />
                {/* Main marker — role colored */}
                <div className="w-9 h-9 rounded-full flex items-center justify-center border-2 transition-transform hover:scale-125 relative"
                  style={{ borderColor: rColor, backgroundColor: rColor + '30', boxShadow: `0 0 14px ${rColor}35` }}>
                  <span className="text-base">{roleIcons[collab.role] || '👤'}</span>
                </div>
                {/* Emergency pulse */}
                {collab.lastStatus === 'emergency' && (
                  <div className="absolute -inset-1.5 rounded-full border-2 border-red-500 animate-ping opacity-40" />
                )}
                {/* Name + role label */}
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap"
                    style={{ backgroundColor: '#0f172acc', color: rColor, border: `1px solid ${rColor}40` }}>
                    {collab.name?.split(' ')[0]}
                  </div>
                </div>
                {/* Status dot — bottom right of marker */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-slate-900"
                  style={{ backgroundColor: sColor }} />
                {/* Assignment indicator */}
                {assignment && (
                  <div className="absolute -top-3 -right-2 px-1 py-0 bg-orange-500 rounded text-[7px] font-bold text-white">
                    📌
                  </div>
                )}
                {/* Hover tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-slate-900 border border-slate-600 rounded-lg p-2 w-44 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center border"
                      style={{ borderColor: rColor, backgroundColor: rColor + '25' }}>
                      <span className="text-[10px]">{roleIcons[collab.role] || '👤'}</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{collab.name}</div>
                      <div className="text-[10px]" style={{ color: rColor }}>{roleLabels[collab.role] || collab.role}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sColor }} />
                    {collab.lastStatus?.toUpperCase() || 'OK'}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1">📍 {collab.lat}, {collab.lng}</div>
                  {assignment && <div className="text-[9px] text-orange-400 mt-1">→ {assignment.target?.name}</div>}
                  <div className="text-[9px] text-green-400 mt-1">Click to assign action</div>
                </div>
              </div>
            );
          })}

          {/* Field Report Markers */}
          {showFieldReports && fieldReports.map((report, idx) => {
            const meta = reportTypeMeta[report.type] || { icon: '📢', label: report.type, color: '#64748b' };
            const posTop = 20 + ((idx * 19 + 13) % 55);
            const posLeft = 18 + ((idx * 29 + 5) % 60);
            return (
              <div
                key={`fr-${report.id}`}
                className="absolute cursor-pointer group z-10"
                style={{ top: `${posTop}%`, left: `${posLeft}%`, transform: 'translate(-50%, -50%)' }}
                onClick={() => setSelectedFieldReport(selectedFieldReport?.id === report.id ? null : report)}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-transform hover:scale-125 ${!report.acknowledged ? 'animate-pulse' : ''}`}
                  style={{ borderColor: meta.color, backgroundColor: meta.color + '25' }}>
                  <span className="text-sm">{meta.icon}</span>
                </div>
                {/* Priority badge */}
                {report.priority === 'critical' && (
                  <div className="absolute -top-2 -right-2 px-1 py-0 bg-red-500 rounded text-[7px] font-bold text-white animate-pulse">
                    !!!
                  </div>
                )}
                {report.priority === 'high' && !report.acknowledged && (
                  <div className="absolute -top-2 -right-2 w-3 h-3 bg-yellow-500 rounded-full" />
                )}
                {/* Hover card */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 border rounded-lg p-2 w-44 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20"
                  style={{ borderColor: meta.color + '60' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span>{meta.icon}</span>
                    <span className="text-xs font-bold text-white">{report.mode === 'support' ? 'REQUEST: ' : ''}{meta.label}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">{report.priority?.toUpperCase()} · {report.time}</div>
                  {report.note && <div className="text-[10px] text-slate-300 mt-1 truncate">"{report.note}"</div>}
                  <div className="text-[9px] text-orange-400 mt-1">Click to view / assign</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Emergency Control Panel Modal */}
      {showEmergencyPanel && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border-2 border-red-500 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl shadow-red-500/20">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-red-500/20 border-b border-red-500/50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center animate-pulse">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase">Emergency Drone Control</h3>
                  <p className="text-xs text-red-300">{selectedDrones.length} drone(s) selected</p>
                </div>
              </div>
              <button onClick={() => setShowEmergencyPanel(false)} className="p-1.5 hover:bg-red-500/30 rounded-lg">
                <X className="w-5 h-5 text-red-300" />
              </button>
            </div>
            
            {/* Selected Drones */}
            <div className="p-4 border-b border-slate-700">
              <p className="text-xs text-slate-400 mb-2">AFFECTED DRONES:</p>
              <div className="flex flex-wrap gap-2">
                {droneFleet.filter(d => selectedDrones.includes(d.id)).map(drone => (
                  <span key={drone.id} className="px-3 py-1 bg-slate-800 rounded-lg text-sm text-white flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-purple-400" />
                    {drone.name}
                    <button 
                      onClick={() => toggleDroneSelection(drone.id)}
                      className="ml-1 text-slate-400 hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
            
            {/* Emergency Actions Grid */}
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3">
                {emergencyActions.map(action => {
                  const IconComponent = action.icon;
                  return (
                    <button
                      key={action.id}
                      onClick={() => { handleEmergencyAction(action); setShowEmergencyPanel(false); }}
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
                        <IconComponent className={`w-6 h-6 ${
                          action.color === 'red' ? 'text-red-400' :
                          action.color === 'yellow' ? 'text-yellow-400' :
                          action.color === 'cyan' ? 'text-cyan-400' :
                          action.color === 'blue' ? 'text-blue-400' :
                          action.color === 'purple' ? 'text-purple-400' :
                          'text-orange-400'
                        }`} />
                        <span className={`font-bold ${
                          action.color === 'red' ? 'text-red-400' :
                          action.color === 'yellow' ? 'text-yellow-400' :
                          action.color === 'cyan' ? 'text-cyan-400' :
                          action.color === 'blue' ? 'text-blue-400' :
                          action.color === 'purple' ? 'text-purple-400' :
                          'text-orange-400'
                        }`}>{action.label}</span>
                      </div>
                      <p className="text-sm text-slate-400">{action.description}</p>
                      {action.confirmRequired && (
                        <p className="text-xs text-slate-500 mt-2">⚠️ Requires confirmation</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-between">
              <button
                onClick={() => { selectAllDrones(); }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
              >
                Select All Drones
              </button>
              <button
                onClick={() => setShowEmergencyPanel(false)}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Target Assignment Modal */}
      {showTargetAssignment && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Target className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Assign Target</h3>
                  <p className="text-sm text-slate-400">{selectedDrones.length} drone(s) will navigate to target</p>
                </div>
              </div>
              <button onClick={() => setShowTargetAssignment(false)} className="p-2 hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            {/* Selected Drones */}
            <div className="p-4 border-b border-slate-700">
              <p className="text-xs text-slate-400 mb-2">SENDING DRONES:</p>
              <div className="flex flex-wrap gap-2">
                {droneFleet.filter(d => selectedDrones.includes(d.id)).map(drone => (
                  <span key={drone.id} className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-sm">
                    {drone.name}
                  </span>
                ))}
              </div>
            </div>
            
            {/* Target Selection */}
            <div className="p-4 max-h-80 overflow-y-auto">
              <p className="text-xs text-slate-400 mb-3">SELECT TARGET:</p>
              <div className="space-y-2">
                {markers.map(marker => {
                  const IconComponent = getMarkerIcon(marker.icon);
                  return (
                    <button
                      key={marker.id}
                      onClick={() => assignTargetToDrones(marker, selectedDrones)}
                      className="w-full p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-purple-500/50 rounded-lg text-left transition-all flex items-center gap-3"
                    >
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${marker.color}30` }}
                      >
                        <IconComponent className="w-5 h-5" style={{ color: marker.color }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">{marker.name}</p>
                        <p className="text-xs text-slate-500">{marker.lat}, {marker.lng}</p>
                      </div>
                      {marker.priority === 'critical' && (
                        <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">CRITICAL</span>
                      )}
                    </button>
                  );
                })}
                
                {/* Custom Coordinates Option */}
                <div className="mt-4 p-3 border border-dashed border-slate-600 rounded-lg">
                  <p className="text-sm text-slate-400 mb-2">Or enter custom coordinates:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Latitude" className="px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" />
                    <input type="text" placeholder="Longitude" className="px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" />
                  </div>
                  <button className="mt-2 w-full px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm">
                    Send to Coordinates
                  </button>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-slate-700 bg-slate-800/50">
              <button
                onClick={() => setShowTargetAssignment(false)}
                className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      

      {/* Field Action Assignment Modal */}
      {showAssignAction && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-orange-500/10 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <Target className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Assign Action</h3>
                  <p className="text-[10px] text-slate-400">
                    {assignTarget?.type === 'collaborator' ? `Send ${assignTarget.name} to a target` : `Assign responder to: ${assignTarget?.name || 'target'}`}
                  </p>
                </div>
              </div>
              <button onClick={() => { setShowAssignAction(false); setAssignTarget(null); }} className="p-1.5 hover:bg-slate-700 rounded-lg">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* If we clicked a collaborator, show targets to send them to */}
              {assignTarget?.type === 'collaborator' && (
                <>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2 font-bold">Sending: {assignTarget.name} ({assignTarget.role})</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-2 font-bold">Select destination:</p>
                    {/* Active field reports as targets */}
                    {fieldReports.filter(r => !r.acknowledged).length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] text-red-400 mb-1.5 font-bold tracking-wider">📋 UNACKNOWLEDGED REPORTS</p>
                        <div className="space-y-1.5">
                          {fieldReports.filter(r => !r.acknowledged).map(report => {
                            const meta = reportTypeMeta[report.type] || { icon: '📢', label: report.type, color: '#64748b' };
                            return (
                              <button key={report.id} onClick={() => handleAssignAction(assignTarget.id, { ...report, name: meta.label, lat: report.location?.lat, lng: report.location?.lng }, 'respond')}
                                className="w-full p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-orange-500/50 rounded-lg text-left flex items-center gap-2.5 transition-all">
                                <span className="text-lg">{meta.icon}</span>
                                <div className="flex-1">
                                  <div className="text-xs font-bold text-white">{report.mode === 'support' ? '🤝 ' : ''}{meta.label}</div>
                                  <div className="text-[10px] text-slate-500">📍 {report.location?.lat}, {report.location?.lng}</div>
                                </div>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  report.priority === 'critical' ? 'bg-red-500/30 text-red-400' : report.priority === 'high' ? 'bg-yellow-500/30 text-yellow-400' : 'bg-slate-700 text-slate-400'
                                }`}>{report.priority?.toUpperCase()}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {/* Existing map markers as targets */}
                    <p className="text-[10px] text-blue-400 mb-1.5 font-bold tracking-wider">📍 MAP MARKERS</p>
                    <div className="space-y-1.5">
                      {markers.map(marker => {
                        const IconComponent = getMarkerIcon(marker.icon);
                        return (
                          <button key={marker.id} onClick={() => handleAssignAction(assignTarget.id, marker, 'go-to')}
                            className="w-full p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-orange-500/50 rounded-lg text-left flex items-center gap-2.5 transition-all">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: marker.color + '25' }}>
                              <IconComponent className="w-4 h-4" style={{ color: marker.color }} />
                            </div>
                            <div className="flex-1">
                              <div className="text-xs font-bold text-white">{marker.name}</div>
                              <div className="text-[10px] text-slate-500">{marker.lat}, {marker.lng}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* If we clicked a report, show collaborators to assign */}
              {assignTarget?.type === 'report' && (
                <>
                  <div className="p-2.5 rounded-lg border" style={{ backgroundColor: (reportTypeMeta[assignTarget.type]?.color || '#64748b') + '15', borderColor: (reportTypeMeta[assignTarget.type]?.color || '#64748b') + '40' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{reportTypeMeta[assignTarget.type]?.icon || '📢'}</span>
                      <div>
                        <div className="text-xs font-bold text-white">{assignTarget.mode === 'support' ? '🤝 Request: ' : '🚨 Report: '}{reportTypeMeta[assignTarget.type]?.label || assignTarget.type}</div>
                        <div className="text-[10px] text-slate-400">📍 {assignTarget.lat}, {assignTarget.lng} · {assignTarget.time}</div>
                        {assignTarget.note && <div className="text-[10px] text-slate-300 mt-1">"{assignTarget.note}"</div>}
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-2 font-bold">Send a collaborator:</p>
                    {fieldCollaborators.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500">No field collaborators available</div>
                    ) : (
                      <div className="space-y-1.5">
                        {fieldCollaborators.map(collab => (
                          <button key={collab.id} onClick={() => { handleAssignAction(collab.id, assignTarget, 'respond'); acknowledgeReport(assignTarget.id); }}
                            className="w-full p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-green-500/50 rounded-lg text-left flex items-center gap-2.5 transition-all">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center border-2"
                              style={{ borderColor: statusColors[collab.lastStatus] || '#22c55e', backgroundColor: (statusColors[collab.lastStatus] || '#22c55e') + '25' }}>
                              <span className="text-base">{roleIcons[collab.role] || '👤'}</span>
                            </div>
                            <div className="flex-1">
                              <div className="text-xs font-bold text-white">{collab.name}</div>
                              <div className="text-[10px] text-slate-500">{collab.role} · {collab.lastStatus?.toUpperCase()}</div>
                            </div>
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-[10px] font-bold">SEND</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Also assign drones */}
                  <div>
                    <p className="text-[10px] text-purple-400 mb-1.5 font-bold tracking-wider">🚁 OR ASSIGN DRONE</p>
                    <div className="space-y-1.5">
                      {droneFleet.filter(d => d.status === 'active').map(drone => (
                        <button key={drone.id} onClick={() => { assignTargetToDrones({ ...assignTarget, id: assignTarget.id }, [drone.id]); acknowledgeReport(assignTarget.id); setShowAssignAction(false); setAssignTarget(null); }}
                          className="w-full p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-purple-500/50 rounded-lg text-left flex items-center gap-2.5 transition-all">
                          <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                            <Navigation className="w-4 h-4 text-purple-400" />
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-bold text-white">{drone.name}</div>
                            <div className="text-[10px] text-slate-500">🔋 {drone.batteryLevel}% · {drone.mode}</div>
                          </div>
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-[10px] font-bold">FLY</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-700 bg-slate-800/50 flex-shrink-0">
              <button onClick={() => { setShowAssignAction(false); setAssignTarget(null); }}
                className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Path Editor Modal */}
      {showPathEditor && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Flight Path Editor</h3>
                  <p className="text-sm text-slate-400">Define waypoints for {selectedDrones.length} drone(s)</p>
                </div>
              </div>
              <button onClick={() => setShowPathEditor(false)} className="p-2 hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            {/* Path Type Selection */}
            <div className="p-4 border-b border-slate-700">
              <p className="text-xs text-slate-400 mb-2">PATH TYPE:</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'patrol', label: 'Patrol Loop', icon: RefreshCw },
                  { id: 'linear', label: 'Linear Path', icon: ArrowUpRight },
                  { id: 'survey', label: 'Grid Survey', icon: Grid },
                  { id: 'orbit', label: 'Orbit Point', icon: Circle },
                ].map(type => (
                  <button
                    key={type.id}
                    className="p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg text-center"
                  >
                    <type.icon className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                    <p className="text-xs text-white">{type.label}</p>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Waypoints */}
            <div className="p-4 max-h-60 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-400">WAYPOINTS:</p>
                <button className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Waypoint
                </button>
              </div>
              
              <div className="space-y-2">
                {[
                  { id: 1, lat: '43.2141', lng: '2.3522', alt: '120', action: 'Start', speed: '40' },
                  { id: 2, lat: '43.2180', lng: '2.3550', alt: '150', action: 'Waypoint', speed: '45' },
                  { id: 3, lat: '43.2200', lng: '2.3600', alt: '150', action: 'Loiter 60s', speed: '0' },
                  { id: 4, lat: '43.2141', lng: '2.3522', alt: '120', action: 'Return', speed: '40' },
                ].map((wp, idx) => (
                  <div key={wp.id} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg">
                    <span className="w-6 h-6 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <input type="text" value={wp.lat} className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs" placeholder="Lat" />
                    <input type="text" value={wp.lng} className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs" placeholder="Lng" />
                    <input type="text" value={wp.alt} className="w-14 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs" placeholder="Alt" />
                    <select className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs">
                      <option>Waypoint</option>
                      <option>Loiter</option>
                      <option>Photo</option>
                      <option>Video Start</option>
                      <option>Video Stop</option>
                    </select>
                    <button className="p-1 text-slate-400 hover:text-red-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              
              {/* Add from Markers */}
              <div className="mt-4 p-3 bg-slate-800/30 rounded-lg">
                <p className="text-xs text-slate-400 mb-2">Quick add from markers:</p>
                <div className="flex flex-wrap gap-1">
                  {markers.slice(0, 5).map(marker => (
                    <button 
                      key={marker.id}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> {marker.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Path Settings */}
            <div className="p-4 border-t border-slate-700">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Default Speed</label>
                  <input type="text" defaultValue="45" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Default Altitude</label>
                  <input type="text" defaultValue="150" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Return Action</label>
                  <select className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm">
                    <option>Return to Base</option>
                    <option>Repeat Path</option>
                    <option>Hover at End</option>
                    <option>Land at End</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-between">
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Preview on Map
                </button>
                <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm flex items-center gap-2">
                  <Download className="w-4 h-4" /> Save Path
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPathEditor(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { alert('Path assigned to ' + selectedDrones.length + ' drone(s)'); setShowPathEditor(false); }}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium"
                >
                  Upload to Drones
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Marker Editor Side Panel */}
      {showMarkerEditor && (
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-slate-900 border-l border-slate-700 flex flex-col z-40 shadow-2xl shadow-black/50" style={{ maxHeight: '100%' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${newMarker.color}30` }}
                >
                  {(() => { const Icon = getMarkerIcon(newMarker.icon); return <Icon className="w-4 h-4" style={{ color: newMarker.color }} />; })()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingMarker ? 'Edit Marker' : 'Add Marker'}
                  </h3>
                  <p className="text-xs text-slate-400">Place tactical marker on map</p>
                </div>
              </div>
              <button onClick={() => { setShowMarkerEditor(false); setMarkerPickMode(false); }} className="p-1.5 hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
              {/* Name */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Marker Name *</label>
                <input
                  type="text"
                  value={newMarker.name}
                  onChange={(e) => setNewMarker({...newMarker, name: e.target.value})}
                  placeholder="e.g., Command Post Alpha"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                />
              </div>
              
              {/* Type Selection */}
              <div>
                <label className="block text-xs text-slate-400 mb-2">Marker Type *</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {markerTypes.filter(t => !t.isCollaborator).map(type => {
                    const IconComponent = getMarkerIcon(type.icon);
                    return (
                      <button
                        key={type.id}
                        onClick={() => setNewMarker({...newMarker, type: type.id, icon: type.icon, color: type.color})}
                        className={`p-1.5 rounded-lg border text-center transition-all ${
                          newMarker.type === type.id
                            ? 'bg-orange-500/20 border-orange-500'
                            : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                        }`}
                        title={type.label}
                      >
                        <IconComponent className="w-4 h-4 mx-auto" style={{ color: type.color }} />
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">{type.label.split(' ')[0]}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Coordinates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Latitude *</label>
                  <input
                    type="text"
                    value={newMarker.lat}
                    onChange={(e) => setNewMarker({...newMarker, lat: e.target.value})}
                    placeholder="43.2155"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Longitude *</label>
                  <input
                    type="text"
                    value={newMarker.lng}
                    onChange={(e) => setNewMarker({...newMarker, lng: e.target.value})}
                    placeholder="2.3510"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                  />
                </div>
              </div>
              <button 
                onClick={() => setMarkerPickMode(!markerPickMode)}
                className={`w-full px-3 py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-all ${
                  markerPickMode 
                    ? 'bg-orange-500 text-white ring-2 ring-orange-400 ring-offset-1 ring-offset-slate-900' 
                    : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                }`}
              >
                <Crosshair className="w-4 h-4" />
                {markerPickMode ? 'Click on Map to Place...' : 'Pick Location on Map'}
              </button>
              
              {/* Priority */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Priority</label>
                <select
                  value={newMarker.priority}
                  onChange={(e) => setNewMarker({...newMarker, priority: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              
              {/* Notes */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Notes</label>
                <textarea
                  value={newMarker.notes}
                  onChange={(e) => setNewMarker({...newMarker, notes: e.target.value})}
                  rows={2}
                  placeholder="Additional information..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm resize-none"
                />
              </div>
              
              {/* Options */}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 p-2.5 bg-slate-800/50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newMarker.temporary}
                    onChange={(e) => setNewMarker({...newMarker, temporary: e.target.checked})}
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <span className="text-white text-xs">Temporary</span>
                    <p className="text-[10px] text-slate-500">Auto-remove</p>
                  </div>
                </label>
                <label className="flex items-center gap-2 p-2.5 bg-slate-800/50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newMarker.visibleToAll}
                    onChange={(e) => setNewMarker({...newMarker, visibleToAll: e.target.checked})}
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <span className="text-white text-xs">Shared</span>
                    <p className="text-[10px] text-slate-500">All operators</p>
                  </div>
                </label>
              </div>
            </div>
            
            {/* Footer */}
            <div className="flex items-center justify-end gap-2 p-3 border-t border-slate-700 bg-slate-800/50 flex-shrink-0">
              <button
                onClick={() => { setShowMarkerEditor(false); setMarkerPickMode(false); }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => { handleSaveMarker(); setMarkerPickMode(false); }}
                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium"
              >
                {editingMarker ? 'Save Changes' : 'Add Marker'}
              </button>
            </div>
        </div>
      )}
    </div>
  );
};

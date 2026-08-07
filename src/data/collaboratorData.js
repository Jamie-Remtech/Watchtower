import {
  Wind
} from 'lucide-react';



// ============================================
// WATCHTOWER COLLABORATOR v4.2 — Integrated Field App
// Complete mobile app for external collaborators
// Accepts optional integration props for data flow to control center
// ============================================

// Watchtower Collaborator v4.2 — Tactical + Touch Pan + Toggle D-Pad

// ============================================================================
// WATCHTOWER COLLABORATOR — Universal Emergency Response Mobile App
// ============================================================================
// PWA-ready prototype: anyone with a link can install and join operations instantly
// Designed for: outdoor use, glove-friendly, high contrast, rapid reaction
// ============================================================================

export const ROLE_OPTIONS = [
  { id: 'responder', label: 'First Responder', icon: '🚒', desc: 'Fire crew, EMT, rescue' },
  { id: 'volunteer', label: 'Volunteer', icon: '🤝', desc: 'Civilian volunteer' },
  { id: 'pilot', label: 'Drone Pilot', icon: '🛩️', desc: 'UAV operator' },
  { id: 'coordinator', label: 'Coordinator', icon: '📋', desc: 'Incident management' },
  { id: 'agency', label: 'Partner Agency', icon: '🏛️', desc: 'Police, forestry, military' },
  { id: 'medical', label: 'Medical', icon: '⚕️', desc: 'Paramedic, nurse, doctor' },
];

// Simulated operation data
export const ACTIVE_OPERATION = {
  id: 'OP-2026-0206',
  name: 'Carcassonne North Fire',
  severity: 'critical',
  startTime: '2026-02-06T10:04:00',
  commandPost: { lat: 43.2108, lng: 2.3514, name: 'CP Alpha — Carcassonne Station' },
  fireOrigin: { lat: 43.3772, lng: 2.4483 },
  perimeter: '4.2 hectares',
  windDir: 'SW', windSpeed: '18 km/h',
  humidity: '22%', temp: '38°C',
  fireRiskIndex: 'EXTREME',
};

export const TEAM_POSITIONS = [
  { id: 1, name: 'Cpt. Dubois', role: 'Incident Commander', lat: 43.2108, lng: 2.3514, status: 'active', icon: '⭐' },
  { id: 2, name: 'Marie Laurent', role: 'Drone Pilot', lat: 43.3650, lng: 2.4200, status: 'active', icon: '🛩️' },
  { id: 3, name: 'Pierre Moreau', role: 'Squad Lead A', lat: 43.3800, lng: 2.4350, status: 'active', icon: '🚒' },
  { id: 4, name: 'Sophie Renard', role: 'Medical', lat: 43.3600, lng: 2.4100, status: 'standby', icon: '⚕️' },
  { id: 5, name: 'Lucas Bernard', role: 'Squad Lead B', lat: 43.3900, lng: 2.4600, status: 'active', icon: '🚒' },
  { id: 6, name: 'Jean-Marc Petit', role: 'Water Tanker', lat: 43.3500, lng: 2.3900, status: 'en-route', icon: '🚛' },
];

export const STREAMS = [
  { id: 1, name: 'Drone M3T — Thermal', status: 'live', type: 'thermal', detections: 3, alert: true },
  { id: 2, name: 'Drone M3T — Visual', status: 'live', type: 'visual', detections: 1, alert: false },
  { id: 3, name: 'Tower Cam North', status: 'live', type: 'visual', detections: 0, alert: false },
  { id: 4, name: 'PTZ Cam South', status: 'live', type: 'ptz', detections: 2, alert: true },
];

export const MESSAGES = [
  { id: 1, from: 'COMMAND', channel: 'ALL', time: '12:15', text: 'Wind shift expected 12:30. All units prepare for direction change NW.', priority: 'high', type: 'broadcast' },
  { id: 2, from: 'Cpt. Dubois', channel: 'TACTICAL', time: '12:12', text: 'Squad A hold position at marker 3. Squad B advance to northern ridge.', priority: 'normal', type: 'order' },
  { id: 3, from: 'Marie Laurent', channel: 'AIR-OPS', time: '12:10', text: 'Drone 1 detecting new hotspot 200m NE of perimeter. Sending coordinates.', priority: 'high', type: 'intel' },
  { id: 4, from: 'Sophie Renard', channel: 'MEDICAL', time: '12:08', text: 'Medical station ready at CP Alpha. Full triage capability.', priority: 'normal', type: 'status' },
  { id: 5, from: 'SYSTEM', channel: 'ALL', time: '12:04', text: '🔴 FIRE DETECTED — Drone M3T Carcassonne — Confidence 94%', priority: 'critical', type: 'alert' },
];

export const QUICK_STATUS = [
  { id: 'ok', label: 'All Good', color: '#22c55e', icon: '👍' },
  { id: 'moving', label: 'On The Move', color: '#3b82f6', icon: '🏃' },
  { id: 'need-water', label: 'Need Water', color: '#f59e0b', icon: '💧' },
  { id: 'need-help', label: 'Need Help', color: '#ef4444', icon: '🆘' },
  { id: 'evacuating', label: 'Evacuating', color: '#a855f7', icon: '🚨' },
  { id: 'emergency', label: 'EMERGENCY', color: '#dc2626', icon: '⛑️' },
];

export const NAVIGATION_POINTS = [
  { id: 'cp', name: 'Command Post Alpha', type: 'command', lat: 43.2108, lng: 2.3514, distance: '3.2 km', eta: '8 min', bearing: 215 },
  { id: 'water', name: 'Water Source — Lac du Cavayère', type: 'resource', lat: 43.1950, lng: 2.3800, distance: '1.8 km', eta: '4 min', bearing: 165 },
  { id: 'evac1', name: 'Evacuation Point North', type: 'evacuation', lat: 43.4000, lng: 2.4000, distance: '2.5 km', eta: '6 min', bearing: 340 },
  { id: 'staging', name: 'Staging Area B', type: 'staging', lat: 43.3300, lng: 2.4100, distance: '0.9 km', eta: '2 min', bearing: 190 },
  { id: 'hazard', name: '⚠ Active Fire Front', type: 'hazard', lat: 43.3772, lng: 2.4483, distance: '0.4 km', eta: '—', bearing: 45 },
];

// ============================================================================
// DESIGN SYSTEM — Emergency Grade
// ============================================================================
export const C = {
  bg: '#0a0e17',
  surface: '#111827',
  surfaceRaised: '#1a2234',
  border: '#1e293b',
  borderLight: '#334155',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  accent: '#f97316',    // Watchtower orange
  accentGlow: '#fb923c',
  critical: '#ef4444',
  criticalGlow: '#f87171',
  warning: '#f59e0b',
  success: '#22c55e',
  info: '#3b82f6',
  purple: '#a855f7',
};

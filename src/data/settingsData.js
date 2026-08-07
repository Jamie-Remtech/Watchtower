import {
  Eye, Flame, Bell, FileText, Wifi, Shield, Database, Target, Radio, Cpu, Lock, Crosshair, Satellite, Plane
} from 'lucide-react';


// ============================================
// WATCHTOWER PRODUCT STRUCTURE
// Two Products: Edge AI Box + AI Software
// ============================================

// Product 1: Watchtower AI Box (Hardware + Operations Platform)
export const edgeBoxCapabilities = [
  { id: 1, name: 'Multiple drones operations platform', category: 'Operations' },
  { id: 2, name: 'Control centers to operate drones and monitor performance', category: 'Operations' },
  { id: 3, name: 'Alerting to multiple locations simultaneously', category: 'Operations' },
  { id: 4, name: 'Fire, smoke, human, vehicle, aircraft and other threat detection', category: 'Detection' },
  { id: 5, name: 'Thermal imaging and hot spot detection', category: 'Detection' },
  { id: 6, name: 'Multi-spectral sensing and threat analysis', category: 'Detection' },
  { id: 7, name: 'Exact location details of detected threats with imagery', category: 'Detection' },
  { id: 8, name: 'Storage of all threat data with structured reporting', category: 'Data' },
  { id: 9, name: 'Waypoint creation and flight path planning', category: 'Flight Control' },
  { id: 10, name: 'Import flight path and coordinates option', category: 'Flight Control' },
  { id: 11, name: 'Persistent area surveillance and scheduled flight paths', category: 'Flight Control' },
  { id: 12, name: 'Target tracking with handoff between drones and ground stations', category: 'Tracking' },
  { id: 13, name: 'Existing camera and drone integration', category: 'Integration' },
  { id: 14, name: 'Dynamic geofencing and no-fly zone enforcement', category: 'Safety' },
  { id: 15, name: 'Secure telemetry and encrypted communications', category: 'Security' },
  { id: 16, name: 'Collaborative multi-agent tasking and role allocation', category: 'Operations' },
  { id: 17, name: 'Return-to-home / go-to location option', category: 'Safety' },
  { id: 18, name: 'Satellite coverage and signal strength information', category: 'Connectivity' },
  { id: 19, name: 'Autonomous sensor payload swap and drop management', category: 'Hardware' },
  { id: 20, name: 'Predictive maintenance and health monitoring', category: 'Maintenance' },
  { id: 21, name: 'Automated decision making for battery anomalies and faults', category: 'Maintenance' },
  { id: 22, name: 'Gust handling', category: 'Flight Control' },
  { id: 23, name: 'Federated learning and on-site model adaptation', category: 'AI' },
  { id: 24, name: 'Behavior-based anomaly detection', category: 'AI' },
  { id: 25, name: 'Automated decision making to reduce false positives', category: 'AI' },
  { id: 26, name: 'Priority-based tasking and dynamic re-tasking', category: 'Operations' },
  { id: 27, name: 'Autonomous landing on moving platforms', category: 'Flight Control' },
  { id: 28, name: 'Swarm-level emergent tactics and formations', category: 'Operations' },
  { id: 29, name: 'Geo-tagged evidence packages and automated reporting', category: 'Data' },
  { id: 30, name: 'Low probability of detection and stealth routing modes', category: 'Operations' },
];

// Product 2: Watchtower AI Software (Cloud/Detection Platform)
export const aiSoftwareCapabilities = [
  { id: 1, name: 'Real-time detection & classification (fire, smoke, human, vehicle, aircraft)', category: 'Detection' },
  { id: 2, name: 'Exact geo-location of threats (when metadata/telemetry provided)', category: 'Detection' },
  { id: 3, name: 'Multi-channel alerting (SMS, email, dashboard, API/webhook)', category: 'Alerting' },
  { id: 4, name: 'Automated geo-tagged evidence packages (images + metadata)', category: 'Evidence' },
  { id: 5, name: 'Multi-sensor fusion (visible, thermal, multispectral, telemetry)', category: 'AI' },
  { id: 6, name: 'Continuous target tracking & drone/camera handoff', category: 'Tracking' },
  { id: 7, name: 'Waypoint & mission suggestions from detections', category: 'AI' },
  { id: 8, name: 'False-positive reduction via behavior & context filters', category: 'AI' },
  { id: 9, name: 'Predictive maintenance alerts (battery, sensors)', category: 'Maintenance' },
  { id: 10, name: 'Federated learning & on-site model adaptation', category: 'AI' },
  { id: 11, name: 'Web dashboard for live monitoring & operator review', category: 'Dashboard' },
  { id: 12, name: 'Structured reporting & event storage with retention options', category: 'Data' },
  { id: 13, name: 'Secure, encrypted communications & role-based access', category: 'Security' },
];

// Edge AI Box Categories for grouping
export const edgeBoxCategories = [
  { id: 'operations', name: 'Operations & Control', icon: 'Radio' },
  { id: 'detection', name: 'Detection & Sensing', icon: 'Eye' },
  { id: 'flight', name: 'Flight Control', icon: 'Plane' },
  { id: 'tracking', name: 'Target Tracking', icon: 'Crosshair' },
  { id: 'safety', name: 'Safety & Geofencing', icon: 'Shield' },
  { id: 'data', name: 'Data & Reporting', icon: 'Database' },
  { id: 'maintenance', name: 'Maintenance', icon: 'Wrench' },
  { id: 'ai', name: 'AI & Learning', icon: 'Brain' },
  { id: 'connectivity', name: 'Connectivity', icon: 'Wifi' },
  { id: 'security', name: 'Security', icon: 'Lock' },
  { id: 'integration', name: 'Integration', icon: 'Link' },
  { id: 'hardware', name: 'Hardware', icon: 'Cpu' },
];

// AI Software Categories
export const aiSoftwareCategories = [
  { id: 'detection', name: 'Detection & Classification', icon: 'Flame' },
  { id: 'alerting', name: 'Alerting', icon: 'Bell' },
  { id: 'evidence', name: 'Evidence Management', icon: 'FileText' },
  { id: 'ai', name: 'AI & Analytics', icon: 'Brain' },
  { id: 'tracking', name: 'Tracking', icon: 'Crosshair' },
  { id: 'dashboard', name: 'Dashboard', icon: 'Monitor' },
  { id: 'data', name: 'Data & Reporting', icon: 'Database' },
  { id: 'maintenance', name: 'Maintenance', icon: 'Wrench' },
  { id: 'security', name: 'Security', icon: 'Lock' },
];

// Custom AI Modules (Extra Tasks - available for both products)
export const customAIModules = [
  { id: 49, name: 'Power line surveillance', industry: 'Utilities' },
  { id: 50, name: 'Power line de-icing', industry: 'Utilities' },
  { id: 51, name: 'Cattle surveillance', industry: 'Agriculture' },
  { id: 52, name: 'Ship inspection', industry: 'Maritime' },
  { id: 53, name: 'Border intrusion surveillance', industry: 'Security' },
  { id: 54, name: 'Pipeline surveillance', industry: 'Energy' },
  { id: 55, name: 'Fauna recognition', industry: 'Conservation' },
];

// Capability data based on Watchtower product structure (keeping for backward compat)
export const capabilities = {
  basic: [
    // Operating System - Core
    { id: 1, name: 'Multiple drones operations platform', classification: 'Operating System', enabled: true },
    { id: 4, name: 'Fire detection', classification: 'Operating System', enabled: true },
    { id: 5, name: 'Smoke detection', classification: 'Operating System', enabled: true },
    { id: 6, name: 'Human detection', classification: 'Operating System', enabled: true },
    { id: 7, name: 'Vehicle detection', classification: 'Operating System', enabled: true },
    { id: 8, name: 'Aircraft detection', classification: 'Operating System', enabled: true },
    { id: 10, name: 'Thermal imaging and hot spot detection', classification: 'Operating System', enabled: true },
    { id: 12, name: 'Exact location details with imagery', classification: 'Operating System', enabled: true },
    { id: 13, name: 'Storage of threat data with reporting', classification: 'Operating System', enabled: true },
    { id: 14, name: 'Waypoint creation and flight path planning', classification: 'Operating System', enabled: true },
    { id: 15, name: 'Import flight path and coordinates', classification: 'Operating System', enabled: true },
    { id: 16, name: 'Persistent area surveillance', classification: 'Operating System', enabled: true },
    { id: 17, name: 'Target tracking with handoff', classification: 'Operating System', enabled: true },
    { id: 18, name: 'Existing camera and drone integration', classification: 'Operating System', enabled: true },
    { id: 20, name: 'Secure telemetry and encrypted communications', classification: 'Operating System', enabled: true },
    { id: 22, name: 'Return-to-home / go-to location', classification: 'Operating System', enabled: true },
    { id: 25, name: 'Predictive maintenance and health monitoring', classification: 'Operating System', enabled: true },
    { id: 26, name: 'Automated decision making for battery anomalies', classification: 'Operating System', enabled: true },
    { id: 27, name: 'Gust handling and environmental compensation', classification: 'Operating System', enabled: true },
    { id: 28, name: 'Federated learning and on-site model adaptation', classification: 'Operating System', enabled: true },
    { id: 30, name: 'Automated decision making to reduce false positives', classification: 'Operating System', enabled: true },
    { id: 34, name: 'Geo-tagged evidence packages', classification: 'Operating System', enabled: true },
    { id: 36, name: 'Real-time detection and classification', classification: 'Operating System', enabled: true },
    { id: 40, name: 'Multi-sensor fusion', classification: 'Operating System', enabled: true },
    // Dashboard
    { id: 2, name: 'Control centers to operate drones', classification: 'Dashboard', enabled: true },
    { id: 3, name: 'Alerting to multiple locations simultaneously', classification: 'Dashboard', enabled: true },
    { id: 19, name: 'Dynamic geofencing and no-fly zones', classification: 'Dashboard', enabled: true },
    { id: 21, name: 'Collaborative multi-agent tasking', classification: 'Dashboard', enabled: true },
    { id: 31, name: 'Priority-based tasking and dynamic re-tasking', classification: 'Dashboard', enabled: true },
    { id: 38, name: 'Multi-channel alerting (SMS, email, API)', classification: 'Dashboard', enabled: true },
    { id: 42, name: 'Waypoint and mission suggestions from detections', classification: 'Dashboard', enabled: true },
    { id: 46, name: 'Web dashboard for live monitoring', classification: 'Dashboard', enabled: true },
    { id: 47, name: 'Structured reporting with retention options', classification: 'Dashboard', enabled: true },
  ],
  optional: [
    { id: 9, name: 'Other threat detection (violent / non-fire)', classification: 'Operating System', enabled: false, price: '€150/mo' },
    { id: 11, name: 'Multi-spectral sensing and threat analysis', classification: 'Operating System', enabled: false, price: '€200/mo' },
    { id: 23, name: 'Satellite coverage and signal strength info', classification: 'Operating System', enabled: true, price: '€75/mo' },
    { id: 24, name: 'Autonomous sensor payload swap', classification: 'Operating System', enabled: false, price: '€250/mo' },
    { id: 29, name: 'Behavior-based anomaly detection', classification: 'Operating System', enabled: false, price: '€175/mo' },
    { id: 32, name: 'Autonomous landing on moving platforms', classification: 'Operating System', enabled: false, price: '€300/mo' },
    { id: 33, name: 'Swarm-level emergent tactics and formations', classification: 'Operating System', enabled: false, price: '€500/mo' },
    { id: 35, name: 'Low probability of detection / stealth modes', classification: 'Operating System', enabled: false, price: '€350/mo' },
  ],
  extraTasks: [
    { id: 49, name: 'Power line surveillance', classification: 'Custom AI', enabled: false, price: 'Quote' },
    { id: 50, name: 'Power line de-icing', classification: 'Custom AI', enabled: false, price: 'Quote' },
    { id: 51, name: 'Cattle surveillance', classification: 'Custom AI', enabled: false, price: 'Quote' },
    { id: 52, name: 'Ship inspection', classification: 'Custom AI', enabled: false, price: 'Quote' },
    { id: 53, name: 'Border intrusion surveillance', classification: 'Custom AI', enabled: false, price: 'Quote' },
    { id: 54, name: 'Pipeline surveillance', classification: 'Custom AI', enabled: false, price: 'Quote' },
    { id: 55, name: 'Fauna recognition', classification: 'Custom AI', enabled: false, price: 'Quote' },
  ],
};

import {
  Grid
} from 'lucide-react';


// Mock detections for each stream
// Enhanced with confidence, subtypes, detection IDs, and spread vectors
// Personnel Registry — cross-referenced by AI person detection via locator beacon
export const personnelRegistry = {
  'LOC-4401': { name: 'Cpl. Pierre Dubois', callsign: 'GROUND-4', role: 'Ground Team Lead', unit: 'Suppression', status: 'active', heartRate: 112, o2Level: 95, battery: 54 },
  'LOC-4406': { name: 'Sgt. Ahmed Okafor', callsign: 'GROUND-6', role: 'Evac Coordinator', unit: 'Logistics', status: 'moving', heartRate: 98, o2Level: 96, battery: 41 },
  'LOC-4408': { name: 'Pvt. João Silva', callsign: 'GROUND-8', role: 'Firefighter', unit: 'Suppression', status: 'active', heartRate: 102, o2Level: 96, battery: 67 },
  'LOC-4402': { name: 'Lt. Marco Rossi', callsign: 'HAWK-2', role: 'Ops Section Chief', unit: 'Operations', status: 'active', heartRate: 88, o2Level: 97, battery: 78 },
  'LOC-4405': { name: 'Dr. Elena Vasquez', callsign: 'MEDIC-5', role: 'Medical Officer', unit: 'Medical', status: 'active', heartRate: 64, o2Level: 99, battery: 88 },
  'LOC-4407': { name: 'Lt. Anna Kowalski', callsign: 'WATCH-7', role: 'Safety Officer', unit: 'Safety', status: 'alert', heartRate: 105, o2Level: 93, battery: 23 },
  'LOC-4401C': { name: 'Cmdr. Sarah Chen', callsign: 'EAGLE-1', role: 'Incident Commander', unit: 'Command', status: 'active', heartRate: 72, o2Level: 98, battery: 92 },
  'LOC-4403': { name: 'Sgt. Yuki Tanaka', callsign: 'PHOENIX-3', role: 'Drone Pilot', unit: 'Air Ops', status: 'active', heartRate: 68, o2Level: 99, battery: 65 },
};

// Asset Registry — vehicles, aircraft, drones cross-referenced via ADS-B / transponder / beacon
export const assetRegistry = {
  // Ground vehicles
  'VEH-SDIS-207': { category: 'vehicle', name: 'CCF 207', callsign: 'PUMP-7', type: 'Camion Citerne Feux', unit: 'SDIS 11 - CIS Carcassonne', operator: 'Sgt. Leroy', status: 'deployed', fuel: 72, waterLevel: 85, capacity: '6000L', speed: 0 },
  'VEH-SDIS-114': { category: 'vehicle', name: 'VLHR 114', callsign: 'RECON-3', type: 'Light Recon Vehicle', unit: 'SDIS 11 - CIS Limoux', operator: 'Cpl. Moreau', status: 'moving', fuel: 58, waterLevel: null, capacity: null, speed: 35 },
  'VEH-SDIS-042': { category: 'vehicle', name: 'FPT 042', callsign: 'PUMP-2', type: 'Fourgon Pompe Tonne', unit: 'SDIS 11 - CIS Narbonne', operator: 'Lt. Garnier', status: 'en route', fuel: 91, waterLevel: 100, capacity: '3500L', speed: 62 },
  'VEH-ATV-09': { category: 'vehicle', name: 'ATV Polaris-09', callsign: 'TRAIL-9', type: 'All-Terrain Utility', unit: 'SDIS 11 - Mountain', operator: 'Cpl. Dubois', status: 'deployed', fuel: 44, waterLevel: null, capacity: null, speed: 12 },
  // Aircraft
  'AIR-PELI-24': { category: 'aircraft', name: 'Pélican 24', callsign: 'PÉLICAN-24', type: 'Canadair CL-415', unit: 'Sécurité Civile', operator: 'Cne. Bertrand', status: 'water drop', fuel: 64, waterLoad: 6137, maxWater: 6140, altitude: 250, speed: 240, heading: 'SE' },
  'AIR-PELI-31': { category: 'aircraft', name: 'Pélican 31', callsign: 'PÉLICAN-31', type: 'Canadair CL-415', unit: 'Sécurité Civile', operator: 'Cne. Vidal', status: 'scooping', fuel: 52, waterLoad: 0, maxWater: 6140, altitude: 45, speed: 155, heading: 'NW' },
  'AIR-DRAG-06': { category: 'aircraft', name: 'Dragon 06', callsign: 'DRAGON-06', type: 'EC145 Heli', unit: 'Sécurité Civile', operator: 'Adj. Petit', status: 'hovering', fuel: 71, waterLoad: null, maxWater: null, altitude: 120, speed: 0, heading: 'N' },
  // Drones (external / allied — not our fleet)
  'DRN-GEND-01': { category: 'drone', name: 'Gendarmerie UAV-01', callsign: 'GEND-SKY-1', type: 'DJI M300 RTK', unit: 'Gendarmerie Aude', operator: 'Adj. Lambert', status: 'surveying', battery: 62, altitude: 85, speed: 18, signal: 94 },
  'DRN-RTE-03': { category: 'drone', name: 'RTE Grid Drone-03', callsign: 'RTE-EYE-3', type: 'DJI M30T', unit: 'RTE Réseau', operator: 'Tech. Faure', status: 'inspecting', battery: 41, altitude: 55, speed: 8, signal: 87 },
};

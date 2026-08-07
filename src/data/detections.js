import {
  Truck
} from 'lucide-react';


export const streamDetections = {
  1: [
    { id: 'F-001', type: 'fire', subtype: 'Active Ground Fire', confidence: 94, x: 12, y: 38, width: 9, height: 10, spread: { direction: 135, speed: 2.3 } },
    { id: 'F-002', type: 'fire', subtype: 'Ground Fire', confidence: 91, x: 55, y: 52, width: 7, height: 8, spread: { direction: 120, speed: 1.8 } },
    { id: 'F-003', type: 'fire', subtype: 'Spot Fire', confidence: 88, x: 75, y: 22, width: 5, height: 6, spread: { direction: 90, speed: 1.2 } },
    { id: 'F-004', type: 'fire', subtype: 'Spot Fire', confidence: 82, x: 38, y: 15, width: 5, height: 5, spread: { direction: 60, speed: 3.1 } },
    { id: 'S-001', type: 'smoke', subtype: 'Dense Smoke Column', confidence: 96, x: 30, y: 5, width: 22, height: 8 },
    { id: 'S-002', type: 'smoke', subtype: 'Smoke Drift', confidence: 82, x: 62, y: 8, width: 20, height: 6 },
    { id: 'P-001', type: 'human', subtype: 'Firefighter', confidence: 79, x: 5, y: 68, width: 4, height: 7, locatorId: 'LOC-4408' },
    { id: 'A-001', type: 'vehicle', subtype: 'Fixed-Wing Aircraft', confidence: 97, x: 82, y: 10, width: 10, height: 5, locatorId: 'AIR-PELI-24' },
  ],
  2: [
    { id: 'S-003', type: 'smoke', subtype: 'Dense Smoke Column', confidence: 93, x: 10, y: 6, width: 28, height: 7 },
    { id: 'F-005', type: 'fire', subtype: 'Active Ground Fire', confidence: 89, x: 20, y: 35, width: 8, height: 9, spread: { direction: 180, speed: 1.5 } },
    { id: 'F-006', type: 'fire', subtype: 'Spot Fire', confidence: 76, x: 68, y: 45, width: 5, height: 6, spread: { direction: 200, speed: 0.8 } },
    { id: 'V-001', type: 'vehicle', subtype: 'Fire Truck', confidence: 95, x: 78, y: 72, width: 8, height: 5, locatorId: 'VEH-SDIS-207' },
    { id: 'D-001', type: 'vehicle', subtype: 'UAV', confidence: 91, x: 45, y: 14, width: 4, height: 3, locatorId: 'DRN-GEND-01' },
  ],
  4: [
    { id: 'P-002', type: 'human', subtype: 'Person', confidence: 72, x: 30, y: 55, width: 4, height: 7, locatorId: 'LOC-4401' },
    { id: 'V-002', type: 'vehicle', subtype: 'ATV', confidence: 85, x: 70, y: 70, width: 8, height: 5, locatorId: 'VEH-ATV-09' },
    { id: 'P-003', type: 'human', subtype: 'Person', confidence: 68, x: 55, y: 30, width: 4, height: 6 },
    { id: 'V-003', type: 'vehicle', subtype: 'Vehicle', confidence: 62, x: 15, y: 75, width: 7, height: 4 },
  ],
};

// Fire perimeter data per stream (for streams with active fire)
export const firePerimeters = {
  1: {
    id: 'FP-001',
    status: 'Active',
    hectares: 4.2,
    // Polygon points as percentage of video frame — spread wide
    points: [
      { x: 8, y: 28 }, { x: 25, y: 12 }, { x: 50, y: 10 },
      { x: 78, y: 15 }, { x: 82, y: 35 }, { x: 70, y: 55 },
      { x: 45, y: 60 }, { x: 18, y: 52 }, { x: 6, y: 40 },
    ],
    spreadRate: 2.1, // km/h average
    containment: 15, // percent
  },
  2: {
    id: 'FP-002',
    status: 'Active',
    hectares: 1.8,
    points: [
      { x: 14, y: 28 }, { x: 35, y: 22 }, { x: 55, y: 30 },
      { x: 72, y: 38 }, { x: 75, y: 52 }, { x: 58, y: 58 },
      { x: 30, y: 55 }, { x: 12, y: 42 },
    ],
    spreadRate: 1.1,
    containment: 0,
  },
};

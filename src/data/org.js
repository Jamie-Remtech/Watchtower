import {
  Camera
} from 'lucide-react';


// Organization Data
export const orgData = {
  name: 'SDIS 11',
  region: 'Carcassonne, France',
  tier: 'Professional',
  contractStart: '2024-03-15',
  contractEnd: '2027-03-14',
  accountManager: 'Pierre Martin',
  accountManagerEmail: 'pierre.martin@watchtower.ai',
  maxStreams: 8,
  maxUsers: 15,
};

// ============================================
// AI CHANNEL MANAGEMENT SYSTEM
// ============================================
// Channels prevent AI drift by ensuring proper resource allocation
// Each device type requires specific channel allocation:
//
// DEVICE TYPE          | CHANNELS | REASON
// ---------------------|----------|--------------------------------
// Drone                | 8        | Flight AI + Detection AI + Control
// PTZ Camera           | 2        | Pan/Tilt/Zoom AI + Detection
// Fixed Camera         | 1        | Detection only
// Sensor               | 1        | Data processing only
//
// Customers can add/change/modify devices but must have available channels
// Additional channels must be purchased from Watchtower
// Watchtower Admin controls all channel allocation
// Watchtower Admin can block customers for: non-payment, tampering, violations

export const CHANNEL_COSTS = {
  drone: 8,
  ptz_camera: 2,
  camera: 1,
  sensor: 1
};

// Customer Channel Allocation (controlled by Watchtower Admin)
export const customerChannelData = {
  customerId: 'SDIS-11-AUDE',
  customerName: 'SDIS 11 Aude',
  // Channel allocation
  // 3 drones (3×8=24) + 1 PTZ cam (1×2=2) + 1 fixed cam (1×1=1) + 5 sensors (5×1=5) = 32 channels
  channelsAllocated: 35,    // Total purchased from Watchtower
  channelsUsed: 32,         // Currently assigned to devices
  channelsAvailable: 3,     // Available for new devices
  channelRate: 95,          // € per channel per month
  // Account status (managed by Watchtower Admin only)
  accountStatus: 'active',  // 'active', 'suspended', 'blocked'
  blockReason: null,        // 'non_payment', 'tampering', 'violation', null
  blockedBy: null,          // Watchtower Admin who blocked (if blocked)
  blockedAt: null,          // Timestamp of block
  // Billing
  lastPayment: '2024-01-15',
  nextBilling: '2024-02-15',
  monthlyTotal: 3325,       // 35 channels × €95
};

// Helper to get channel cost for a device
export const getChannelCost = (deviceType, isControllable = false) => {
  if (deviceType === 'drone') return CHANNEL_COSTS.drone;
  if (deviceType === 'camera' && isControllable) return CHANNEL_COSTS.ptz_camera;
  if (deviceType === 'camera') return CHANNEL_COSTS.camera;
  if (deviceType === 'sensor') return CHANNEL_COSTS.sensor;
  return 1;
};

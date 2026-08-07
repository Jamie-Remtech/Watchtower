
// Billing Data
export const billingData = {
  channelsAllocated: 8,
  channelsUsed: 5,
  channelRate: 395,
  dronesAllocated: 1,
  droneRate: 770,
  monthlyTotal: 2745,
  ytdSpend: 24705,
};

// KPI Data
export const kpiData = {
  operational: {
    systemUptime: { value: 99.8, target: 99.5, trend: 0.2, trendUp: true },
    avgResponseTime: { value: 2.4, target: 5, trend: -0.7, trendUp: true },
    falsePositiveRate: { value: 2.1, target: 3, trend: -0.5, trendUp: true },
    detectionAccuracy: { value: 97.8, target: 95, trend: 1.2, trendUp: true },
    streamAvailability: { value: 80, target: 90, trend: -5, trendUp: false },
    avgProcessingLatency: { value: 1.2, target: 2, trend: -0.3, trendUp: true },
  },
  detections: {
    totalThisMonth: { value: 347, lastMonth: 289, trend: 20 },
    fire: { value: 7, lastMonth: 5, trend: 40 },
    smoke: { value: 89, lastMonth: 67, trend: 33 },
    hotspot: { value: 156, lastMonth: 178, trend: -12 },
    human: { value: 67, lastMonth: 28, trend: 139 },
    vehicle: { value: 28, lastMonth: 11, trend: 155 },
  },
  coverage: {
    totalArea: { value: 850 },
    activeMonitoring: { value: 680 },
    coveragePercent: { value: 80, target: 95 },
    blindSpots: { value: 2, target: 0 },
  },
};

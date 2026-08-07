// Watchtower role ladder. Order matters: higher index = more power.
export const ROLES = ['viewer', 'field', 'operator', 'coordinator', 'admin'];

export const ROLE_LABELS = {
  viewer: 'Viewer',
  field: 'Field Collaborator',
  operator: 'Operator',
  coordinator: 'Coordinator',
  admin: 'Administrator',
};

export const ROLE_DESCRIPTIONS = {
  viewer: 'Read-only situational awareness',
  field: 'Collaborator app: position, reports, comms',
  operator: 'Drives feeds and devices, manages detections',
  coordinator: 'Runs operations, tasks protocols, handles attention queue',
  admin: 'Organization management, devices, billing',
};

export const hasAtLeast = (role, required) =>
  ROLES.indexOf(role) >= ROLES.indexOf(required);

// Watchtower role ladder. Order matters: higher index = more power.
export const ROLES = ['viewer', 'field', 'operator', 'coordinator', 'admin'];

export const ROLE_LABELS = {
  viewer: 'Viewer',
  field: 'Field Collaborator',
  operator: 'Operator',
  coordinator: 'Coordinator',
  admin: 'Company Admin',
};

export const ROLE_DESCRIPTIONS = {
  viewer: 'World tab only — live weather, hazards & the globe (friends & family)',
  field: 'Collaborator app: position, reports, comms',
  operator: 'Drives feeds and devices, manages detections',
  coordinator: 'Runs operations, tasks protocols, handles attention queue',
  admin: 'Runs their company: members, devices, billing (org-scoped)',
};

export const hasAtLeast = (role, required) =>
  ROLES.indexOf(role) >= ROLES.indexOf(required);

// Which tabs each role can open. Viewers get the World tab only (for
// now) — friends and family can watch the world without touching
// operations. Unknown/loading roles default to the safest set.
const ALL_TABS = ['streams', 'tactical', 'world', 'log', 'protocols', 'comms', 'activity', 'team', 'billing', 'settings'];
export const TAB_ACCESS = {
  admin: ALL_TABS,
  coordinator: ALL_TABS,
  operator: ['streams', 'tactical', 'world', 'log', 'protocols', 'comms', 'team', 'settings'],
  field: ['world', 'tactical', 'log', 'protocols', 'comms'],
  viewer: ['world'],
};
export const allowedTabs = (role) => TAB_ACCESS[role] ?? ['world'];

// Which roles an inviter may hand out: only admins can mint admins
// or coordinators; coordinators invite the operational ranks below.
export const invitableRoles = (inviterRole) =>
  inviterRole === 'admin' ? ROLES : ROLES.filter(r => r !== 'admin' && r !== 'coordinator');

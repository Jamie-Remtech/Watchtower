// Team tab: roster, teams, invitations, member card.
export default {
  // roster role badges (short labels, ids from the role ladder + demo 'pilot')
  'team.role.admin': 'Admin',
  'team.role.coordinator': 'Coordinator',
  'team.role.operator': 'Operator',
  'team.role.pilot': 'Pilot',
  'team.role.field': 'Field',
  'team.role.viewer': 'Viewer',

  // presence statuses
  'team.status.online': 'Online',
  'team.status.offline': 'Offline',
  'team.status.busy': 'Busy',
  'team.status.away': 'Away',

  // header + stats
  'team.title': 'Team Management',
  'team.summary': '{n} team members • {o} online',
  'team.inviteUser': 'Invite User',
  'team.stat.onlineNow': 'Online Now',
  'team.stat.operators': 'Operators',
  'team.stat.locatable': 'Locatable',
  'team.stat.totalAlerts': 'Total Alerts',

  // teams
  'team.teams.title': 'Teams',
  'team.teams.hint': 'assign members below · everyone can be watched at once',
  'team.teams.newPh': 'New team name…',
  'team.teams.add': 'Add',
  'team.teams.sure': 'sure?',

  // pending invitations
  'team.inv.pending': 'Pending Invitations',
  'team.inv.copyCode': 'Copy code',
  'team.inv.restricted': ' · restricted to {email}',
  'team.inv.expires': ' · expires {date}',
  'team.inv.revoke': 'Revoke',

  // roster rows
  'team.live': 'Live',
  'team.noDevices': 'No devices',
  'team.standDownTitle': 'Stand down to Viewer (world map only) — account stays, access can be restored',
  'team.confirmStandDown': 'Confirm stand-down?',
  'team.standDown': 'Stand down',
  'team.setRole': 'Set role (admin)',
  'team.assignTeam': 'Assign to a team',
  'team.noTeam': 'No team',
  'team.alerts': '{n} alerts',
  'team.locationActive': 'Location active • {time}',
  'team.alertsHandled': '{n} alerts handled',
  'team.map.title': 'Team Locations',

  // member card
  'team.f.name': 'Full name',
  'team.f.name.h': 'How you appear across Watchtower',
  'team.f.callsign': 'Callsign',
  'team.f.callsign.h': 'Radio identity, e.g. WT-1',
  'team.f.frequency': 'Radio frequency',
  'team.f.frequency.h': 'e.g. 146.520 MHz',
  'team.f.phone': 'Phone',
  'team.f.mobile': 'Mobile',
  'team.f.emergencyPhone': 'Emergency phone',
  'team.f.emergencyPhone.h': 'Reach in a life-safety situation',
  'team.f.emergencyContact': 'Emergency contact',
  'team.f.emergencyContact.h': 'Name & relation, e.g. Chris — spouse',
  'team.m.saveFail': 'Could not save',
  'team.m.joined': '{email} · joined {date}',
  'team.m.readOnly': 'Contact card — the member (or an admin) keeps it up to date.',
  'team.m.saved': 'Saved — the whole team sees it',

  // invite QR
  'team.qr.alt': 'Scan to join Watchtower',
  'team.qr.note': 'Scan with the phone camera → sign-up opens with the code filled in',

  // invite modal
  'team.inv.createFail': 'Could not create invitation',
  'team.inv.title': 'Invite a collaborator',
  'team.inv.needLive': 'Invitations need live mode. Configure Supabase in {file} to invite real collaborators.',
  'team.inv.created': 'Invitation created. {scan} — or send the code:',
  'team.inv.letScan': 'Let them scan this',
  'team.inv.orJoin': 'Or they sign up with {join} using:',
  'team.inv.copy': 'Copy',
  'team.inv.sendEmail': 'Send by email',
  'team.inv.copyMessage': 'Copy message',
  'team.inv.role': 'Role: {role}',
  'team.inv.done': 'Done',
  'team.inv.roleLabel': 'Role',
  'team.inv.restrictLabel': 'Restrict to email (optional)',
  'team.inv.restrictPh': 'anyone with the code can join if empty',
  'team.inv.create': 'Create invitation',

  // role descriptions (ids from src/auth/roles.js)
  'team.roleDesc.viewer': 'World tab only — live weather, hazards & the globe (friends & family)',
  'team.roleDesc.field': 'Collaborator app: position, reports, comms',
  'team.roleDesc.operator': 'Drives feeds and devices, manages detections',
  'team.roleDesc.coordinator': 'Runs operations, tasks protocols, handles attention queue',
  'team.roleDesc.admin': 'Runs their company: members, devices, billing (org-scoped)',

  // invitation message (email / clipboard)
  'team.msg.subject': 'Your Watchtower invitation',
  'team.msg.intro': "You're invited to Watchtower!",
  'team.msg.step1': '1. Open {url}',
  'team.msg.step2': '2. Tap "{join}"',
  'team.msg.step3': '3. Enter invitation code: {code}',
  'team.msg.step4': '4. Create your account',
  'team.msg.step4Email': '4. Create your account using this email ({email})',
  'team.msg.outro': "You'll see the world live: weather, storms, wildfires and earthquakes on one globe.",
};

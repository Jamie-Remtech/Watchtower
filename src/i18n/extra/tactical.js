// Tactical map (tab + map component) and shared marker kinds.
export default {
  // marker kinds (ids from src/hooks/useMarkers.js MARKER_KINDS)
  'marker.fire': 'Fire',
  'marker.medical': 'Medical point',
  'marker.injured': 'Injured person',
  'marker.hazard': 'Hazard',
  'marker.blocked': 'Road blocked',
  'marker.water': 'Water source',
  'marker.staging': 'Staging area',
  'marker.rally': 'Rally point',
  'marker.helispot': 'Helicopter landing zone',
  'marker.command_post': 'Command post',
  'marker.shelter': 'Shelter',
  'marker.vehicle': 'Vehicle',
  'marker.poi': 'Point of interest',

  // tab header
  'tac.title': 'Tactical Map',
  'tac.device1': '{n} device',
  'tac.deviceN': '{n} devices',
  'tac.liveCrew': '{n} live crew',
  'tac.lastKnown': '{n} last known',
  'tac.lastSeen': 'last seen {ago}',
  'tac.agoMin': '{n} min ago',
  'tac.agoH': '{n} h ago',
  'tac.agoD': '{n} days ago',
  'tac.linkedCompany': 'linked company',
  'tac.marker': 'Marker',
  'tac.myArea': 'My area',
  'tac.popOut': 'Pop out',
  'tac.popOutTitle': 'Open the tactical map in its own window (stays live-synced)',
  'tac.mode.satellite': 'satellite',
  'tac.mode.roadmap': 'roadmap',
  'tac.mode.terrain': 'terrain',
  'tac.mode.hybrid': 'hybrid',
  'tac.radar': 'Radar',
  'tac.radarTitle': 'Live precipitation radar (RainViewer, updates every 5 min)',
  'tac.signal': 'Signal',
  'tac.signalTitle': 'Communications coverage — where devices had good, weak or no link',

  // triage board (SALT categories)
  'tac.triage.red': 'Immediate',
  'tac.triage.yellow': 'Delayed',
  'tac.triage.green': 'Minimal',
  'tac.triage.gray': 'Expectant',
  'tac.triage.black': 'Deceased',
  'tac.triage.unknown': 'Untriaged',
  'tac.tag': 'Tag {tag}',

  // map labels built for markers
  'tac.myPosition': 'My position',
  'tac.team': 'Team',

  // saved views
  'tac.viewJumpTitle': 'Click to jump · double-click to rename',
  'tac.refreezeTitle': "Re-freeze this view to what's on screen now",
  'tac.confirmDelete': 'Confirm delete',
  'tac.sure': 'sure?',
  'tac.deleteView': 'Delete view',
  'tac.saveViewTitle': 'Freeze the current view as a named quick reference',
  'tac.saveView': 'Save view',
  'tac.viewsTableMissing': 'The map_views table is missing — run migration 0008 in the Supabase SQL Editor.',
  'tac.viewSaveFailed': 'Could not save the view',

  // marker palette
  'tac.drag': 'Drag',
  'tac.dragHelp': 'a type onto the map to place it exactly — or tap it to drop at the center. Then drag the marker to adjust, tap it for label & notes. Everyone sees changes live.',
  'tac.markersTableMissing': 'The markers table is missing — run migration 0006/0007 in the Supabase SQL Editor.',
  'tac.markerCreateFailed': 'Could not create the marker',

  // coverage legend
  'tac.coverage': 'Coverage',
  'tac.hours': '{h}h',
  'tac.noSamples': 'No samples yet — they arrive with each tracked position.',

  // empty state / footer
  'tac.empty': 'Nothing on the map yet — drop a marker, register devices, or share your position from the Field Log',
  'tac.footer': 'Connected to Supabase · devices, live crew positions, and shared markers',

  // map component: marker popup
  'tac.labelPh': 'Label — e.g. Hydrant behind school',
  'tac.notesPh': 'Notes (optional)',
  'tac.dragToMoveHint': 'Drag the marker on the map to move it',
  'tac.remove': 'Remove',
  'tac.clickToViewFeed': '{name} - Click to view feed',
  'tac.dragToMove': '{name} — drag to move',
  'tac.typeLine': 'Type: {v}',
  'tac.statusLine': 'Status: {v}',
  'tac.viewFeed': 'View Feed',
  'tac.type.drone': 'drone',
  'tac.type.camera': 'camera',
  'tac.type.sensor': 'sensor',
  'tac.type.person': 'person',
  'tac.type.alert': 'alert',
  'tac.status.live': 'live',
  'tac.status.here': 'here',
  'tac.status.active': 'active',
  'tac.status.offline': 'offline',
  'tac.status.maintenance': 'maintenance',
  'tac.status.alert': 'alert',

  // map component: missing API key card
  'tac.apiKey.title': 'Google Maps API Key Required',
  'tac.apiKey.intro': 'To use the tactical map with Google Maps, you need to add your API key to the .env file:',
  'tac.apiKey.step1': '1. Get your API key from',
  'tac.apiKey.step2': '2. Enable Maps JavaScript API',
  'tac.apiKey.step3': '3. Add the key to your .env file',
  'tac.apiKey.step4': '4. Restart the dev server',
};

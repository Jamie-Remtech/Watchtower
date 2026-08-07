# Watchtower

**A tactical coordination hub for emergency response.**

Watchtower links all parties involved in an incident — command staff, field crews, and external agencies — into one shared view of the situation. Feeds from drones, fixed cameras, PTZ cameras, and sensors flow into a live tactical picture; patterns are analyzed and recorded; response protocols can be executed by AI or by a human operator.

Drones and cameras are inputs to Watchtower, not its focus. The focus is the hub.

> Status: pre-release. Currently running on simulated data while the platform base is built out. Goes live when we are ready.

## Running locally

```bash
npm install
npm run dev
```

The tactical map needs a Google Maps API key — see [GOOGLE_MAPS_SETUP.md](GOOGLE_MAPS_SETUP.md). Put it in `.env` as `VITE_GOOGLE_MAPS_API_KEY` (see `.env.example`).

### Demo mode vs live mode

- **Demo mode** (default): no Supabase keys in `.env` → the app opens without login and runs on simulated data from `src/data/`.
- **Live mode**: create a Supabase project, apply [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql), and set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in `.env` → login is required, with email/password, magic-link, and invitation-code onboarding, and a five-level role ladder (viewer → field → operator → coordinator → admin).

The full plan is in [docs/ROADMAP.md](docs/ROADMAP.md).

## Architecture

The app is a Vite + React 18 + Tailwind single-page app. Each major surface is its own segment so features can evolve independently:

```
src/
├── App.jsx                    Thin shell: sidebar nav, alert status, tab routing
├── tabs/                      One module per surface
│   ├── StreamsTab.jsx         Live feeds with AI detection overlays
│   ├── TacticalMapTab.jsx     Shared map: devices, geofences, markers, flight paths
│   ├── WorldTab.jsx           World Engine globe: live weather/hazard layers + Cascade Watch
│   ├── CommsTab.jsx           Radio channels, messaging, personnel tracking
│   ├── TeamTab.jsx            Members, roles, invitations
│   ├── BillingTab.jsx         Plan, usage, invoices
│   └── SettingsTab.jsx        Devices, channels, edge hardware, AI modules
├── components/
│   ├── common.jsx             Shared badges, icons, indicators
│   ├── StreamWindow.jsx       Single feed window
│   ├── LiveDetectionView.jsx  Fullscreen feed with detection HUD
│   ├── TacticalMap.jsx        Google Maps wrapper
│   ├── DeviceFeedViewer.jsx   Feed popup used from the map
│   ├── Collaborator.jsx       Field companion app (mobile surface for crews)
│   └── AIAssistant.jsx        Assistant side panel
├── data/                      All simulated data, isolated behind one boundary
│   ├── org.js  streams.js  registries.js  detections.js
│   ├── team.js  billing.js  settingsData.js  collaboratorData.js
└── styles/alertAnimations.js  Alert pulse animations
```

**The `src/data/` boundary is the seam for going live:** every tab reads from these modules today; replacing them with API/websocket clients later swaps simulated data for real feeds without touching the UI.

## Roadmap themes

- **Hub first** — full situational view shared by every collaborator; the Collaborator field surface becomes a first-class citizen.
- **Patterns** — analyze and record what happens (detections, movements, decisions) so incidents build a queryable history.
- **Protocols** — codified response playbooks that either AI or a human can execute, with clear handover.
- **Link all parties** — command, field crews, aircraft, external agencies in one operational picture.

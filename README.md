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

### Configuration (required)

Watchtower runs on **real data only** — there is no demo or simulation mode. Create a Supabase project, apply the migrations in [supabase/migrations](supabase/migrations) in order, and set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in `.env`. Login offers email/password, magic-link, and invitation-code onboarding, with a five-level role ladder (viewer → field → operator → coordinator → admin).

The full plan is in [docs/ROADMAP.md](docs/ROADMAP.md).

## Architecture

The app is a Vite + React 18 + Tailwind single-page app. Each major surface is its own segment so features can evolve independently:

```
src/
├── App.jsx                    Thin shell: sidebar nav, attention bell, tab routing
├── tabs/                      One module per surface
│   ├── WorldTab.jsx           World Engine globe: live weather/hazard layers, time sliders, Cascade Watch
│   ├── TacticalMapTab.jsx     Shared map: devices, live crew positions, shared markers
│   ├── FieldLogTab.jsx        Speech-to-text action logging + live position sharing
│   ├── StreamsTab.jsx         Device feed cards (video ingest is a roadmap step)
│   ├── CommsTab.jsx           Channels & tracking (activates as the team grows)
│   ├── TeamTab.jsx            Members, roles, invitations
│   ├── BillingTab.jsx         Real usage figures
│   └── SettingsTab.jsx        Device registration & channel management
├── components/                TacticalMap (Google Maps wrapper), DeviceManager,
│   AttentionPanel, InstallPrompt, UpdateBanner, common (Logo, badges), AIAssistant
├── hooks/                     useTeam, useDevices, usePositions, useMarkers,
│   useAttention, useOrg, useSpeech
├── auth/                      AuthContext, AuthGate, LoginScreen, roles
├── lib/                       supabase client, eventLog, attentionEngine
└── styles/alertAnimations.js  Alert pulse animations
```

All operational data lives in Supabase (see `supabase/migrations`): organizations, profiles, invitations, the append-only events log, devices, attention items, positions, and markers — with realtime sync for markers and positions.

## Roadmap themes

- **Hub first** — full situational view shared by every collaborator; the Collaborator field surface becomes a first-class citizen.
- **Patterns** — analyze and record what happens (detections, movements, decisions) so incidents build a queryable history.
- **Protocols** — codified response playbooks that either AI or a human can execute, with clear handover.
- **Link all parties** — command, field crews, aircraft, external agencies in one operational picture.

<!-- deploy: september catch-up -->

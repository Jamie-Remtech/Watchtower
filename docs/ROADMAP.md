# Watchtower Roadmap

Watchtower is a tactical coordination hub: every party involved in an incident shares one view of the situation, patterns are recorded and analyzed, and protocols can be executed by AI or human. It goes live when we are ready.

Six pillars, each evolvable independently. The app must stay runnable after every step — demo mode (simulated data) always works.

---

## 1. Platform — Supabase

The backend for identity, data, and realtime sync.

- [x] Supabase client wiring with graceful **demo mode** when no keys are configured
- [x] Schema v1: organizations, profiles, roles, invitations, events (append-only operational log)
- [x] Schema: devices table (0003) — every feed source is a device row
- [x] Device registration: real Add/status/remove flow in Settings; live devices render on the tactical map and as feed placeholders in Streams; all changes recorded in the events log
- [x] **Live-mode honesty**: simulated data exists only in demo mode; live mode shows real data or clearly-labeled empty states on every tab
- [ ] Realtime subscriptions: positions, alerts, comms messages sync live between clients
- [ ] Replace `src/data/*` mock modules with Supabase queries, one module at a time (the data boundary was built for exactly this swap)
- [ ] Storage buckets for incident media (snapshots, recordings, reports)

## 2. Users, Levels & Onboarding

Different people, different powers, different ways in.

Role ladder (v1):
| Role | Scope |
|---|---|
| `admin` | Org management, devices, billing, all below |
| `coordinator` | Runs operations, tasks protocols, acknowledges alerts |
| `operator` | Drives feeds/devices, manages detections |
| `field` | Collaborator app: position, reports, comms |
| `viewer` | Read-only situational awareness (external agencies, observers) |

Onboarding methods:
- [x] Email + password sign-in
- [x] Magic link (passwordless email)
- [x] Invitation codes: admin invites a person to a role; code binds them to the org on signup
- [ ] OAuth providers (Google/Microsoft) — toggle in Supabase dashboard, UI ready
- [ ] Rapid field onboarding: QR code shown by a coordinator enrolls a `field` collaborator into the active operation

## 3. AI Coordinator (voice-first)

A central assistant that learns situations and helps coordinate — by voice, because collaborators have their hands full.

- [ ] Speech recognition (browser Web Speech API first; upgradeable to Whisper-class models)
- [ ] Spoken responses (speech synthesis) with barge-in (interruptible)
- [ ] Conversational brain: Claude API with tool access to Watchtower state (feeds, positions, weather, protocols) — it answers "what's the situation in sector 7?" from live data
- [ ] Learning loop: every incident's event log (pillar 1) becomes training context — the AI reviews what was done, what worked, and drafts protocol improvements
- [ ] Protocol execution: AI can *propose* protocol steps; human confirms; over time, trusted steps can be delegated to AI (the AI/human handover from the vision)

## 4. World Engine

The model of the physical situation: terrain + weather + fire behavior — and how one disaster seeds another.

- [x] **World globe tab**: interactive 3D globe (MapLibre), zoomable, with toggleable live layers from verifiable sources:
  - NASA GIBS satellite true color (daily), aerosol/dust, ocean chlorophyll, land surface temperature
  - RainViewer global precipitation radar (~10 min refresh)
  - USGS real-time earthquakes (M2.5+, 24h) with official tsunami flags
  - NASA EONET natural events (wildfires, volcanoes, severe storms) with per-event source links
  - Click anywhere → live point weather (Open-Meteo, aggregating national weather services)
- [x] **Cascade Watch v1**: auto-flags chain-capable events (tsunami-flagged or M6+ quakes) and documents known cascade chains (quake→tsunami, dust→algae bloom, fire→air quality, rain-on-burn-scar→landslide, marine heatwave→bloom)
- [ ] Cascade Watch v2: cross-source correlation (aerosol plume trajectory over ocean → bloom watch; storm track vs fire perimeter) and recording flags into the events log
- [ ] Meteorological ingest into the tactical layer: wind field & humidity per operation zone, refreshed continuously
- [ ] Fire weather indices (FWI) computed per zone; feeds risk display
- [ ] Spread prediction v1: wind-driven ellipse growth model over the tactical map (transparent, explainable)
- [ ] Spread prediction v2: terrain-aware (slope, fuel) — Rothermel-style model
- [ ] Predicted-vs-actual recording: every prediction is logged (pillar 1 events) and compared against observed perimeters — this is how the engine learns

## 5. Monitoring & Attention

Many things need watching; coordinators must be told what matters *now*.

- [ ] Attention engine: rules over the live event stream (battery low, crew static too long, wind shift near crews, missed check-in, geofence breach) → prioritized attention queue
- [ ] Attention inbox for coordinators: ranked, acknowledgeable, with one-tap actions
- [ ] Escalation: unacknowledged critical items escalate (louder, wider, eventually voice call-out via pillar 3)
- [ ] Pattern records: recurring situations get named and become protocol candidates

## 6. Go-Live Readiness

- [ ] Real feed ingest (RTSP/WebRTC) replacing simulated streams
- [ ] Real detection model behind the existing detection overlay contract
- [ ] Multi-org hardening: RLS policy audit, rate limits, backup/restore drill
- [ ] Field trial with one partner organization
- [ ] Live.

---

## Build order (near-term)

1. **Supabase project + schema applied** — run `supabase/migrations/0001_init.sql`, put keys in `.env` → login works
2. **Team tab reads real profiles** — first mock module swapped for live data
3. **Events pipeline** — everything notable writes an event; the recording layer everything else builds on
4. **Attention engine v1** — rules over events, inbox in the shell header
5. **Voice assistant v1** — Web Speech in the existing AIAssistant panel, wired to live state
6. **Weather ingest + wind display** — first world-engine slice on the tactical map

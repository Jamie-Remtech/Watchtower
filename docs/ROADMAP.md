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

A central assistant that learns situations and helps coordinate — by voice, because collaborators have their hands full. Field-validated demand (2026-08: emergency rescuers asked for exactly this).

- [x] Speech recognition v1 (browser Web Speech API): hands-free dictation in the Field Log
- [ ] Spoken responses (speech synthesis) with barge-in (interruptible)
- [ ] Conversational brain: Claude API behind a Supabase Edge Function (keeps the API key server-side) with tool access to Watchtower state (feeds, positions, weather, field log, protocols) — answers "what's the situation in sector 7?" from live data
- [ ] **Skills & knowledge library** (rescuer-requested): each user declares their specialties (CPR, water rescue, pump operation, HAZMAT…); knowledge entries (procedures, checklists, machine how-tos) accumulate per emergency-service type; the AI serves this shared knowledge to whoever needs it — "how do I start this pump?", "walk me through CPR" — voice question, voice answer, maximum speed. Schema sketch: `skills` (profile_id, skill, level), `knowledge` (org/global, service_type, title, body, source, author), AI retrieval over both plus the events log
- [ ] Guidance interventions: AI notices from live positions/context ("you're heading away from the incident") and offers course-correction — always assist, never command
- [ ] Learning loop: every incident's event log becomes training context — the AI reviews what was done, what worked, and drafts protocol improvements
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
- [x] Time dimension: radar loop slider with play/pause (~2 h of frames) and a 30-day NASA satellite history slider (true color + aerosol + chlorophyll + surface temp step back day by day)
- [x] Wind field layer: direction arrows sampled on a grid across the view (Open-Meteo), colored/sized by speed, refreshed on pan/zoom
- [x] Terrain relief layer: elevation hillshade (AWS Terrain Tiles — USGS 3DEP lidar in the US, SRTM+ globally)
- [x] Pollen + air quality in My Weather: 6 pollen species (European CAMS model) + PM2.5/PM10/ozone worldwide
- [x] Forecast layer: predicted precipitation and cloud cover to +48 h (Open-Meteo model blend) with a future slider — grid-sampled, cached per view, scrubbed without refetching
- [ ] Live geostationary cloud loop (NASA GIBS GOES/Himawari/Meteosat IR bands, 10-min steps) — RainViewer's public IR feed was discontinued
- [ ] Cascade Watch v2: cross-source correlation (aerosol plume trajectory over ocean → bloom watch; storm track vs fire perimeter) and recording flags into the events log
- [ ] Meteorological ingest into the tactical layer: wind field & humidity per operation zone, refreshed continuously
- [ ] Fire weather indices (FWI) computed per zone; feeds risk display
- [ ] Spread prediction v1: wind-driven ellipse growth model over the tactical map (transparent, explainable)
- [ ] Spread prediction v2: terrain-aware (slope, fuel) — Rothermel-style model
- [ ] Predicted-vs-actual recording: every prediction is logged (pillar 1 events) and compared against observed perimeters — this is how the engine learns

## 5. Monitoring & Attention

Many things need watching; coordinators must be told what matters *now*.

- [x] Attention engine v1: sweeps every 5 min — device offline/maintenance/unplaced, NASA EONET hazards near the fleet (wildfires 150 km, others 300 km), USGS M4.5+ quakes within 300 km, Open-Meteo fire-weather at the fleet centroid, invitations expiring <48h; deduped via attention_items (0004), device conditions auto-resolve
- [x] Attention inbox: bell with severity badge in the shell, slide-over panel ranked by severity, one-tap acknowledge, manual re-check; raises/acks recorded in the events log
- [x] Field Log (rescuer-requested): speech-to-text action recording — dictated entries saved to the events log with time + GPS; admin work shrinks to speaking
- [x] Live crew positions (0005): opt-in sharing from the Field Log; tactical map shows fresh fixes per member; history accumulates for action reconstruction
- [x] Tactical map "My area" zero-in button (rescuer-requested)
- [ ] Attention v2: field-crew rules (missed check-in, static too long, geofence breach) now that positions flow; wind-shift-near-crews via World Engine
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

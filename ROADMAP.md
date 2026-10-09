# Roadmap

## Implemented in v1.2.0

- Fixed-step lunar physics with fuel mass, thrust vectoring, terrain contact, and three landing outcomes.
- NASA Mission Control-style responsive interface with Canvas rendering and live telemetry.
- Keyboard controls plus Android-safe tap/hold touch controls for throttle and attitude.
- Automated physics tests and GitHub Pages-compatible `/apollo/` build.
- Classic and Engineering profiles, touchdown mass telemetry, separate safety/fuel grades, and documented physics sources.

## v1.3.0 Part 1

- Seeded Easy/Normal/Hard lunar terrain, obstacles, safe pads, shared rendering/physics geometry, and two-point landing-gear contact.
- Remaining v1.3 work: tuning/review of presentation and release validation.
- Part 3 adds reproducible scenario selection, precision grading, expanded Mission Report, and release QA. AGC/DSKY/3D remain future work.

## v1.4.0 Part 1 — local checkpoint

- Added a versioned FlightRecord with fixed-step telemetry for position, AGL, velocities, accelerations, attitude, thrust, mass, fuel, engine state, mode, scenario, and terrain seed.
- Added grouped pilot/system event logging, completion-only persistence, IndexedDB retention of 20 records, and JSON/CSV export.
- Remaining v1.4 work: recorder history UI improvements, broader browser-device QA, and final release validation.

- **v0.2** — richer lunar terrain, crater generation, lighting, dust, and camera composition.
- **v0.3** — historical Apollo 11 descent scenarios with documented timelines.
- **v0.4** — DSKY interface, verb/noun entry, alarms, and guidance-computer telemetry.
- **v0.5** — research an integration boundary for Virtual AGC and Luminary099.
- **Future** — historical landing mode with validated mission data and archival sources.

The AGC/DSKY items are future research and interface milestones. This release does not claim an AGC, Virtual AGC, or Luminary099 integration.

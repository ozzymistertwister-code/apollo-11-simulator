# Changelog

## v1.4.5 — 2026-10-09

- Added optional Latin/Cyrillic pilot callsign entry with local persistence and explicit public-display consent.
- Added public flight-summary API adapter, shared leaderboard panel, duplicate-safe submission, and offline-safe behavior.
- Added existing-server SQLite API integration with input validation, rate limiting, separate storage, and `verified=false` protection for browser submissions.
- Added automated coverage for identity validation, API payload minimization, offline failure, and existing v1.4 behavior.

### Hall of Fame and public details

- Added `HALL OF FAME // TOP 10` with Engineering-default mode, mode/scenario/difficulty filters, local date/time formatting, and deterministic ranking.
- Added public flight detail cards with Mission, Landing, Fuel, Precision, telemetry, and Replay actions.
- Added separate `MY FLIGHTS // LOCAL DEVICE` labeling and public-record availability handling.
- Extended the existing SQLite API with comparable-condition filters and bounded FlightRecord retrieval for public Replay.

### QA and release hardening

- Added strict server-side FlightRecord shape, size, finite-value, timestamp, metadata, and outcome validation.
- Added `LEADERBOARD.md` with ranking, database, backup, recovery, and verification limitations.
- Added the final QA documentation and release procedure. Browser submissions remain structurally validated but unverified; they are excluded from the official Top 10 until trusted server-side replay verification exists.
- Final release validation covers 57 automated tests, the production build, API validation, duplicate submission handling, database backup, and static asset checks.

## v1.4.0 — 2026-10-09

- Added a fixed-simulation-time Flight Recorder for complete missions.
- Added grouped control, warning, terrain, touchdown, and mission lifecycle events.
- Added IndexedDB storage for the 20 most recent completed flights with graceful unavailable-storage handling.
- Added full JSON and telemetry CSV export from the recorder panel.
- Added seven recorder tests covering timing, event grouping, finite data, export, retention, physics isolation, and IndexedDB fallback.

- Added Flight History with replay, touch-friendly timeline seeking, event markers, pause/resume, and variable playback speed.
- Added telemetry charts with selectable signals and derived mission analytics.
- Added two-flight comparison with compatibility warnings and isolated deletion of saved records.
- Added replay, analytics, and storage deletion tests.
- Published v1.4.0 to `https://syst8m.com/apollo/` after backup and production resource verification.

## v1.3.1 — 2026-10-09

- Increased explicit gameplay-scale terrain relief so hills, depressions, and slopes remain legible on mobile screens.
- Reworked crater rendering from circular overlays to profile-following depressions with lit/dark rims.
- Added color-coded SAFE / CAUTION / UNSAFE surface bands under Landing Assist.
- Corrected mobile touch control layout to keep all five controls in one row.

## v1.3.0 — 2026-10-09

- Added deterministic seeded lunar terrain with Easy, Normal, and Hard profiles.
- Added shared terrain height, slope, normal, obstacle, and safe-pad queries for physics and Canvas rendering.
- Added two-point landing-gear contact, hull/obstacle collision, terrain-aware landing outcomes, and surface telemetry.
- Expanded physics coverage to 29 tests. Publication is intentionally deferred to Part 2/3.
- Added precision landing guidance, safe-zone assist markers, predicted touchdown, adaptive camera zoom/tracking, and compact terrain telemetry.
- Added five guidance/camera tests; publication remains deferred until Part 3.
- Added five reproducible flight scenarios with restart support.
- Expanded Mission Report with Flight Performance, Landing Site Assessment, and Mission Result sections.
- Added precision grade with unsafe-site penalty and generalized contact-status wording.
- Completed release QA; production publication follows after this commit.

## v1.2.0 — 2026-10-09

- Added Classic and Engineering flight profiles.
- Added documented LM descent-engine parameters where available and marked simulator assumptions in PHYSICS.md.
- Added separate Landing Safety Grade and Fuel Efficiency Grade with touchdown mass telemetry.
- Expanded deterministic test coverage to 21 tests, including profile selection and Mission FPS independence.

## v1.0.2 — 2026-10-09

- Added immutable launch/landing fuel telemetry and fuel-used percentage.
- Added Mission Report fuel breakdown, efficiency grade, and horizontal usage bar.
- Fuel efficiency is reported only for safe landings; crashes show `N/A`.
- Added tests for the 8,200 kg configured reserve and reset behaviour.

## v1.0.1 — 2026-10-09

- Preserved interpolated pre-contact speed, angle, fuel, time, and position in immutable `TouchdownTelemetry`.
- Added A+ / A / B / C / F landing grades and bounded module-condition summaries.
- Updated Mission Report to show actual touchdown telemetry instead of post-contact zero velocity.
- Added deterministic tests for touchdown capture, grading axes, reset behaviour, and repeatability.

## v1.0.0 — 2026-10-09

- Fixed mobile throttle controls so `+` and `−` change the engine throttle, not velocity directly.
- Added tap increments and continuous hold repeat with pointer capture and cancellation handling.
- Added visible `THRUST %`, engine state, and fuel state indicators.
- Added physics coverage for braking, thrust vectoring, fuel exhaustion, landing outcomes, and frame-rate independence.
- Published the production build at <https://syst8m.com/apollo/>.

## v0.1.0

- Initial playable Apollo 11 lunar landing simulator with Canvas renderer, mission loop, keyboard controls, and landing classification.

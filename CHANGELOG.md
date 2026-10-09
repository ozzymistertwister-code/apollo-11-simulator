# Changelog

## v1.3.0 — local Part 1 checkpoint

- Added deterministic seeded lunar terrain with Easy, Normal, and Hard profiles.
- Added shared terrain height, slope, normal, obstacle, and safe-pad queries for physics and Canvas rendering.
- Added two-point landing-gear contact, hull/obstacle collision, terrain-aware landing outcomes, and surface telemetry.
- Expanded physics coverage to 29 tests. Publication is intentionally deferred to Part 2/3.
- Added precision landing guidance, safe-zone assist markers, predicted touchdown, adaptive camera zoom/tracking, and compact terrain telemetry.
- Added five guidance/camera tests; publication remains deferred until Part 3.

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

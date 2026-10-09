# Architecture

The simulator is split into small modules so a future guidance computer adapter can replace mission inputs without rewriting physics or rendering.

- `src/config/` — documented gameplay parameters and thresholds.
- `src/physics/` — deterministic craft state, thrust, fuel burn, integration, terrain contact, and landing classification.
- `src/terrain/` — seeded lunar surface profiles, interpolation, normals, obstacles, and guaranteed safe pads.
- `src/simulation/` — fixed-step mission state machine and public controls.
- `src/rendering/` — Canvas 2D scene renderer.
- `src/rendering/camera.ts` — bounded, smoothed camera tracking and zoom.
- `src/controls/` — keyboard bindings and held-input handling.
- `src/ui/` — DOM shell, telemetry, overlays, and responsive presentation.
- `tests/` — Vitest physics contract.

The engine uses metres, seconds, kilograms, and radians internally. `Mission.tick()` accumulates frame time and consumes fixed 1/60 second slices, keeping outcomes independent of display refresh rate. Thrust is a force in newtons; vertical acceleration is `thrust.y / mass - lunarGravity`. Fuel burn is proportional to throttle and time, and an empty tank disables thrust.

`bindTouchControl()` treats a tap as a small throttle/attitude step and a held pointer as a continuous, frame-time-based repeat. Pointer capture, cancellation, `touch-action: none`, and text-selection suppression make the controls reliable on Android touchscreens. Values in `src/config/physics.ts` are gameplay assumptions, not exact historical Apollo 11 specifications. Virtual AGC and DSKY are not integrated in v1.0.0.

At touchdown, `Mission` interpolates the crossing within the final fixed step and freezes a `TouchdownTelemetry` object before the craft state is clamped to terrain and its vertical velocity is zeroed. `LandingAssessment` grades the frozen contact values A+, A, B, C, or F and reports a bounded gameplay condition; it does not claim NASA certification or detailed structural damage simulation.

Fuel economy is independent of landing quality. `Mission.start()` snapshots the configured `initialFuel` (currently 8,200 kg), and touchdown captures `remainingFuel`. `FuelTelemetry` derives `fuelUsed = initialFuel - remainingFuel` and the corresponding percentage. For safe landings only, economy grades use fixed gameplay bands: A+ ≤20%, A ≤35%, B ≤50%, C ≤70%, D >70%; unsafe landings report N/A.

In v1.2.0 `Mission` selects Classic or Engineering parameters without changing module boundaries. Engineering uses documented descent-engine thrust and throttle limits where available; dry mass, terminal setup, burn rate, attitude response, and landing thresholds remain explicit simulator assumptions. The Mission Report exposes the independent `safetyGrade` and `efficiencyGrade` values.

In v1.3.0 Engineering owns a seeded `LunarTerrain`; Renderer receives the same terrain instance, so displayed terrain and collision geometry cannot diverge. The simplified LM landing gear uses two effective contact points at ±2.4 m horizontally and 2.4 m below the craft reference point. Classic intentionally keeps the previous flat-ground contact path. Surface outcomes are `SAFE LANDING`, `HARD LANDING`, `UNSTABLE LANDING`, `TIP-OVER`, or `CRASH`.

Precision guidance is read-only: `landing-guidance.ts` classifies the current zone, `touchdown-prediction.ts` simulates fixed steps while holding current throttle and attitude, and `camera.ts` smooths horizontal tracking plus bounded zoom (`0.78–1.30`). Landing Assist only toggles markers; it never changes Mission state or engine commands. The compact mobile panel uses native `<details>` and preserves pointer capture/tap-hold controls.

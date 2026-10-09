# Architecture

The simulator is split into small modules so a future guidance computer adapter can replace mission inputs without rewriting physics or rendering.

- `src/config/` — documented gameplay parameters and thresholds.
- `src/physics/` — deterministic craft state, thrust, fuel burn, integration, terrain contact, and landing classification.
- `src/simulation/` — fixed-step mission state machine and public controls.
- `src/rendering/` — Canvas 2D scene renderer.
- `src/controls/` — keyboard bindings and held-input handling.
- `src/ui/` — DOM shell, telemetry, overlays, and responsive presentation.
- `tests/` — Vitest physics contract.

The engine uses metres, seconds, kilograms, and radians internally. `Mission.tick()` accumulates frame time and consumes fixed 1/60 second slices, keeping outcomes independent of display refresh rate. Thrust is a force in newtons; vertical acceleration is `thrust.y / mass - lunarGravity`. Fuel burn is proportional to throttle and time, and an empty tank disables thrust.

`bindTouchControl()` treats a tap as a small throttle/attitude step and a held pointer as a continuous, frame-time-based repeat. Pointer capture, cancellation, `touch-action: none`, and text-selection suppression make the controls reliable on Android touchscreens. Values in `src/config/physics.ts` are gameplay assumptions, not exact historical Apollo 11 specifications. Virtual AGC and DSKY are not integrated in v1.0.0.

At touchdown, `Mission` interpolates the crossing within the final fixed step and freezes a `TouchdownTelemetry` object before the craft state is clamped to terrain and its vertical velocity is zeroed. `LandingAssessment` grades the frozen contact values A+, A, B, C, or F and reports a bounded gameplay condition; it does not claim NASA certification or detailed structural damage simulation.

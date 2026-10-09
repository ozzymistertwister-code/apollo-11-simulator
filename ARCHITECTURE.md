# Architecture

The simulator is split into small modules so a future guidance computer adapter can replace mission inputs without rewriting physics or rendering.

- `src/config/` — documented gameplay parameters and thresholds.
- `src/physics/` — deterministic craft state, thrust, fuel burn, integration, terrain contact, and landing classification.
- `src/simulation/` — fixed-step mission state machine and public controls.
- `src/rendering/` — Canvas 2D scene renderer.
- `src/controls/` — keyboard bindings and held-input handling.
- `src/ui/` — DOM shell, telemetry, overlays, and responsive presentation.
- `tests/` — Vitest physics contract.

The engine uses metres, seconds, kilograms, and radians internally. `Mission.tick()` accumulates frame time and consumes fixed 1/60 second slices, keeping outcomes independent of display refresh rate. Values in `src/config/physics.ts` are gameplay assumptions, not exact historical Apollo 11 specifications.

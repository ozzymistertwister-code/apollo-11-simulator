# Physics model

Apollo 11 Simulator v1.3.0 is a deterministic 2D terminal-descent game. It is not a reconstruction of the Apollo 11 trajectory, AGC, guidance software, or spacecraft systems.

## Equations and integration

The state uses metres, seconds, kilograms, newtons, and radians. For each fixed `1/60 s` step:

```text
thrust = maxThrust × commandedThrottle
ax = thrust × sin(angle) / mass
ay = thrust × cos(angle) / mass − lunarGravity
v(next) = v + a × dt
position(next) = position + v(next) × dt
fuel(next) = max(0, fuel − fuelBurnRate × throttle × dt)
mass = dryMass + fuel
```

The semi-implicit Euler step is intentionally small and pure. `Mission.tick()` accumulates frame time and consumes these fixed steps, so display FPS does not change the physical result. Contact telemetry is interpolated inside the crossing step and captured before terrain resolution sets vertical velocity to zero.

## Profiles

Classic retains the established playable values: lunar gravity `1.62 m/s²`, dry mass `10,100 kg`, starting fuel `8,200 kg`, maximum thrust `45,500 N`, and fuel burn `2.55 kg/s` at full command. These are gameplay parameters.

Engineering uses a `44,482 N` maximum descent-engine thrust, a `10–60%` commanded throttle range, and `730 kg` nominal terminal-descent propellant budget. These values are drawn from the sources below. Dry mass, initial altitude, burn rate, attitude response, touchdown thresholds, and the simplified 2D force model remain explicitly labelled simulator assumptions; they are not presented as complete LM specifications.

Fuel efficiency is calculated from the launch snapshot: `fuelUsed = initialFuel − remainingFuel`. It is graded only after a safe (`success`) landing, so saving fuel cannot turn a destroyed or critical vehicle into a good result.

## Lunar terrain and landing gear

Engineering Mode generates `LunarTerrain(seed, difficulty)` from a deterministic integer PRNG. The generator combines interpolated low-frequency height noise, crater bowls/rims, rocks, and one flattened safe pad. Easy uses a wide 54 m pad, Normal a 34 m pad, and Hard a 22 m pad; the pad is deliberately guaranteed to be clear and within the starting scenario. Heights are piecewise-linear between 4 m samples, so `heightAt(x)` is continuous. `slopeAt(x)` uses a centred finite difference and `normalAt(x)` returns the normalized `(-slope, 1)` vector. Physics and Canvas rendering query this same terrain instance.

The real LM had four landing legs; this 2D model uses two effective points at local coordinates `(-2.4 m, -2.4 m)` and `(2.4 m, -2.4 m)` relative to the craft reference point. Contact is detected per support after rotation, with separate simplified hull points and obstacle checks. A fixed-step contact resolves penetration by lifting the craft vertically and zeroing vertical velocity only after touchdown telemetry is captured.

Surface thresholds are simulator rules, not NASA limits: stable slope is ≤ `0.14 rad` (~8°), tip-over slope is > `0.36 rad` (~20.6°), and stable relative craft/surface angle is ≤12°. Two supports, no hull/rock contact, and stable slope produce `SAFE LANDING`; velocity/angle limits then distinguish soft from hard touchdown. Steep or single-support contact produces `UNSTABLE LANDING` or `TIP-OVER`; hull/obstacle contact produces `CRASH`.

## Sources and limits

- NASA, *Apollo Experience Report: Descent Propulsion System*, NASA NTRS [19730011150](https://ntrs.nasa.gov/citations/19730011150).
- NASA, *Apollo 11 Lunar Landing Press Kit*, descent engine rated thrust and throttle range ([PDF](https://www.nasa.gov/wp-content/uploads/static/history/alsj/a11/A11_PressKit.pdf)).
- NASA, *Apollo Lunar Module Propulsion Systems Overview*, NASA NTRS [20090016298](https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/20090016298.pdf).
- MIT OpenCourseWare, *Engineering Apollo: The Moon Project as a Complex System*, propulsion overview ([PDF](https://ocw.mit.edu/courses/sts-471j-engineering-apollo-the-moon-project-as-a-complex-system-spring-2007/1a2f426ce94c3479603c26872289f7b3_crimsonteam.pdf)).

The model omits terrain relief, landing-leg dynamics, gimbal dynamics, RCS, propellant slosh, guidance laws, navigation errors, AGC/DSKY, and the historical Apollo 11 descent timeline. The Engineering profile is therefore a documented-parameter teaching mode, not a claim of full historical fidelity.

The precision landing predictor is a gameplay instrument: it advances the same fixed-step equations and terrain collision queries while holding the current throttle and attitude. It is recalculated periodically for display, does not command the craft, and returns `UNAVAILABLE` when the modeled terrain envelope is not reached within its bounded horizon.

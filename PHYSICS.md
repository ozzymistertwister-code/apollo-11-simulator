# Physics model

Apollo 11 Simulator v1.2.0 is a deterministic 2D terminal-descent game. It is not a reconstruction of the Apollo 11 trajectory, AGC, guidance software, or spacecraft systems.

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

## Sources and limits

- NASA, *Apollo Experience Report: Descent Propulsion System*, NASA NTRS [19730011150](https://ntrs.nasa.gov/citations/19730011150).
- NASA, *Apollo 11 Lunar Landing Press Kit*, descent engine rated thrust and throttle range ([PDF](https://www.nasa.gov/wp-content/uploads/static/history/alsj/a11/A11_PressKit.pdf)).
- NASA, *Apollo Lunar Module Propulsion Systems Overview*, NASA NTRS [20090016298](https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/20090016298.pdf).
- MIT OpenCourseWare, *Engineering Apollo: The Moon Project as a Complex System*, propulsion overview ([PDF](https://ocw.mit.edu/courses/sts-471j-engineering-apollo-the-moon-project-as-a-complex-system-spring-2007/1a2f426ce94c3479603c26872289f7b3_crimsonteam.pdf)).

The model omits terrain relief, landing-leg dynamics, gimbal dynamics, RCS, propellant slosh, guidance laws, navigation errors, AGC/DSKY, and the historical Apollo 11 descent timeline. The Engineering profile is therefore a documented-parameter teaching mode, not a claim of full historical fidelity.

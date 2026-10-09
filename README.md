# Apollo 11 Lunar Landing Simulator

A playable browser-based 2D lunar landing game inspired by NASA Mission Control. Guide the Eagle through a fixed-step physics model: burn fuel, manage thrust, correct attitude, and land without exceeding the safe envelope.

**Live mission:** [syst8m.com/apollo](https://syst8m.com/apollo/)

## Run locally

```bash
npm install
npm run dev
```

Use **W/S** for throttle, **←/→** for attitude, **Space** to pause, and **R** to restart. On a phone, hold **+** to increase engine thrust, hold **−** to decrease it, and use the outer buttons to tilt. A tap changes thrust by a small step; holding repeats continuously. The console shows `THRUST %`, engine state, and fuel state.

```bash
npm test
npm run build
```

Version `1.3.1` retains the deterministic lunar terrain and two-point landing-gear contact from v1.3.0, with more legible gameplay-scale relief and profile-following crater rendering. Terrain, obstacles, safe pads, surface grades, and remaining simplifications are documented in [PHYSICS.md](PHYSICS.md) and [TERRAIN.md](TERRAIN.md).

Engineering Mode also provides optional `LANDING ASSIST` markers, terrain slope/zone/drift telemetry, and a `PREDICTED TOUCHDOWN` estimate assuming current throttle and attitude are held. The estimate is read-only and reports `UNAVAILABLE` outside the modeled envelope.

Select one of the five seeded scenarios before launch. Restart repeats the selected scenario. The Mission Report includes Flight Performance, Landing Site Assessment, and Mission Result sections, including a precision grade that does not reward an unsafe site. See [TERRAIN.md](TERRAIN.md) for the generation and coordinate model.

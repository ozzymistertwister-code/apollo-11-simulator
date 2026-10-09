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

Version `1.3.0` adds deterministic lunar terrain and two-point landing-gear contact in Engineering Mode while preserving the flat-ground Classic profile. Terrain, obstacles, safe pads, surface grades, and remaining simplifications are documented in [PHYSICS.md](PHYSICS.md). Publication is deferred until the remaining v1.3 work is complete.

Engineering Mode also provides optional `LANDING ASSIST` markers, terrain slope/zone/drift telemetry, and a `PREDICTED TOUCHDOWN` estimate assuming current throttle and attitude are held. The estimate is read-only and reports `UNAVAILABLE` outside the modeled envelope.

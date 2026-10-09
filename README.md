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

Version `1.4.5` retains the deterministic lunar terrain and two-point landing-gear contact from v1.3.1 and adds pilot callsigns plus an optional shared-flight submission path on top of v1.4. A completed mission records fixed-step telemetry and grouped pilot events, persists the last 20 completed flights in IndexedDB, and can export JSON or CSV from the recorder panel. See [FLIGHT_RECORDER.md](FLIGHT_RECORDER.md) for the versioned format and storage policy.

Terrain, obstacles, safe pads, surface grades, and remaining simplifications are documented in [PHYSICS.md](PHYSICS.md) and [TERRAIN.md](TERRAIN.md).

Engineering Mode also provides optional `LANDING ASSIST` markers, terrain slope/zone/drift telemetry, and a `PREDICTED TOUCHDOWN` estimate assuming current throttle and attitude are held. The estimate is read-only and reports `UNAVAILABLE` outside the modeled envelope.

The `FLIGHT HISTORY // REPLAY & ANALYTICS` panel opens completed local records without interrupting an active mission. Replay uses recorded coordinates and attitude with 0.5×–4× playback, a touch-friendly timeline, event markers, seven selectable telemetry graphs, derived landing metrics, and two-flight comparison warnings for different initial conditions.

`HALL OF FAME // TOP 10` shows only independently verified successful landings under comparable mode/scenario/difficulty filters. `MY FLIGHTS // LOCAL DEVICE` remains separate from server results; public details can open the stored FlightRecord in the existing Analytics or Replay views.

The v1.4.0 production build is published at [syst8m.com/apollo](https://syst8m.com/apollo/). Production deployment is a static `/apollo/` directory update on the existing System 8 VPS; each update is backed up before replacement.

Select one of the five seeded scenarios before launch. Restart repeats the selected scenario. The Mission Report includes Flight Performance, Landing Site Assessment, and Mission Result sections, including a precision grade that does not reward an unsafe site. See [TERRAIN.md](TERRAIN.md) for the generation and coordinate model.

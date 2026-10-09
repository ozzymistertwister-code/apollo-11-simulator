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

Version `1.2.0` provides Classic and Engineering profiles. Engineering uses documented LM descent-engine limits where available; remaining simplifications are marked in [PHYSICS.md](PHYSICS.md). Mission Report preserves interpolated touchdown telemetry and reports separate landing safety and fuel-efficiency grades. See [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md), and [CHANGELOG.md](CHANGELOG.md).

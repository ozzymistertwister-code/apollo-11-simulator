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

Version `1.0.2` uses clearly marked gameplay assumptions in `src/config/physics.ts`, not exact historical Apollo 11 specifications. Mission Report preserves interpolated touchdown telemetry before contact damping and reports fuel economy. The configured starting reserve is `8,200 kg`; `fuelUsed = initialFuel - remainingFuel`, and `fuelUsedPercent = fuelUsed / initialFuel × 100`. Fuel efficiency is graded only for safe landings. See [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md), and [CHANGELOG.md](CHANGELOG.md).

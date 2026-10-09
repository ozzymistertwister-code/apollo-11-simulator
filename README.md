# Apollo 11 Lunar Landing Simulator

A playable browser-based 2D lunar landing game inspired by NASA Mission Control. Guide the Eagle through a fixed-step physics model: burn fuel, manage thrust, correct attitude, and land without exceeding the safe envelope.

## Run locally

```bash
npm install
npm run dev
```

Use **W/S** for throttle, **←/→** for attitude, **Space** to pause, and **R** to restart.

```bash
npm test
npm run build
```

Version `0.1.0` uses clearly marked gameplay assumptions in `src/config/physics.ts`, not exact historical Apollo 11 specifications. See [ARCHITECTURE.md](ARCHITECTURE.md) and [ROADMAP.md](ROADMAP.md).

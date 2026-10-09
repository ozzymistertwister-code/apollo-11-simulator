# Lunar terrain and precision landing

Apollo 11 Simulator v1.3.0 uses a deterministic 2D lunar surface in Engineering Mode. Classic Mode intentionally keeps the v1.2 flat-ground path.

## Generation

`LunarTerrain(seed, difficulty)` creates one immutable profile. A small seeded integer PRNG produces low-frequency control heights, which are interpolated into 4 m surface samples. Crater bowls/rims are applied to those samples, then deterministic rocks are placed outside the guaranteed starting pad. The same seed and difficulty produce the same points, craters, rocks, and safe pad.

Difficulty parameters:

| Profile | Noise | Craters | Rocks | Guaranteed pad | Safe slope |
| --- | ---: | ---: | ---: | ---: | ---: |
| Easy | 0.35 m | 3 | 3 | 54 m | 0.10 rad |
| Normal | 1.10 m | 7 | 8 | 34 m | 0.16 rad |
| Hard | 2.10 m | 11 | 15 | 22 m | 0.22 rad |

The pad is a gameplay guarantee, not a claim about the historical Apollo 11 landing site.

## Coordinates and queries

World X is horizontal in metres and world Y is height above the terrain datum in metres. `heightAt(x)` linearly interpolates the cached 4 m samples. `slopeAt(x)` uses a centred finite difference over half a sample. `normalAt(x)` returns the normalized `(-slope, 1)` vector. Obstacles are cached circles with a terrain-relative centre and radius.

Physics and Canvas rendering receive the same `LunarTerrain` object. Renderer adds crater rim/shadow cues, rock silhouettes, and a restrained texture without generating new terrain per frame.

## Landing zones and scenarios

`assessLandingZone()` samples the effective support width, checks maximum local slope, obstacle clearance, and membership in the guaranteed pad. It returns `Safe`, `Caution`, or `Unsafe`. Landing Assist only draws pad markers and telemetry; it never changes thrust, attitude, or the physical state.

The fixed scenarios are:

- A Easy Landing — seed 1301, Easy.
- B Crater Approach — seed 1302, Normal.
- C Rocky Terrain — seed 1303, Hard.
- D Sloped Surface — seed 1304, Hard.
- E Precision Challenge — seed 1305, Hard.

Restarting with the same selection recreates the same seed and terrain. The predictor advances the same fixed-step physics and collision queries while holding current throttle and attitude. It is bounded and reports `UNAVAILABLE` when no contact can be established.

## Limitations

This is not a full lunar DEM, not a four-leg structural model, and not an Apollo guidance reconstruction. The model uses two effective landing supports, simplified circular rocks, piecewise-linear ground, one selected target pad, and gameplay thresholds for slope, stability, and precision.

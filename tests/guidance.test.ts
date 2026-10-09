import { describe, expect, it } from 'vitest';
import { ENGINEERING_PHYSICS } from '../src/config/physics';
import { initialCraft } from '../src/physics/engine';
import { LunarTerrain } from '../src/terrain/lunar-terrain';
import { assessLandingZone, targetOffset } from '../src/simulation/landing-guidance';
import { predictTouchdown } from '../src/simulation/touchdown-prediction';
import { INITIAL_CAMERA, updateCamera } from '../src/rendering/camera';
import { assessPrecision } from '../src/simulation/precision-grade';
import { SCENARIOS } from '../src/simulation/scenarios';

describe('precision landing guidance', () => {
  it('smoothly follows horizontal movement and zooms in near the surface', () => {
    const terrain = new LunarTerrain(1101, 'normal');
    const moved = updateCamera(INITIAL_CAMERA, { ...initialCraft(ENGINEERING_PHYSICS), position: { x: 80, y: 300 } }, terrain, 0.2);
    const low = updateCamera(moved, { ...initialCraft(ENGINEERING_PHYSICS), position: { x: 80, y: 5 } }, terrain, 0.2);
    expect(moved.x).toBeGreaterThan(0);
    expect(moved.x).toBeLessThan(80);
    expect(low.zoom).toBeGreaterThan(moved.zoom);
  });

  it('classifies the guaranteed pad as safe and a rock area as unsafe', () => {
    const terrain = new LunarTerrain(1101, 'hard');
    expect(assessLandingZone(terrain, 0).zone).toBe('Safe');
    const obstacle = terrain.profile.obstacles[0];
    expect(assessLandingZone(terrain, obstacle.x).zone).toBe('Unsafe');
  });

  it('predicts a touchdown and responds to current attitude', () => {
    const terrain = new LunarTerrain(1101, 'normal');
    const upright = { ...initialCraft(ENGINEERING_PHYSICS), position: { x: 0, y: 35 }, engineOn: true, throttle: 0.2 };
    const tilted = { ...upright, angle: Math.PI / 6 };
    const first = predictTouchdown(upright, terrain, ENGINEERING_PHYSICS);
    const second = predictTouchdown(tilted, terrain, ENGINEERING_PHYSICS);
    expect(first.available).toBe(true);
    expect(second.available).toBe(true);
    if (first.available && second.available) expect(second.x).not.toBeCloseTo(first.x, 3);
  });

  it('reports unavailable for Classic and does not mutate physics state', () => {
    const craft = initialCraft();
    const before = JSON.stringify(craft);
    expect(predictTouchdown(craft, undefined, ENGINEERING_PHYSICS).available).toBe(false);
    expect(JSON.stringify(craft)).toBe(before);
  });

  it('keeps target offset centered on the selected safe pad', () => {
    const terrain = new LunarTerrain(1101, 'normal');
    expect(targetOffset(terrain, terrain.nearestSafePad(0).center)).toBe(0);
  });
  it('does not award precision for an unsafe landing site', () => { expect(assessPrecision(0, 0, 'SAFE LANDING', 'Unsafe').grade).toBe('F'); });
  it('returns N/A precision when no target was selected', () => { expect(assessPrecision(undefined, 0, 'SAFE LANDING', 'Safe').grade).toBe('N/A'); });
  it('keeps all five scenario seeds reproducible and distinct', () => { expect(SCENARIOS).toHaveLength(5); expect(new Set(SCENARIOS.map((scenario) => scenario.seed)).size).toBe(5); });
  it('keeps gameplay-scale relief visible in every engineering difficulty', () => { for (const difficulty of ['easy', 'normal', 'hard'] as const) { const terrain = new LunarTerrain(1300, difficulty); const heights = terrain.profile.points.map((point) => point.y); expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(difficulty === 'easy' ? 2 : 10); } });
});

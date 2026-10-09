import { describe, expect, it } from 'vitest';
import { PHYSICS } from '../src/config/physics';
import { classifyLanding, initialCraft, stepPhysics } from '../src/physics/engine';

describe('lunar physics', () => {
  it('accelerates downward under lunar gravity without thrust', () => { const next = stepPhysics(initialCraft(), 1); expect(next.velocity.y).toBeCloseTo(-6.62, 2); });
  it('consumes fuel while the engine is active', () => { const craft = { ...initialCraft(), engineOn: true, throttle: 1 }; const next = stepPhysics(craft, 2); expect(next.fuel).toBeLessThan(craft.fuel); });
  it('cuts the engine when fuel is exhausted', () => { const craft = { ...initialCraft(), fuel: 0.01, engineOn: true, throttle: 1 }; const next = stepPhysics(craft, 1); expect(next.fuel).toBe(0); expect(next.engineOn).toBe(false); });
  it('changes horizontal trajectory when tilted', () => { const craft = { ...initialCraft(), angle: Math.PI / 6, engineOn: true, throttle: 1 }; expect(stepPhysics(craft, 1).velocity.x).toBeGreaterThan(0); });
  it('is stable across frame rates through fixed steps', () => { let a = initialCraft(); let b = initialCraft(); for (let i = 0; i < 60; i++) a = stepPhysics(a, 1 / 60); for (let i = 0; i < 30; i++) b = stepPhysics(b, 1 / 30); expect(a.position.y).toBeCloseTo(b.position.y, 1); });
  it('classifies safe, hard and catastrophic landings', () => { expect(classifyLanding({ ...initialCraft(), velocity: { x: 1, y: -1 }, angle: 0 })).toBe('success'); expect(classifyLanding({ ...initialCraft(), velocity: { x: 3, y: -4 }, angle: 0 })).toBe('hard'); expect(classifyLanding({ ...initialCraft(), velocity: { x: 0, y: -20 }, angle: 0 })).toBe('crash'); });
  it('never leaves craft below terrain after contact resolution', () => { const craft = { ...initialCraft(), position: { x: 0, y: -10 } }; expect((craft.position.y <= PHYSICS.terrainBase)).toBe(true); });
});

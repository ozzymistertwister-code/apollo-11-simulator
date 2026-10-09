import type { PhysicsConfig } from '../config/physics';
import { detectLandingContact } from '../physics/landing-gear';
import { stepPhysics } from '../physics/engine';
import type { CraftState } from '../physics/types';
import { LunarTerrain } from '../terrain/lunar-terrain';

export type TouchdownPrediction = Readonly<{ available: true; x: number; zone: 'Safe' | 'Caution' | 'Unsafe'; assumedControls: string }> | Readonly<{ available: false; reason: string }>;

export function predictTouchdown(craft: CraftState, terrain: LunarTerrain | undefined, config: PhysicsConfig, maxSteps = 2400): TouchdownPrediction {
  if (!terrain || !Number.isFinite(craft.position.x) || !Number.isFinite(craft.position.y) || craft.position.y <= 0) return { available: false, reason: 'UNAVAILABLE' };
  let simulated = { ...craft, position: { ...craft.position }, velocity: { ...craft.velocity } };
  for (let step = 0; step < maxSteps; step += 1) {
    simulated = stepPhysics(simulated, config.fixedStep, config);
    const contact = detectLandingContact(simulated, terrain);
    if (contact.contact) {
      const pad = terrain.nearestSafePad(simulated.position.x);
      const zone = Math.abs(simulated.position.x - pad.center) <= pad.width / 2 && contact.result === 'SAFE LANDING' ? 'Safe' : contact.result === 'CRASH' || contact.result === 'TIP-OVER' ? 'Unsafe' : 'Caution';
      return { available: true, x: simulated.position.x, zone, assumedControls: 'CURRENT THROTTLE + ATTITUDE HELD' };
    }
    if (Math.abs(simulated.position.x) > terrain.profile.maxX + 10 || simulated.position.y < -20) break;
  }
  return { available: false, reason: 'UNAVAILABLE' };
}

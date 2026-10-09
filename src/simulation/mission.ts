import { PHYSICS } from '../config/physics';
import { classifyLanding, initialCraft, resolveTerrainContact, stepPhysics } from '../physics/engine';
import type { CraftState, LandingOutcome } from '../physics/types';

export type MissionStatus = 'ready' | 'active' | 'paused' | 'complete';
export type MissionState = { craft: CraftState; time: number; status: MissionStatus; outcome?: LandingOutcome };

export class Mission {
  state: MissionState = { craft: initialCraft(), time: 0, status: 'ready' };
  private accumulator = 0;

  start() { this.state.status = 'active'; }
  pause() { if (this.state.status === 'active') this.state.status = 'paused'; else if (this.state.status === 'paused') this.state.status = 'active'; }
  reset() { this.state = { craft: initialCraft(), time: 0, status: 'ready' }; this.accumulator = 0; }
  setThrottle(value: number) { this.state.craft.throttle = Math.min(1, Math.max(0, value)); this.state.craft.engineOn = this.state.craft.throttle > 0 && this.state.craft.fuel > 0; }
  adjustThrottle(delta: number) { this.setThrottle(this.state.craft.throttle + delta); }
  rotate(delta: number) { this.state.craft.angle = Math.min(PHYSICS.maxTilt, Math.max(-PHYSICS.maxTilt, this.state.craft.angle + delta)); }
  tick(frameDelta: number) {
    if (this.state.status !== 'active') return;
    this.accumulator += Math.min(frameDelta, 0.25);
    while (this.accumulator >= PHYSICS.fixedStep) {
      this.state.craft = stepPhysics(this.state.craft, PHYSICS.fixedStep);
      this.state.time += PHYSICS.fixedStep;
      this.accumulator -= PHYSICS.fixedStep;
      if (this.state.craft.position.y <= PHYSICS.terrainBase) {
        this.state.craft = resolveTerrainContact(this.state.craft);
        this.state.outcome = classifyLanding(this.state.craft);
        this.state.status = 'complete';
        break;
      }
      if (this.state.time >= PHYSICS.maxSimulationTime) { this.state.outcome = 'crash'; this.state.status = 'complete'; break; }
    }
  }
}

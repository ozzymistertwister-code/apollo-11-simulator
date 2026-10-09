import { ENGINEERING_PHYSICS, PHYSICS, type FlightMode, type PhysicsConfig } from '../config/physics';
import { assessLanding, captureFuelTelemetry, captureTouchdown, initialCraft, resolveTerrainContact, stepPhysics } from '../physics/engine';
import { detectLandingContact, resolveLandingGearContact } from '../physics/landing-gear';
import { LunarTerrain, type TerrainDifficulty } from '../terrain/lunar-terrain';
import { assessLandingZone } from './landing-guidance';
import { assessPrecision, type PrecisionAssessment } from './precision-grade';
import type { ScenarioId } from './scenarios';
import type { CraftState, FuelTelemetry, LandingAssessment, LandingOutcome, TouchdownTelemetry } from '../physics/types';

export type MissionStatus = 'ready' | 'active' | 'paused' | 'complete';
export type MissionState = { craft: CraftState; time: number; status: MissionStatus; mode: FlightMode; scenarioId?: ScenarioId; targetX?: number; initialFuel?: number; outcome?: LandingOutcome; touchdown?: TouchdownTelemetry; assessment?: LandingAssessment; precision?: PrecisionAssessment; fuelTelemetry?: FuelTelemetry };

export class Mission {
  state: MissionState;
  readonly terrain?: LunarTerrain;
  private accumulator = 0;

  constructor(public readonly mode: FlightMode = 'classic', difficulty: TerrainDifficulty = 'normal', seed = 1101, public readonly scenarioId?: ScenarioId, public readonly targetX?: number) {
    this.terrain = mode === 'engineering' ? new LunarTerrain(seed, difficulty) : undefined;
    this.state = { craft: initialCraft(this.config), time: 0, status: 'ready', mode, scenarioId, targetX: mode === 'engineering' ? targetX : undefined };
  }

  get config(): PhysicsConfig { return this.mode === 'engineering' ? ENGINEERING_PHYSICS : PHYSICS; }

  start() { if (this.state.status === 'ready') this.state.initialFuel = this.state.craft.fuel; this.state.status = 'active'; }
  pause() { if (this.state.status === 'active') this.state.status = 'paused'; else if (this.state.status === 'paused') this.state.status = 'active'; }
  reset() { this.state = { craft: initialCraft(this.config), time: 0, status: 'ready', mode: this.mode, scenarioId: this.scenarioId, targetX: this.mode === 'engineering' ? this.targetX : undefined }; this.accumulator = 0; }
  setThrottle(value: number) { this.state.craft.throttle = Math.min(1, Math.max(0, value)); this.state.craft.engineOn = this.state.craft.throttle > 0 && this.state.craft.fuel > 0; }
  adjustThrottle(delta: number) { this.setThrottle(this.state.craft.throttle + delta); }
  rotate(delta: number) { this.state.craft.angle = Math.min(this.config.maxTilt, Math.max(-this.config.maxTilt, this.state.craft.angle + delta)); }
  tick(frameDelta: number) {
    if (this.state.status !== 'active') return;
    this.accumulator += Math.min(frameDelta, 0.25);
    while (this.accumulator >= this.config.fixedStep) {
      const before = this.state.craft;
      const beforeTime = this.state.time;
      const next = stepPhysics(before, this.config.fixedStep, this.config);
      this.state.craft = next;
      this.state.time += this.config.fixedStep;
      this.accumulator -= this.config.fixedStep;
      const contact = this.terrain ? detectLandingContact(next, this.terrain) : undefined;
      if (contact?.contact || (!this.terrain && this.state.craft.position.y <= this.config.terrainBase)) {
        const terrainHeight: number = contact ? this.terrain!.heightAt(next.position.x) : this.config.terrainBase;
        const contactCenterHeight: number = contact ? next.position.y - contact.penetration : terrainHeight;
        this.state.touchdown = captureTouchdown(before, next, beforeTime, this.config.fixedStep, terrainHeight, contact ? { terrainHeight, slope: contact.slope, supportContacts: contact.supportContacts, obstacleContact: contact.obstacleContact, hullContact: contact.hullContact, result: contact.result } : undefined, contactCenterHeight);
        this.state.assessment = assessLanding(this.state.touchdown, this.config);
        const zone = this.terrain ? assessLandingZone(this.terrain, this.state.touchdown.position.x).zone : 'Safe';
        this.state.precision = assessPrecision(this.targetX, this.state.touchdown.position.x, this.state.assessment.result, zone);
        this.state.craft = contact ? resolveLandingGearContact(this.state.craft, contact) : resolveTerrainContact(this.state.craft, this.config.terrainBase);
        this.state.outcome = this.state.assessment.outcome;
        this.state.fuelTelemetry = captureFuelTelemetry(this.state.initialFuel ?? this.config.initialFuel, this.state.touchdown.fuel, this.state.assessment.outcome === 'success', this.mode);
        this.state.status = 'complete';
        break;
      }
      if (this.state.time >= this.config.maxSimulationTime) { this.state.outcome = 'crash'; this.state.status = 'complete'; break; }
    }
  }
}

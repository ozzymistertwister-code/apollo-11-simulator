import { thrustVector } from '../physics/engine';
import type { PhysicsConfig } from '../config/physics';
import type { CraftState } from '../physics/types';
import type { ScenarioId } from '../simulation/scenarios';
import type { FlightEvent, FlightEventType, FlightRecord, FlightRecordReport, FlightTelemetrySample } from './types';

const VERSION = '1.4.5';
const SAMPLE_PERIOD = 0.1;
const finite = (value: number) => Number.isFinite(value) ? value : 0;
const id = () => globalThis.crypto?.randomUUID?.() ?? `flight-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export type FlightRecorderContext = Readonly<{ mode: 'classic' | 'engineering'; scenarioId?: ScenarioId; terrainSeed?: number; config: PhysicsConfig }>;

export class FlightRecorder {
  readonly flightId = id();
  private readonly context: FlightRecorderContext;
  private readonly telemetry: FlightTelemetrySample[] = [];
  private readonly events: FlightEvent[] = [];
  private nextSampleTime = 0;
  private initialFuel = 0;
  private lowFuelReported = false;
  private highDescentReported = false;
  private dangerZone = false;
  private started = false;
  private completed = false;

  constructor(context: FlightRecorderContext) { this.context = context; }

  start(craft: CraftState) {
    if (this.started) return;
    this.started = true;
    this.initialFuel = craft.fuel;
    this.addEvent('MISSION_START', 0, { mode: this.context.mode, scenarioId: this.context.scenarioId ?? 'N/A', terrainSeed: this.context.terrainSeed ?? 'N/A' });
    this.sample(0, craft, craft, 0, 0);
    this.nextSampleTime = SAMPLE_PERIOD;
  }

  recordControl(type: 'THROTTLE_CHANGE' | 'ATTITUDE_CHANGE', time: number, value: number, delta: number) {
    if (!this.started || this.completed) return;
    const previous = this.events[this.events.length - 1];
    if (previous?.type === type && time - previous.time < 0.5) {
      this.events[this.events.length - 1] = { ...previous, parameters: { ...previous.parameters, value: finite(value), delta: finite(delta), endTime: finite(time) } };
      return;
    }
    this.addEvent(type, time, { value: finite(value), delta: finite(delta) });
  }

  recordLandingAssist(time: number, enabled: boolean) { if (this.started && !this.completed) this.addEvent('LANDING_ASSIST_CHANGE', time, { enabled }); }

  recordStep(time: number, before: CraftState, after: CraftState, dt: number, surfaceHeight: number, danger: boolean) {
    if (!this.started || this.completed) return;
    const safeDt = Math.max(dt, 1e-9);
    const verticalAcceleration = (after.velocity.y - before.velocity.y) / safeDt;
    const horizontalAcceleration = (after.velocity.x - before.velocity.x) / safeDt;
    if (!this.lowFuelReported && after.fuel <= this.initialFuel * 0.2) { this.lowFuelReported = true; this.addEvent('LOW_FUEL', time, { fuel: finite(after.fuel), remainingPercent: finite(after.fuel / Math.max(this.initialFuel, 1) * 100) }); }
    if (!this.highDescentReported && Math.abs(after.velocity.y) >= 8) { this.highDescentReported = true; this.addEvent('HIGH_DESCENT_RATE', time, { verticalVelocity: finite(after.velocity.y) }); }
    if (danger && !this.dangerZone) { this.dangerZone = true; this.addEvent('DANGER_ZONE_ENTERED', time, { x: finite(after.position.x) }); }
    if (!danger) this.dangerZone = false;
    if (time + 1e-9 >= this.nextSampleTime) {
      this.sample(time, before, after, verticalAcceleration, horizontalAcceleration, surfaceHeight);
      while (this.nextSampleTime <= time + 1e-9) this.nextSampleTime += SAMPLE_PERIOD;
    }
  }

  complete(time: number, report: FlightRecordReport, eventType: 'SUCCESSFUL_LANDING' | 'EMERGENCY_LANDING' = report.outcome === 'success' ? 'SUCCESSFUL_LANDING' : 'EMERGENCY_LANDING'): FlightRecord | undefined {
    if (!this.started || this.completed) return undefined;
    this.completed = true;
    if (report.touchdown) this.addEvent('TOUCHDOWN', report.touchdown.flightTime, { x: finite(report.touchdown.position.x), verticalSpeed: finite(report.touchdown.verticalSpeed), horizontalSpeed: finite(report.touchdown.horizontalSpeed) });
    this.addEvent(eventType, time, { outcome: report.outcome });
    this.addEvent('MISSION_COMPLETE', time, { outcome: report.outcome });
    return Object.freeze({ recordVersion: 1, id: this.flightId, simulatorVersion: VERSION, createdAt: new Date().toISOString(), status: 'complete', mode: this.context.mode, scenarioId: this.context.scenarioId, terrainSeed: this.context.terrainSeed, initialParameters: { lunarGravity: this.context.config.lunarGravity, fixedStep: this.context.config.fixedStep, initialAltitude: this.context.config.initialAltitude, dryMass: this.context.config.dryMass, initialFuel: this.context.config.initialFuel, maxThrust: this.context.config.maxThrust, fuelBurnRate: this.context.config.fuelBurnRate }, telemetry: [...this.telemetry], events: [...this.events], report });
  }

  private sample(time: number, before: CraftState, after: CraftState, verticalAcceleration: number, horizontalAcceleration: number, surfaceHeight = 0) {
    const thrust = thrustVector(after, this.context.config);
    this.telemetry.push({ time: finite(time), positionX: finite(after.position.x), positionY: finite(after.position.y), altitudeAGL: Math.max(0, finite(after.position.y - surfaceHeight)), verticalVelocity: finite(after.velocity.y), horizontalVelocity: finite(after.velocity.x), verticalAcceleration: finite(verticalAcceleration), horizontalAcceleration: finite(horizontalAcceleration), angleDeg: finite(after.angle * 180 / Math.PI), throttlePercent: finite(after.throttle * 100), thrustKN: finite(Math.hypot(thrust.x, thrust.y) / 1000), mass: finite(after.mass), fuel: finite(after.fuel), fuelUsed: finite(this.initialFuel - after.fuel), engineOn: after.engineOn, mode: this.context.mode, scenarioId: this.context.scenarioId, terrainSeed: this.context.terrainSeed });
  }

  private addEvent(type: FlightEventType, time: number, parameters: Record<string, string | number | boolean>) { this.events.push({ type, time: finite(time), parameters }); }
}

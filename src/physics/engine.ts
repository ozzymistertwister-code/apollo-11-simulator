import { PHYSICS, type PhysicsConfig } from '../config/physics';
import type { CraftState, LandingAssessment, LandingOutcome, TouchdownTelemetry, Vector } from './types';

export const initialCraft = (config: PhysicsConfig = PHYSICS): CraftState => ({
  position: { x: 0, y: config.initialAltitude },
  velocity: { x: config.initialHorizontalVelocity, y: config.initialVerticalVelocity },
  angle: 0,
  throttle: 0,
  fuel: config.initialFuel,
  mass: config.dryMass + config.initialFuel,
  engineOn: false
});

export function thrustVector(craft: CraftState, config: PhysicsConfig = PHYSICS): Vector {
  if (!craft.engineOn || craft.fuel <= 0 || craft.throttle <= 0) return { x: 0, y: 0 };
  const force = config.maxThrust * craft.throttle;
  return { x: Math.sin(craft.angle) * force, y: Math.cos(craft.angle) * force };
}

export function stepPhysics(craft: CraftState, dt: number, config: PhysicsConfig = PHYSICS): CraftState {
  const safeDt = Math.max(dt, 0);
  const burn = craft.engineOn ? config.fuelBurnRate * craft.throttle * safeDt : 0;
  const fuel = Math.max(0, craft.fuel - burn);
  const engineOn = craft.engineOn && fuel > 0;
  const mass = config.dryMass + fuel;
  const thrust = thrustVector({ ...craft, fuel, engineOn }, config);
  const acceleration = { x: thrust.x / mass, y: thrust.y / mass - config.lunarGravity };
  const velocity = { x: craft.velocity.x + acceleration.x * safeDt, y: craft.velocity.y + acceleration.y * safeDt };
  const position = { x: craft.position.x + velocity.x * safeDt, y: craft.position.y + velocity.y * safeDt };
  return { ...craft, position, velocity, fuel, mass, engineOn };
}

export function classifyLanding(craft: CraftState, config: PhysicsConfig = PHYSICS): LandingOutcome {
  const vertical = Math.abs(craft.velocity.y);
  const horizontal = Math.abs(craft.velocity.x);
  const tilt = Math.abs(craft.angle);
  if (tilt > config.criticalTilt || vertical > config.hardVerticalSpeed * 2 || horizontal > config.hardHorizontalSpeed * 2) return 'crash';
  if (vertical <= config.softVerticalSpeed && horizontal <= config.softHorizontalSpeed && tilt <= config.hardTilt) return 'success';
  if (vertical <= config.hardVerticalSpeed && horizontal <= config.hardHorizontalSpeed && tilt <= config.hardTilt) return 'hard';
  return 'crash';
}

export function captureTouchdown(before: CraftState, after: CraftState, beforeTime: number, dt: number, terrainHeight = PHYSICS.terrainBase): TouchdownTelemetry {
  const travel = before.position.y - after.position.y;
  const alpha = travel > 0 ? Math.min(1, Math.max(0, (before.position.y - terrainHeight) / travel)) : 1;
  const lerp = (a: number, b: number) => a + (b - a) * alpha;
  const velocity = { x: lerp(before.velocity.x, after.velocity.x), y: lerp(before.velocity.y, after.velocity.y) };
  return Object.freeze({
    verticalSpeed: velocity.y,
    horizontalSpeed: velocity.x,
    totalSpeed: Math.hypot(velocity.x, velocity.y),
    angle: lerp(before.angle, after.angle),
    fuel: lerp(before.fuel, after.fuel),
    flightTime: beforeTime + dt * alpha,
    position: Object.freeze({ x: lerp(before.position.x, after.position.x), y: terrainHeight })
  });
}

export function assessLanding(telemetry: TouchdownTelemetry, config: PhysicsConfig = PHYSICS): LandingAssessment {
  const vertical = Math.abs(telemetry.verticalSpeed);
  const horizontal = Math.abs(telemetry.horizontalSpeed);
  const tilt = Math.abs(telemetry.angle);
  if (vertical <= config.excellentVerticalSpeed && horizontal <= config.excellentHorizontalSpeed && tilt <= config.excellentTilt) {
    return { grade: 'A+', condition: 'Intact', outcome: 'success', summary: 'Excellent touchdown. Guidance reports a very soft, stable landing.' };
  }
  if (vertical <= config.softVerticalSpeed && horizontal <= config.softHorizontalSpeed && tilt <= config.hardTilt) {
    return { grade: 'A', condition: 'Intact', outcome: 'success', summary: 'Safe touchdown. The module is stable within the playable landing envelope.' };
  }
  if (vertical <= config.hardVerticalSpeed && horizontal <= config.hardHorizontalSpeed && tilt <= config.hardTilt) {
    return { grade: 'B', condition: 'Minor Damage', outcome: 'hard', summary: 'Hard touchdown. The module landed, but the landing gear may be damaged.' };
  }
  if (vertical <= config.criticalVerticalSpeed && horizontal <= config.criticalHorizontalSpeed && tilt <= config.criticalTilt) {
    return { grade: 'C', condition: 'Major Damage', outcome: 'crash', summary: 'Critical touchdown. The module reached the surface with serious damage.' };
  }
  return { grade: 'F', condition: 'Destroyed', outcome: 'crash', summary: 'Crash. The landing exceeded the playable survival envelope.' };
}

export function resolveTerrainContact(craft: CraftState, terrainHeight = PHYSICS.terrainBase): CraftState {
  return craft.position.y <= terrainHeight ? { ...craft, position: { ...craft.position, y: terrainHeight }, velocity: { x: craft.velocity.x, y: 0 }, engineOn: false } : craft;
}

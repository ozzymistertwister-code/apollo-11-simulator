export const PHYSICS = {
  lunarGravity: 1.62,
  fixedStep: 1 / 60,
  initialAltitude: 420,
  initialHorizontalVelocity: 0,
  initialVerticalVelocity: -5,
  dryMass: 10100,
  initialFuel: 8200,
  maxThrust: 45500,
  maxThrottle: 1,
  fuelBurnRate: 2.55,
  maxTilt: Math.PI / 3,
  terrainBase: 0,
  contactOffset: 2.4,
  softVerticalSpeed: 2.5,
  softHorizontalSpeed: 2.5,
  hardVerticalSpeed: 5.5,
  hardHorizontalSpeed: 5,
  hardTilt: Math.PI / 6,
  criticalTilt: Math.PI / 3,
  excellentVerticalSpeed: 1,
  excellentHorizontalSpeed: 1,
  excellentTilt: 5 * Math.PI / 180,
  criticalVerticalSpeed: 11,
  criticalHorizontalSpeed: 10,
  maxSimulationTime: 900
} as const;

export type PhysicsConfig = typeof PHYSICS;

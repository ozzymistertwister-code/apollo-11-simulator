export type FlightMode = 'classic' | 'engineering';

export const PHYSICS = {
  mode: 'classic' as FlightMode,
  lunarGravity: 1.62,
  fixedStep: 1 / 60,
  initialAltitude: 420,
  initialHorizontalVelocity: 0,
  initialVerticalVelocity: -5,
  dryMass: 10100,
  initialFuel: 8200,
  maxThrust: 45500,
  minThrottle: 0,
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
  maxSimulationTime: 900,
  engineeringThrottleRange: false
} as const;

/**
 * Engineering profile: values marked historical in PHYSICS.md are based on
 * Apollo LM descent-engine references; the remaining values stay gameplay
 * assumptions so the mode remains playable as a terminal-descent exercise.
 */
export const ENGINEERING_PHYSICS: PhysicsConfig = {
  ...PHYSICS,
  mode: 'engineering',
  initialFuel: 730,
  maxThrust: 44482,
  minThrottle: 0.10,
  maxThrottle: 0.60,
  fuelBurnRate: 2.36,
  engineeringThrottleRange: true
};

export type PhysicsConfig = Omit<typeof PHYSICS, 'mode' | 'initialFuel' | 'maxThrust' | 'minThrottle' | 'maxThrottle' | 'fuelBurnRate' | 'engineeringThrottleRange'> & {
  mode: FlightMode;
  initialFuel: number;
  maxThrust: number;
  minThrottle: number;
  maxThrottle: number;
  fuelBurnRate: number;
  engineeringThrottleRange?: boolean;
};

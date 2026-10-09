export type Vector = { x: number; y: number };

export type CraftState = {
  position: Vector;
  velocity: Vector;
  angle: number;
  throttle: number;
  fuel: number;
  mass: number;
  engineOn: boolean;
};

export type LandingOutcome = 'success' | 'hard' | 'crash';
export type LandingResult = 'SAFE LANDING' | 'HARD LANDING' | 'UNSTABLE LANDING' | 'TIP-OVER' | 'CRASH';

export type TouchdownGrade = 'A+' | 'A' | 'B' | 'C' | 'F';
export type ModuleCondition = 'Intact' | 'Minor Damage' | 'Major Damage' | 'Destroyed';

export type TouchdownTelemetry = Readonly<{
  verticalSpeed: number;
  horizontalSpeed: number;
  totalSpeed: number;
  angle: number;
  fuel: number;
  mass: number;
  flightTime: number;
  position: Vector;
  terrainHeight?: number;
  slope?: number;
  supportContacts?: number;
  obstacleContact?: boolean;
  hullContact?: boolean;
  result?: LandingResult;
}>;

export type LandingAssessment = Readonly<{
  grade: TouchdownGrade;
  safetyGrade: TouchdownGrade;
  condition: ModuleCondition;
  outcome: LandingOutcome;
  result: LandingResult;
  slope: number;
  supportContacts: number;
  obstacleContact: boolean;
  stable: boolean;
  summary: string;
}>;

export type FuelEfficiencyGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'N/A';

export type FuelTelemetry = Readonly<{
  initialFuel: number;
  remainingFuel: number;
  fuelUsed: number;
  fuelUsedPercent: number;
  efficiencyGrade: FuelEfficiencyGrade;
  mode: 'classic' | 'engineering';
}>;

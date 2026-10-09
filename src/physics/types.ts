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

export type TouchdownGrade = 'A+' | 'A' | 'B' | 'C' | 'F';
export type ModuleCondition = 'Intact' | 'Minor Damage' | 'Major Damage' | 'Destroyed';

export type TouchdownTelemetry = Readonly<{
  verticalSpeed: number;
  horizontalSpeed: number;
  totalSpeed: number;
  angle: number;
  fuel: number;
  flightTime: number;
  position: Vector;
}>;

export type LandingAssessment = Readonly<{
  grade: TouchdownGrade;
  condition: ModuleCondition;
  outcome: LandingOutcome;
  summary: string;
}>;

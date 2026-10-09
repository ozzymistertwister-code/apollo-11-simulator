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

import type { FlightRecord } from './types';

export type FlightAnalytics = Readonly<{
  maximumDescentRate: number | null;
  brakingStartTime: number | null;
  maximumThrust: number | null;
  fuelUsed: number | null;
  engineTime: number | null;
  dangerousDescentTime: number | null;
  horizontalDisplacement: number | null;
  touchdownVerticalSpeed: number | null;
  touchdownHorizontalSpeed: number | null;
  touchdownAngle: number | null;
  safetyGrade: string | null;
  outcome: string | null;
}>;

export function comparableFlights(a: FlightRecord, b: FlightRecord): boolean {
  return a.mode === b.mode && a.scenarioId === b.scenarioId && a.terrainSeed === b.terrainSeed && a.initialParameters.fixedStep === b.initialParameters.fixedStep;
}

export function analyzeFlight(record: FlightRecord): FlightAnalytics {
  const samples = record.telemetry;
  if (!samples.length) return { maximumDescentRate: null, brakingStartTime: null, maximumThrust: null, fuelUsed: null, engineTime: null, dangerousDescentTime: null, horizontalDisplacement: null, touchdownVerticalSpeed: null, touchdownHorizontalSpeed: null, touchdownAngle: null, safetyGrade: null, outcome: record.report.outcome ?? null };
  const touchdown = record.report.touchdown;
  let engineTime = 0;
  let dangerousTime = 0;
  let brakingStartTime: number | null = null;
  for (let i = 0; i < samples.length; i += 1) {
    const current = samples[i];
    const previous = samples[i - 1];
    const dt = previous ? Math.max(0, current.time - previous.time) : 0;
    if (current.engineOn) engineTime += dt;
    if (Math.abs(current.verticalVelocity) >= 8) dangerousTime += dt;
    if (brakingStartTime === null && current.verticalVelocity < 0 && current.verticalAcceleration > 0.05) brakingStartTime = current.time;
  }
  return {
    maximumDescentRate: Math.max(...samples.map((sample) => Math.max(0, -sample.verticalVelocity))),
    brakingStartTime,
    maximumThrust: Math.max(...samples.map((sample) => sample.thrustKN)),
    fuelUsed: Math.max(0, samples[0].fuel - samples.at(-1)!.fuel),
    engineTime,
    dangerousDescentTime: dangerousTime,
    horizontalDisplacement: Math.abs(samples.at(-1)!.positionX - samples[0].positionX),
    touchdownVerticalSpeed: touchdown?.verticalSpeed ?? null,
    touchdownHorizontalSpeed: touchdown?.horizontalSpeed ?? null,
    touchdownAngle: touchdown ? touchdown.angle * 180 / Math.PI : null,
    safetyGrade: record.report.assessment?.safetyGrade ?? null,
    outcome: record.report.outcome ?? null,
  };
}

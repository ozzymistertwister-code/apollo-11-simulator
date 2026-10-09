import type { FlightMode } from '../config/physics';
import type { LandingAssessment, TouchdownTelemetry, FuelTelemetry } from '../physics/types';
import type { PrecisionAssessment } from '../simulation/precision-grade';
import type { ScenarioId } from '../simulation/scenarios';

export const FLIGHT_RECORD_VERSION = 1 as const;

export type FlightEventType = 'MISSION_START' | 'THROTTLE_CHANGE' | 'ATTITUDE_CHANGE' | 'LOW_FUEL' | 'HIGH_DESCENT_RATE' | 'LANDING_ASSIST_CHANGE' | 'DANGER_ZONE_ENTERED' | 'TOUCHDOWN' | 'EMERGENCY_LANDING' | 'SUCCESSFUL_LANDING' | 'MISSION_COMPLETE';

export type FlightTelemetrySample = Readonly<{
  time: number;
  positionX: number;
  positionY: number;
  altitudeAGL: number;
  verticalVelocity: number;
  horizontalVelocity: number;
  verticalAcceleration: number;
  horizontalAcceleration: number;
  angleDeg: number;
  throttlePercent: number;
  thrustKN: number;
  mass: number;
  fuel: number;
  fuelUsed: number;
  engineOn: boolean;
  mode: FlightMode;
  scenarioId?: ScenarioId;
  terrainSeed?: number;
}>;

export type FlightEvent = Readonly<{ type: FlightEventType; time: number; parameters: Readonly<Record<string, string | number | boolean>> }>;

export type FlightRecordReport = Readonly<{
  touchdown?: TouchdownTelemetry;
  assessment?: LandingAssessment;
  fuelTelemetry?: FuelTelemetry;
  precision?: PrecisionAssessment;
  outcome: 'success' | 'hard' | 'crash';
}>;

export type FlightRecord = Readonly<{
  recordVersion: typeof FLIGHT_RECORD_VERSION;
  id: string;
  simulatorVersion: string;
  createdAt: string;
  status: 'complete';
  mode: FlightMode;
  scenarioId?: ScenarioId;
  terrainSeed?: number;
  initialParameters: Readonly<Record<string, number | string | boolean>>;
  telemetry: ReadonlyArray<FlightTelemetrySample>;
  events: ReadonlyArray<FlightEvent>;
  report: FlightRecordReport;
  pilotName?: string;
  publicConsent?: boolean;
  legacy?: boolean;
  verificationStatus?: 'unverified' | 'verified' | 'rejected';
}>;

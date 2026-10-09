import type { FlightRecord } from '../recording/types';
import type { PilotIdentity } from '../pilot/pilot-identity';
import { scenarioById } from '../simulation/scenarios';

export type PublicFlightSummary = Readonly<{
  id?: string;
  pilotName: string;
  publicConsent?: boolean;
  recordId?: string;
  simulatorVersion?: string;
  mode: 'classic' | 'engineering';
  scenarioId?: string;
  terrainSeed?: number;
  difficulty?: 'easy' | 'normal' | 'hard';
  outcome: 'success' | 'hard' | 'crash';
  safetyGrade: string;
  efficiencyGrade: string;
  precisionGrade: string;
  touchdownVerticalSpeed: number | null;
  touchdownHorizontalSpeed: number | null;
  touchdownAngle: number | null;
  fuelUsed: number | null;
  flightTime: number;
  telemetryRef?: string;
  telemetryHash?: string;
  targetDistance?: number | null;
  terrainSlope?: number | null;
  moduleCondition?: string;
  initialFuel?: number | null;
  remainingFuel?: number | null;
  verified?: boolean;
  createdAt?: string;
  flightRecord?: FlightRecord;
}>;

export type PublicFlightDetails = PublicFlightSummary & Readonly<{ flightRecord?: FlightRecord }>;

async function sha256(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) return 'unavailable';
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function publicFlightSummary(record: FlightRecord, identity: PilotIdentity): Promise<PublicFlightSummary> {
  return {
    pilotName: identity.name,
    publicConsent: identity.publicConsent,
    recordId: record.id,
    simulatorVersion: record.simulatorVersion,
    mode: record.mode,
    scenarioId: record.scenarioId,
    terrainSeed: record.terrainSeed,
    difficulty: record.scenarioId ? scenarioById(record.scenarioId).difficulty : undefined,
    outcome: record.report.outcome,
    safetyGrade: record.report.assessment?.safetyGrade ?? 'N/A',
    efficiencyGrade: record.report.fuelTelemetry?.efficiencyGrade ?? 'N/A',
    precisionGrade: record.report.precision?.grade ?? 'N/A',
    touchdownVerticalSpeed: record.report.touchdown?.verticalSpeed ?? null,
    touchdownHorizontalSpeed: record.report.touchdown?.horizontalSpeed ?? null,
    touchdownAngle: record.report.touchdown ? record.report.touchdown.angle * 180 / Math.PI : null,
    fuelUsed: record.report.fuelTelemetry?.fuelUsed ?? null,
    targetDistance: record.report.precision?.distance ?? null,
    terrainSlope: record.report.assessment?.slope ? record.report.assessment.slope * 180 / Math.PI : record.report.assessment?.slope ?? null,
    moduleCondition: record.report.assessment?.condition ?? 'N/A',
    initialFuel: record.report.fuelTelemetry?.initialFuel ?? null,
    remainingFuel: record.report.fuelTelemetry?.remainingFuel ?? record.report.touchdown?.fuel ?? null,
    flightTime: record.report.touchdown?.flightTime ?? record.telemetry.at(-1)?.time ?? 0,
    telemetryRef: `flight-record:${record.id}`,
    telemetryHash: await sha256(JSON.stringify(record)),
    flightRecord: record,
  };
}

export async function submitPublicFlight(record: FlightRecord, identity: PilotIdentity, fetcher: typeof fetch = fetch): Promise<{ id: string; verified: boolean; duplicate?: boolean }> {
  const response = await fetcher('/apollo/api/flights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(await publicFlightSummary(record, identity)) });
  if (!response.ok) throw new Error(`Flight submission failed (${response.status})`);
  return response.json() as Promise<{ id: string; verified: boolean; duplicate?: boolean }>;
}

export async function fetchLeaderboard(filters: { mode?: 'classic' | 'engineering'; scenarioId?: string; difficulty?: 'easy' | 'normal' | 'hard' } = {}, fetcher: typeof fetch = fetch): Promise<{ entries: PublicFlightSummary[]; pending: PublicFlightSummary[] }> {
  const query = new URLSearchParams({ include_pending: 'false' });
  if (filters.mode) query.set('mode', filters.mode);
  if (filters.scenarioId) query.set('scenarioId', filters.scenarioId);
  if (filters.difficulty) query.set('difficulty', filters.difficulty);
  const response = await fetcher(`/apollo/api/leaderboard?${query.toString()}`);
  if (!response.ok) throw new Error(`Leaderboard unavailable (${response.status})`);
  return response.json() as Promise<{ entries: PublicFlightSummary[]; pending: PublicFlightSummary[] }>;
}

export async function fetchPublicFlight(id: string, fetcher: typeof fetch = fetch): Promise<PublicFlightDetails> {
  const response = await fetcher(`/apollo/api/flights/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(response.status === 404 ? 'PUBLIC FLIGHT NOT FOUND' : `Flight details unavailable (${response.status})`);
  return response.json() as Promise<PublicFlightDetails>;
}

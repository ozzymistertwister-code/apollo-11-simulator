import type { FlightRecord } from './types';
import type { PilotIdentity } from '../pilot/pilot-identity';

export const UNKNOWN_PILOT = 'UNKNOWN PILOT';
export const CURRENT_SIMULATOR_VERSION = '1.4.6';

export function isLegacyRecord(record: Pick<FlightRecord, 'legacy' | 'pilotName' | 'simulatorVersion'>): boolean {
  if (typeof record.legacy === 'boolean') return record.legacy;
  return !record.pilotName && record.simulatorVersion !== CURRENT_SIMULATOR_VERSION;
}

export function pilotNameForRecord(record: Pick<FlightRecord, 'pilotName'>): string {
  return record.pilotName?.trim() || UNKNOWN_PILOT;
}

export function enrichCompletedRecord(record: FlightRecord, identity?: PilotIdentity): FlightRecord {
  return {
    ...record,
    pilotName: identity?.name || UNKNOWN_PILOT,
    publicConsent: identity?.publicConsent ?? false,
    legacy: false,
    verificationStatus: 'unverified',
  };
}

export function assignLegacyPilotName(record: FlightRecord, name: string): FlightRecord {
  return { ...record, pilotName: name, legacy: isLegacyRecord(record), publicConsent: false, verificationStatus: 'unverified' };
}

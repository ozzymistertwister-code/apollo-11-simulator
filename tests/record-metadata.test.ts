import { describe, expect, it } from 'vitest';
import { assignLegacyPilotName, enrichCompletedRecord, isLegacyRecord, pilotNameForRecord } from '../src/recording/record-metadata';
import type { FlightRecord } from '../src/recording/types';

const record = (overrides: Partial<FlightRecord> = {}): FlightRecord => ({
  recordVersion: 1, id: 'legacy-record', simulatorVersion: '1.4.0', createdAt: '2026-01-01T00:00:00Z', status: 'complete', mode: 'engineering',
  initialParameters: {}, telemetry: [], events: [], report: { outcome: 'success' }, ...overrides,
});

describe('FlightRecord metadata compatibility', () => {
  it('labels old records as legacy and uses UNKNOWN PILOT without changing the record', () => {
    const old = record();
    expect(isLegacyRecord(old)).toBe(true);
    expect(pilotNameForRecord(old)).toBe('UNKNOWN PILOT');
    expect(assignLegacyPilotName(old, 'Орёл-2').createdAt).toBe(old.createdAt);
    expect(assignLegacyPilotName(old, 'Орёл-2').report).toBe(old.report);
  });

  it('marks newly completed local records unverified without making them legacy', () => {
    const current = enrichCompletedRecord(record({ simulatorVersion: '1.4.5' }), { name: 'Pilot 11', publicConsent: false });
    expect(current.pilotName).toBe('Pilot 11');
    expect(current.legacy).toBe(false);
    expect(current.verificationStatus).toBe('unverified');
  });
});

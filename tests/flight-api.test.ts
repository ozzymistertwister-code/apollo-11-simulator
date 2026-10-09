import { describe, expect, it } from 'vitest';
import { publicFlightSummary, submitPublicFlight } from '../src/online/flight-api';
import type { FlightRecord } from '../src/recording/types';

const record = {
  recordVersion: 1, id: 'flight-api-test-1234', simulatorVersion: '1.4.5', createdAt: '2026-10-09T00:00:00.000Z', status: 'complete', mode: 'engineering', scenarioId: 'easy-landing', terrainSeed: 1301, initialParameters: { fixedStep: 1 / 60 },
  telemetry: [{ time: 4, positionX: 0, positionY: 0, altitudeAGL: 0, verticalVelocity: -1, horizontalVelocity: 0, verticalAcceleration: 0, horizontalAcceleration: 0, angleDeg: 0, throttlePercent: 0, thrustKN: 0, mass: 100, fuel: 50, fuelUsed: 10, engineOn: false, mode: 'engineering', scenarioId: 'easy-landing', terrainSeed: 1301 }], events: [], report: { outcome: 'success', assessment: { safetyGrade: 'A' }, fuelTelemetry: { efficiencyGrade: 'B', fuelUsed: 10 }, precision: { grade: 'A' }, touchdown: { verticalSpeed: -1, horizontalSpeed: 0, angle: 0, flightTime: 4 } },
} as unknown as FlightRecord;

describe('public flight API adapter', () => {
  it('sends a public summary and preserves the record reference without raw telemetry', async () => {
    let body = '';
    const response = await submitPublicFlight(record, { name: 'Орёл-1', publicConsent: true }, async (_input, init) => { body = String(init?.body); return new Response(JSON.stringify({ id: 'server-id', verified: false }), { status: 201 }); });
    const payload = JSON.parse(body);
    expect(response.verified).toBe(false); expect(payload.pilotName).toBe('Орёл-1'); expect(payload.telemetryRef).toBe('flight-record:flight-api-test-1234'); expect(payload.flightRecord.id).toBe(record.id); expect(payload.flightRecord.telemetry).toHaveLength(1);
  });

  it('surfaces network failure without changing the local record', async () => {
    await expect(submitPublicFlight(record, { name: 'Alex 11', publicConsent: true }, async () => { throw new Error('offline'); })).rejects.toThrow('offline');
    expect((await publicFlightSummary(record, { name: 'Alex 11', publicConsent: true })).recordId).toBe(record.id);
  });
});

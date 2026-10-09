import { describe, expect, it } from 'vitest';
import { ENGINEERING_PHYSICS } from '../src/config/physics';
import { initialCraft, stepPhysics } from '../src/physics/engine';
import { FlightRecorder } from '../src/recording/flight-recorder';
import { exportFlightCsv, exportFlightJson } from '../src/recording/flight-export';
import { IndexedDbFlightRecordStore, MemoryFlightRecordStore } from '../src/recording/flight-storage';

function completedRecord() {
  const recorder = new FlightRecorder({ mode: 'engineering', scenarioId: 'easy-landing', terrainSeed: 1301, config: ENGINEERING_PHYSICS });
  let craft = initialCraft(ENGINEERING_PHYSICS);
  recorder.start(craft);
  recorder.recordControl('THROTTLE_CHANGE', 0, 0.2, 0.2);
  craft = { ...craft, throttle: 0.2, engineOn: true };
  for (let i = 0; i < 18; i += 1) { const next = stepPhysics(craft, ENGINEERING_PHYSICS.fixedStep, ENGINEERING_PHYSICS); recorder.recordStep((i + 1) * ENGINEERING_PHYSICS.fixedStep, craft, next, ENGINEERING_PHYSICS.fixedStep, 0, false); craft = next; }
  return recorder.complete(1, { outcome: 'success' })!;
}

describe('flight recorder', () => {
  it('starts at mission start and samples on simulation time, not render FPS', () => { const record = completedRecord(); expect(record.telemetry[0].time).toBe(0); expect(record.telemetry.every((sample) => Number.isFinite(sample.time))).toBe(true); expect(record.telemetry).toHaveLength(4); record.telemetry.forEach((sample, index) => expect(sample.time).toBeCloseTo(index * 0.1, 8)); });
  it('records metadata, grouped controls, and completion events', () => { const record = completedRecord(); expect(record.mode).toBe('engineering'); expect(record.scenarioId).toBe('easy-landing'); expect(record.terrainSeed).toBe(1301); expect(record.events.map((event) => event.type)).toEqual(['MISSION_START', 'THROTTLE_CHANGE', 'SUCCESSFUL_LANDING', 'MISSION_COMPLETE']); });
  it('does not emit NaN or Infinity and exports valid JSON and CSV', () => { const record = completedRecord(); const json = exportFlightJson(record); const parsed = JSON.parse(json); expect(parsed.recordVersion).toBe(1); expect(json).not.toMatch(/NaN|Infinity/); const csv = exportFlightCsv(record); expect(csv.split('\n')[0]).toContain('time_s'); expect(csv.split('\n').length).toBe(record.telemetry.length + 2); });
  it('persists at least twenty recent records through the storage contract', async () => { const store = new MemoryFlightRecordStore(); for (let i = 0; i < 25; i += 1) { const record = { ...completedRecord(), id: `record-${i}` }; await store.save(record); } expect((await store.list()).length).toBe(20); expect((await store.get('record-24'))?.id).toBe('record-24'); });
  it('does not alter the craft result while recording', () => { let craft = initialCraft(ENGINEERING_PHYSICS); const recorder = new FlightRecorder({ mode: 'engineering', config: ENGINEERING_PHYSICS }); recorder.start(craft); const expected = stepPhysics(craft, ENGINEERING_PHYSICS.fixedStep, ENGINEERING_PHYSICS); const next = stepPhysics(craft, ENGINEERING_PHYSICS.fixedStep, ENGINEERING_PHYSICS); recorder.recordStep(ENGINEERING_PHYSICS.fixedStep, craft, next, ENGINEERING_PHYSICS.fixedStep, 0, false); expect(next).toEqual(expected); });
  it('groups held controls and records threshold and terrain events once', () => {
    const recorder = new FlightRecorder({ mode: 'engineering', config: ENGINEERING_PHYSICS });
    const craft = initialCraft(ENGINEERING_PHYSICS);
    recorder.start(craft);
    recorder.recordControl('THROTTLE_CHANGE', 0, 0.1, 0.1);
    recorder.recordControl('THROTTLE_CHANGE', 0.1, 0.2, 0.1);
    const lowFuel = { ...craft, fuel: 100, mass: ENGINEERING_PHYSICS.dryMass + 100, velocity: { x: 4, y: -9 } };
    recorder.recordStep(0.1, craft, lowFuel, ENGINEERING_PHYSICS.fixedStep, 0, true);
    const record = recorder.complete(0.2, { outcome: 'hard' })!;
    expect(record.events.map((event) => event.type)).toEqual(['MISSION_START', 'THROTTLE_CHANGE', 'LOW_FUEL', 'HIGH_DESCENT_RATE', 'DANGER_ZONE_ENTERED', 'EMERGENCY_LANDING', 'MISSION_COMPLETE']);
  });

  it('reports a clear IndexedDB error when the browser API is unavailable', async () => {
    await expect(new IndexedDbFlightRecordStore().list()).rejects.toThrow('IndexedDB unavailable');
  });
});

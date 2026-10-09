import { describe, expect, it } from 'vitest';
import { ENGINEERING_PHYSICS } from '../src/config/physics';
import { initialCraft, stepPhysics } from '../src/physics/engine';
import { analyzeFlight, comparableFlights } from '../src/recording/flight-analytics';
import { FlightReplay, sampleFlight } from '../src/recording/flight-replay';
import { FlightRecorder } from '../src/recording/flight-recorder';
import { MemoryFlightRecordStore } from '../src/recording/flight-storage';

function recordFixture() {
  const recorder = new FlightRecorder({ mode: 'engineering', scenarioId: 'easy-landing', terrainSeed: 1401, config: ENGINEERING_PHYSICS });
  let craft = initialCraft(ENGINEERING_PHYSICS);
  recorder.start(craft);
  craft = { ...craft, throttle: 0.5, engineOn: true };
  for (let index = 0; index < 30; index += 1) {
    const next = stepPhysics(craft, ENGINEERING_PHYSICS.fixedStep, ENGINEERING_PHYSICS);
    recorder.recordStep((index + 1) * ENGINEERING_PHYSICS.fixedStep, craft, next, ENGINEERING_PHYSICS.fixedStep, 0, false);
    craft = next;
  }
  return recorder.complete(0.5, { outcome: 'success' })!;
}

describe('flight replay and analytics', () => {
  it('replays recorded coordinates and angle without recalculating physics', () => {
    const record = recordFixture();
    const replay = new FlightReplay(record);
    replay.seek(0.15);
    expect(replay.state.sample.positionX).toBe(sampleFlight(record, 0.15).positionX);
    expect(replay.state.sample.angleDeg).toBe(sampleFlight(record, 0.15).angleDeg);
    replay.play(); replay.setSpeed(2); replay.tick(0.1);
    expect(replay.state.time).toBeCloseTo(0.35, 5);
    replay.pause(); const paused = replay.state.time; replay.tick(1); expect(replay.state.time).toBe(paused);
  });

  it('derives analytics only from finite recorded samples', () => {
    const analytics = analyzeFlight(recordFixture());
    expect(analytics.maximumDescentRate).not.toBeNull();
    expect(analytics.maximumThrust).toBeGreaterThan(0);
    expect(analytics.fuelUsed).toBeGreaterThanOrEqual(0);
    expect(analytics.engineTime).toBeGreaterThan(0);
    expect(analytics.dangerousDescentTime).toBeGreaterThanOrEqual(0);
    expect(analytics.outcome).toBe('success');
  });

  it('deletes only the selected history record', async () => {
    const store = new MemoryFlightRecordStore();
    const first = { ...recordFixture(), id: 'first' };
    const second = { ...recordFixture(), id: 'second' };
    await store.save(first); await store.save(second); await store.delete('first');
    expect(await store.get('first')).toBeUndefined();
    expect((await store.get('second'))?.id).toBe('second');
  });

  it('warns when comparison records have different starting conditions', () => {
    const first = recordFixture();
    const second = { ...recordFixture(), mode: 'classic' as const };
    expect(comparableFlights(first, first)).toBe(true);
    expect(comparableFlights(first, second)).toBe(false);
  });
});

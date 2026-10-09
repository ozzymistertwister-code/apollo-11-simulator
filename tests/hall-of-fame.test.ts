import { describe, expect, it } from 'vitest';
import { filterHallOfFame, sortHallOfFame } from '../src/online/hall-of-fame';
import type { PublicFlightSummary } from '../src/online/flight-api';

const entry = (id: string, overrides: Partial<PublicFlightSummary> = {}): PublicFlightSummary => ({ id, pilotName: id, mode: 'engineering', scenarioId: 'easy-landing', difficulty: 'easy', outcome: 'success', safetyGrade: 'A', efficiencyGrade: 'B', precisionGrade: 'A', touchdownVerticalSpeed: -1, touchdownHorizontalSpeed: 0, touchdownAngle: 0, fuelUsed: 10, flightTime: 10, telemetryRef: `flight-record:${id}`, telemetryHash: 'unavailable', verified: true, ...overrides });

describe('Hall of Fame rules', () => {
  it('filters by comparable mode/scenario/difficulty and excludes unverified/crash results', () => {
    const entries = [entry('good'), entry('classic', { mode: 'classic' }), entry('crash', { outcome: 'crash' }), entry('pending', { verified: false })];
    expect(filterHallOfFame(entries, { mode: 'engineering', scenarioId: 'easy-landing', difficulty: 'easy' }).map((item) => item.id)).toEqual(['good']);
  });

  it('sorts safety, precision, economy, touchdown speed, and caps at ten', () => {
    const entries = Array.from({ length: 12 }, (_, index) => entry(`flight-${index}`, { safetyGrade: index === 0 ? 'A+' : 'A', precisionGrade: index === 0 ? 'A+' : 'A', touchdownVerticalSpeed: -index - 1 }));
    expect(sortHallOfFame(entries).map((item) => item.id).slice(0, 2)).toEqual(['flight-0', 'flight-1']);
    expect(sortHallOfFame(entries)).toHaveLength(10);
  });
});

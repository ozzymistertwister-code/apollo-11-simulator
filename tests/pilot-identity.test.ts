import { describe, expect, it } from 'vitest';
import { loadPilotName, normalizePilotName, savePilotName, validatePilotName } from '../src/pilot/pilot-identity';

describe('pilot identity', () => {
  it('accepts Latin and Cyrillic callsigns and rejects invalid lengths/characters', () => {
    expect(validatePilotName('  Alex   11 ')).toBeUndefined();
    expect(validatePilotName('Орёл-1')).toBeUndefined();
    expect(validatePilotName('A')).toBeDefined();
    expect(validatePilotName('pilot@example.com')).toBeDefined();
    expect(validatePilotName('a'.repeat(25))).toBeDefined();
  });

  it('normalizes and persists only the callsign', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    savePilotName('  Орёл   1 ', storage);
    expect(normalizePilotName('  Орёл   1 ')).toBe('Орёл 1');
    expect(loadPilotName(storage)).toBe('Орёл 1');
  });
});

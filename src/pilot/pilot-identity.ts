const STORAGE_KEY = 'apollo11-pilot-callsign';
const CALLSIGN_PATTERN = /^[\p{L}\p{N}](?:[\p{L}\p{N} _-]{0,22}[\p{L}\p{N}])?$/u;

export type PilotIdentity = Readonly<{ name: string; publicConsent: boolean }>;

export function normalizePilotName(value: string): string { return value.trim().replace(/\s+/g, ' '); }

export function validatePilotName(value: string): string | undefined {
  const name = normalizePilotName(value);
  if (name.length < 2 || name.length > 24) return 'Use 2–24 characters.';
  if (!CALLSIGN_PATTERN.test(name)) return 'Use letters, numbers, spaces, hyphens, or underscores.';
  return undefined;
}

export function loadPilotName(storage: Pick<Storage, 'getItem'> = localStorage): string { try { return storage.getItem(STORAGE_KEY) ?? ''; } catch { return ''; } }

export function savePilotName(name: string, storage: Pick<Storage, 'setItem'> = localStorage): void { try { storage.setItem(STORAGE_KEY, normalizePilotName(name)); } catch { /* Private browsing may disable local storage. */ } }

import type { PublicFlightSummary } from './flight-api';

const gradeRank: Record<string, number> = { 'A+': 0, A: 1, B: 2, C: 3, F: 4, D: 5, 'N/A': 6 };

export type HallFilters = Readonly<{ mode: 'classic' | 'engineering'; scenarioId?: string; difficulty?: 'easy' | 'normal' | 'hard' }>;

export function filterHallOfFame(entries: PublicFlightSummary[], filters: HallFilters): PublicFlightSummary[] {
  return entries.filter((entry) => entry.verified === true && entry.outcome === 'success' && entry.mode === filters.mode && (!filters.scenarioId || entry.scenarioId === filters.scenarioId) && (!filters.difficulty || entry.difficulty === filters.difficulty));
}

export function sortHallOfFame(entries: PublicFlightSummary[]): PublicFlightSummary[] {
  return [...entries].sort((a, b) => gradeRank[a.safetyGrade] - gradeRank[b.safetyGrade] || gradeRank[a.precisionGrade] - gradeRank[b.precisionGrade] || gradeRank[a.efficiencyGrade] - gradeRank[b.efficiencyGrade] || (Math.abs(a.touchdownVerticalSpeed ?? Number.POSITIVE_INFINITY) + Math.abs(a.touchdownHorizontalSpeed ?? Number.POSITIVE_INFINITY)) - (Math.abs(b.touchdownVerticalSpeed ?? Number.POSITIVE_INFINITY) + Math.abs(b.touchdownHorizontalSpeed ?? Number.POSITIVE_INFINITY)) || (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || (a.id ?? '').localeCompare(b.id ?? '')).slice(0, 10);
}

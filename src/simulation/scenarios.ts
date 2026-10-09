import type { TerrainDifficulty } from '../terrain/lunar-terrain';

export type ScenarioId = 'easy-landing' | 'crater-approach' | 'rocky-terrain' | 'sloped-surface' | 'precision-challenge';
export type ScenarioDefinition = Readonly<{ id: ScenarioId; label: string; description: string; seed: number; difficulty: TerrainDifficulty; targetX: number }>;

export const SCENARIOS: ReadonlyArray<ScenarioDefinition> = [
  { id: 'easy-landing', label: 'A — Easy Landing', description: 'Wide, forgiving landing zone.', seed: 1301, difficulty: 'easy', targetX: 0 },
  { id: 'crater-approach', label: 'B — Crater Approach', description: 'Correct horizontal drift near crater rims.', seed: 1302, difficulty: 'normal', targetX: 0 },
  { id: 'rocky-terrain', label: 'C — Rocky Terrain', description: 'Obstacles and a restricted landing area.', seed: 1303, difficulty: 'hard', targetX: 0 },
  { id: 'sloped-surface', label: 'D — Sloped Surface', description: 'Approach carefully to avoid unstable ground.', seed: 1304, difficulty: 'hard', targetX: 0 },
  { id: 'precision-challenge', label: 'E — Precision Challenge', description: 'A narrow target demands accurate drift control.', seed: 1305, difficulty: 'hard', targetX: 0 }
];

export function scenarioById(id: ScenarioId): ScenarioDefinition {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0];
}

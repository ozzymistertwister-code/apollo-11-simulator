import type { CraftState } from '../physics/types';
import type { LunarTerrain } from '../terrain/lunar-terrain';

export type CameraState = Readonly<{ x: number; zoom: number }>;
export const INITIAL_CAMERA: CameraState = { x: 0, zoom: 0.82 };
export const CAMERA_LIMITS = { minZoom: 0.78, maxZoom: 1.3 } as const;

export function updateCamera(previous: CameraState, craft: CraftState, terrain: LunarTerrain | undefined, dt: number): CameraState {
  const targetX = terrain ? Math.min(terrain.profile.maxX, Math.max(terrain.profile.minX, craft.position.x)) : craft.position.x;
  const altitudeRatio = Math.min(1, Math.max(0, craft.position.y / 420));
  const targetZoom = Math.min(CAMERA_LIMITS.maxZoom, Math.max(CAMERA_LIMITS.minZoom, 0.78 + (1 - altitudeRatio) * 0.52));
  const smoothing = 1 - Math.exp(-Math.max(0, dt) * 5);
  return { x: previous.x + (targetX - previous.x) * smoothing, zoom: Math.min(CAMERA_LIMITS.maxZoom, Math.max(CAMERA_LIMITS.minZoom, previous.zoom + (targetZoom - previous.zoom) * smoothing)) };
}

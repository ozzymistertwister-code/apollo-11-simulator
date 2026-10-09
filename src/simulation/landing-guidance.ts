import { LANDING_GEAR } from '../physics/landing-gear';
import { LunarTerrain } from '../terrain/lunar-terrain';

export type LandingZone = 'Safe' | 'Caution' | 'Unsafe';
export type LandingZoneAssessment = Readonly<{ zone: LandingZone; slope: number; obstacle: boolean; clearance: boolean; pad: boolean }>;

export function assessLandingZone(terrain: LunarTerrain, x: number, baseWidth = LANDING_GEAR.legHalfSpan * 2): LandingZoneAssessment {
  const half = baseWidth / 2;
  let maxSlope = 0;
  let obstacle = false;
  let minClearance = Infinity;
  for (let i = 0; i < 7; i += 1) {
    const sampleX = x - half + (baseWidth * i) / 6;
    maxSlope = Math.max(maxSlope, Math.abs(terrain.slopeAt(sampleX)));
    obstacle ||= terrain.obstaclesAt(sampleX, terrain.heightAt(sampleX), 0.8).length > 0;
    minClearance = Math.min(minClearance, terrain.heightAt(sampleX));
  }
  const pad = terrain.isSafeLandingArea(x, baseWidth);
  const clearance = maxSlope <= LANDING_GEAR.maxStableSlope && !obstacle && minClearance > -6;
  const zone: LandingZone = pad && clearance ? 'Safe' : clearance && maxSlope <= LANDING_GEAR.maxTipSlope ? 'Caution' : 'Unsafe';
  return { zone, slope: Math.atan(maxSlope), obstacle, clearance, pad };
}

export function targetOffset(terrain: LunarTerrain, x: number): number {
  return x - terrain.nearestSafePad(x).center;
}

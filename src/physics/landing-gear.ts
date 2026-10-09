import type { CraftState, LandingResult } from './types';
import { LunarTerrain } from '../terrain/lunar-terrain';

export type LandingGearConfig = Readonly<{
  legHalfSpan: number;
  legDrop: number;
  hullHalfWidth: number;
  hullDrop: number;
  maxStableSlope: number;
  maxTipSlope: number;
  maxStableRelativeAngle: number;
}>;

export const LANDING_GEAR: LandingGearConfig = {
  legHalfSpan: 2.4,
  legDrop: 2.4,
  hullHalfWidth: 2.4,
  hullDrop: 1.3,
  maxStableSlope: 0.14,
  maxTipSlope: 0.36,
  maxStableRelativeAngle: 12 * Math.PI / 180
};

export type SupportPoint = Readonly<{ x: number; y: number; terrainY: number; clearance: number; contact: boolean }>;
export type LandingContact = Readonly<{
  supports: ReadonlyArray<SupportPoint>;
  supportContacts: number;
  slope: number;
  obstacleContact: boolean;
  hullContact: boolean;
  contact: boolean;
  penetration: number;
  result: LandingResult;
  stable: boolean;
}>;

function rotatedPoint(craft: CraftState, localX: number, localY: number) {
  return { x: craft.position.x + Math.cos(craft.angle) * localX - Math.sin(craft.angle) * localY, y: craft.position.y + Math.sin(craft.angle) * localX + Math.cos(craft.angle) * localY };
}

export function supportPoints(craft: CraftState, gear: LandingGearConfig = LANDING_GEAR): SupportPoint[] {
  return [-gear.legHalfSpan, gear.legHalfSpan].map((localX) => {
    const point = rotatedPoint(craft, localX, -gear.legDrop);
    const terrainY = 0;
    return { x: point.x, y: point.y, terrainY, clearance: point.y - terrainY, contact: false };
  });
}

export function detectLandingContact(craft: CraftState, terrain: LunarTerrain, gear: LandingGearConfig = LANDING_GEAR): LandingContact {
  const rawSupports = [-gear.legHalfSpan, gear.legHalfSpan].map((localX) => {
    const point = rotatedPoint(craft, localX, -gear.legDrop);
    const terrainY = terrain.heightAt(point.x);
    const clearance = point.y - terrainY;
    return { x: point.x, y: point.y, terrainY, clearance, contact: clearance <= 0 };
  });
  const supportContacts = rawSupports.filter((support) => support.contact).length;
  const slope = Math.atan(terrain.slopeAt(craft.position.x));
  const hullPoints = [-gear.hullHalfWidth, gear.hullHalfWidth].map((localX) => rotatedPoint(craft, localX, -gear.hullDrop));
  const hullContact = hullPoints.some((point) => point.y <= terrain.heightAt(point.x));
  const obstacleContact = rawSupports.some((support) => terrain.obstaclesAt(support.x, support.terrainY, 0.25).length > 0) || hullPoints.some((point) => terrain.obstaclesAt(point.x, terrain.heightAt(point.x), 0.25).length > 0);
  const contact = supportContacts > 0 || hullContact || obstacleContact;
  const penetration = Math.max(0, ...rawSupports.map((support) => -support.clearance));
  const relativeAngle = Math.abs(craft.angle - slope);
  const stable = supportContacts === 2 && !hullContact && !obstacleContact && Math.abs(slope) <= gear.maxStableSlope && relativeAngle <= gear.maxStableRelativeAngle;
  let result: LandingResult = 'CRASH';
  if (obstacleContact || hullContact) result = 'CRASH';
  else if (Math.abs(slope) > gear.maxTipSlope || relativeAngle > Math.PI / 3 || supportContacts === 1) result = 'TIP-OVER';
  else if (stable) result = 'SAFE LANDING';
  else if (Math.abs(slope) > gear.maxStableSlope || relativeAngle > gear.maxStableRelativeAngle) result = 'UNSTABLE LANDING';
  else if (contact) result = 'HARD LANDING';
  return { supports: rawSupports, supportContacts, slope, obstacleContact, hullContact, contact, penetration, result, stable };
}

export function resolveLandingGearContact(craft: CraftState, contact: LandingContact): CraftState {
  if (!contact.contact) return craft;
  return { ...craft, position: { ...craft.position, y: craft.position.y + contact.penetration }, velocity: { x: craft.velocity.x, y: 0 }, engineOn: false };
}

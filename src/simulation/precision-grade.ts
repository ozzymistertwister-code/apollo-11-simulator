import type { LandingResult, TouchdownGrade } from '../physics/types';

export type PrecisionAssessment = Readonly<{ grade: TouchdownGrade | 'N/A'; distance: number | null; summary: string }>;

export function assessPrecision(targetX: number | undefined, touchdownX: number, landingResult: LandingResult, zone: 'Safe' | 'Caution' | 'Unsafe'): PrecisionAssessment {
  if (targetX === undefined || !Number.isFinite(touchdownX)) return { grade: 'N/A', distance: null, summary: 'No landing target was selected.' };
  const distance = Math.abs(touchdownX - targetX);
  if (landingResult === 'CRASH' || landingResult === 'TIP-OVER' || zone === 'Unsafe') return { grade: 'F', distance, summary: 'Precision credit is withheld because the landing site was unsafe.' };
  if (distance <= 1 && landingResult === 'SAFE LANDING' && zone === 'Safe') return { grade: 'A+', distance, summary: 'Touchdown was centered in the selected safe zone.' };
  if (distance <= 3 && landingResult === 'SAFE LANDING' && zone === 'Safe') return { grade: 'A', distance, summary: 'Touchdown was close to the selected safe zone.' };
  if (distance <= 6) return { grade: 'B', distance, summary: 'Touchdown was serviceable but offset from the target.' };
  if (distance <= 12) return { grade: 'C', distance, summary: 'Touchdown was distant from the selected target.' };
  return { grade: 'F', distance, summary: 'Touchdown missed the selected target envelope.' };
}

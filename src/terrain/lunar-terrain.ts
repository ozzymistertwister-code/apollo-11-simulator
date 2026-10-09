export type TerrainDifficulty = 'easy' | 'normal' | 'hard';

export type TerrainObstacle = Readonly<{ x: number; y: number; radius: number }>;
export type TerrainCrater = Readonly<{ x: number; radius: number; depth: number }>;
export type LandingPad = Readonly<{ start: number; end: number; center: number; width: number }>;

export type TerrainProfile = Readonly<{
  seed: number;
  difficulty: TerrainDifficulty;
  minX: number;
  maxX: number;
  sampleSpacing: number;
  maxSafeSlope: number;
  points: ReadonlyArray<Readonly<{ x: number; y: number }>>;
  obstacles: ReadonlyArray<TerrainObstacle>;
  craters: ReadonlyArray<TerrainCrater>;
  safePads: ReadonlyArray<LandingPad>;
}>;

const SETTINGS: Record<TerrainDifficulty, { noise: number; craterCount: number; craterRadius: [number, number]; rocks: number; padWidth: number; safeSlope: number }> = {
  easy: { noise: 0.35, craterCount: 3, craterRadius: [7, 16], rocks: 3, padWidth: 54, safeSlope: 0.10 },
  normal: { noise: 1.1, craterCount: 7, craterRadius: [9, 27], rocks: 8, padWidth: 34, safeSlope: 0.16 },
  hard: { noise: 2.1, craterCount: 11, craterRadius: [14, 38], rocks: 15, padWidth: 22, safeSlope: 0.22 }
};

const hash = (seed: number) => {
  let value = (seed | 0) ^ 0x9e3779b9;
  return () => {
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    value ^= value >>> 16;
    return (value >>> 0) / 0x100000000;
  };
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export class LunarTerrain {
  readonly profile: TerrainProfile;

  constructor(seed = 1101, difficulty: TerrainDifficulty = 'normal') {
    this.profile = generateTerrain(seed, difficulty);
  }

  heightAt(x: number): number {
    const { points } = this.profile;
    if (x <= points[0].x) return points[0].y;
    if (x >= points[points.length - 1].x) return points[points.length - 1].y;
    const index = clamp(Math.floor((x - points[0].x) / this.profile.sampleSpacing), 0, points.length - 2);
    const left = points[index];
    const right = points[index + 1];
    return lerp(left.y, right.y, (x - left.x) / (right.x - left.x));
  }

  slopeAt(x: number): number {
    const half = this.profile.sampleSpacing / 2;
    return (this.heightAt(x + half) - this.heightAt(x - half)) / (half * 2);
  }

  normalAt(x: number): { x: number; y: number } {
    const slope = this.slopeAt(x);
    const length = Math.hypot(slope, 1);
    return { x: -slope / length, y: 1 / length };
  }

  obstaclesAt(x: number, y = this.heightAt(x), radius = 0): TerrainObstacle[] {
    return this.profile.obstacles.filter((obstacle) => Math.hypot(obstacle.x - x, obstacle.y - y) <= obstacle.radius + radius);
  }

  isSafeLandingArea(x: number, width = 4.8): boolean {
    const half = width / 2;
    const samples = 5;
    for (let i = 0; i < samples; i += 1) {
      const sampleX = x - half + (width * i) / (samples - 1);
      if (Math.abs(this.slopeAt(sampleX)) > this.profile.maxSafeSlope || this.obstaclesAt(sampleX).length > 0) return false;
    }
    return this.profile.safePads.some((pad) => x - half >= pad.start && x + half <= pad.end);
  }

  nearestSafePad(x = 0): LandingPad {
    return this.profile.safePads.reduce((nearest, pad) => Math.abs(pad.center - x) < Math.abs(nearest.center - x) ? pad : nearest);
  }
}

function generateTerrain(seed: number, difficulty: TerrainDifficulty): TerrainProfile {
  const settings = SETTINGS[difficulty];
  const random = hash(seed);
  const minX = -240;
  const maxX = 240;
  const sampleSpacing = 4;
  const safePad: LandingPad = { start: -settings.padWidth / 2, end: settings.padWidth / 2, center: 0, width: settings.padWidth };
  const controlSpacing = 24;
  const controls = Array.from({ length: Math.ceil((maxX - minX) / controlSpacing) + 1 }, () => random() * 2 - 1);
  const points: Array<{ x: number; y: number }> = [];
  for (let x = minX; x <= maxX; x += sampleSpacing) {
    const controlPosition = (x - minX) / controlSpacing;
    const controlIndex = Math.min(controls.length - 2, Math.floor(controlPosition));
    const t = smoothstep(controlPosition - controlIndex);
    let height = lerp(controls[controlIndex], controls[controlIndex + 1], t) * settings.noise;
    if (Math.abs(x) <= safePad.width / 2 + 4) height *= Math.max(0, Math.abs(x) / (safePad.width / 2 + 4));
    points.push({ x, y: height });
  }

  const craters: Array<{ x: number; radius: number; depth: number }> = [];
  for (let i = 0; i < settings.craterCount; i += 1) {
    const side = random() < 0.5 ? -1 : 1;
    const x = side * (settings.padWidth / 2 + 18 + random() * (maxX - settings.padWidth / 2 - 45));
    const radius = lerp(settings.craterRadius[0], settings.craterRadius[1], random());
    craters.push({ x, radius, depth: lerp(1.5, 4.8, random()) });
  }
  for (const point of points) {
    for (const crater of craters) {
      const distance = Math.abs(point.x - crater.x);
      if (distance < crater.radius * 1.35) {
        const bowl = Math.cos(Math.min(1, distance / (crater.radius * 1.35)) * Math.PI) * 0.5 + 0.5;
        point.y -= bowl * crater.depth;
        if (distance > crater.radius * 0.82) point.y += (1 - distance / (crater.radius * 1.35)) * crater.depth * 0.45;
      }
    }
  }
  for (const point of points) {
    if (Math.abs(point.x) <= safePad.width / 2) point.y = 0;
  }

  const obstacles: TerrainObstacle[] = [];
  for (let i = 0; i < settings.rocks; i += 1) {
    const side = random() < 0.5 ? -1 : 1;
    const x = side * (settings.padWidth / 2 + 10 + random() * (maxX - settings.padWidth / 2 - 25));
    const radius = lerp(0.7, difficulty === 'hard' ? 2.8 : 1.8, random());
    obstacles.push({ x, y: interpolate(points, x) + radius * 0.65, radius });
  }
  return { seed, difficulty, minX, maxX, sampleSpacing, maxSafeSlope: settings.safeSlope, points, obstacles, craters, safePads: [safePad] };
}

function interpolate(points: ReadonlyArray<{ x: number; y: number }>, x: number): number {
  if (x <= points[0].x) return points[0].y;
  if (x >= points[points.length - 1].x) return points[points.length - 1].y;
  const index = clamp(Math.floor((x - points[0].x) / 4), 0, points.length - 2);
  return lerp(points[index].y, points[index + 1].y, (x - points[index].x) / 4);
}

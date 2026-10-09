import type { FlightRecord, FlightTelemetrySample } from './types';

export type ReplayState = Readonly<{ playing: boolean; speed: 0.5 | 1 | 2 | 4; time: number; sample: FlightTelemetrySample }>;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const blend = (a: number, b: number, ratio: number) => a + (b - a) * ratio;

export function sampleFlight(record: FlightRecord, time: number): FlightTelemetrySample {
  const samples = record.telemetry;
  if (!samples.length) throw new Error('Flight record has no telemetry');
  const bounded = clamp(time, samples[0].time, samples[samples.length - 1].time);
  let right = samples.findIndex((sample) => sample.time >= bounded);
  if (right < 0) right = samples.length - 1;
  if (right === 0) return samples[0];
  const left = samples[right - 1];
  const next = samples[right];
  const ratio = (bounded - left.time) / Math.max(next.time - left.time, 1e-9);
  return {
    ...left,
    time: bounded,
    positionX: blend(left.positionX, next.positionX, ratio),
    positionY: blend(left.positionY, next.positionY, ratio),
    altitudeAGL: blend(left.altitudeAGL, next.altitudeAGL, ratio),
    verticalVelocity: blend(left.verticalVelocity, next.verticalVelocity, ratio),
    horizontalVelocity: blend(left.horizontalVelocity, next.horizontalVelocity, ratio),
    verticalAcceleration: blend(left.verticalAcceleration, next.verticalAcceleration, ratio),
    horizontalAcceleration: blend(left.horizontalAcceleration, next.horizontalAcceleration, ratio),
    angleDeg: blend(left.angleDeg, next.angleDeg, ratio),
    throttlePercent: blend(left.throttlePercent, next.throttlePercent, ratio),
    thrustKN: blend(left.thrustKN, next.thrustKN, ratio),
    mass: blend(left.mass, next.mass, ratio),
    fuel: blend(left.fuel, next.fuel, ratio),
    fuelUsed: blend(left.fuelUsed, next.fuelUsed, ratio),
    engineOn: ratio < 0.5 ? left.engineOn : next.engineOn,
  };
}

export class FlightReplay {
  private current: ReplayState;
  readonly duration: number;

  constructor(readonly record: FlightRecord) {
    this.duration = record.telemetry.at(-1)?.time ?? 0;
    this.current = { playing: false, speed: 1, time: 0, sample: sampleFlight(record, 0) };
  }

  get state() { return this.current; }
  play() { this.current = { ...this.current, playing: true }; }
  pause() { this.current = { ...this.current, playing: false }; }
  setSpeed(speed: 0.5 | 1 | 2 | 4) { this.current = { ...this.current, speed }; }
  seek(time: number) { const nextTime = clamp(time, 0, this.duration); this.current = { ...this.current, time: nextTime, sample: sampleFlight(this.record, nextTime), playing: nextTime < this.duration && this.current.playing }; }
  tick(realSeconds: number) { if (this.current.playing) this.seek(this.current.time + Math.max(0, realSeconds) * this.current.speed); }
}

export function replayEventMarkers(record: FlightRecord) {
  return record.events.filter((event) => ['LOW_FUEL', 'HIGH_DESCENT_RATE', 'THROTTLE_CHANGE', 'TOUCHDOWN', 'SUCCESSFUL_LANDING', 'EMERGENCY_LANDING'].includes(event.type)).map((event) => ({ time: event.time, type: event.type }));
}

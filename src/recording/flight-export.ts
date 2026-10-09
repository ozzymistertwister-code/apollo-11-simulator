import type { FlightRecord } from './types';

export function exportFlightJson(record: FlightRecord): string { return JSON.stringify(record, null, 2); }

export function exportFlightCsv(record: FlightRecord): string {
  const columns = ['time_s', 'position_x_m', 'position_y_m', 'altitude_agl_m', 'vertical_velocity_m_s', 'horizontal_velocity_m_s', 'vertical_acceleration_m_s2', 'horizontal_acceleration_m_s2', 'angle_deg', 'throttle_percent', 'thrust_kN', 'mass_kg', 'fuel_kg', 'fuel_used_kg', 'engine_on', 'mode', 'scenario_id', 'terrain_seed'];
  const rows = record.telemetry.map((sample) => [sample.time, sample.positionX, sample.positionY, sample.altitudeAGL, sample.verticalVelocity, sample.horizontalVelocity, sample.verticalAcceleration, sample.horizontalAcceleration, sample.angleDeg, sample.throttlePercent, sample.thrustKN, sample.mass, sample.fuel, sample.fuelUsed, sample.engineOn, sample.mode, sample.scenarioId ?? '', sample.terrainSeed ?? ''].map(csvCell).join(','));
  return `${columns.join(',')}\n${rows.join('\n')}\n`;
}

function csvCell(value: string | number | boolean): string { const text = String(value); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }

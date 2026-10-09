# Flight Recorder

The v1.4.0 Flight Recorder is a client-side diagnostic and replay-data boundary. It observes the existing `Mission` state after each fixed physics step; it never advances physics, changes controls, or reads the Canvas frame rate.

## Record format

`FlightRecord.recordVersion` is currently `1`. A record contains:

- identity and metadata: `id`, `simulatorVersion`, ISO `createdAt`, `status`, mode, scenario, and terrain seed;
- `initialParameters`: the physics values needed to interpret the run, including fixed step, gravity, masses, thrust, fuel, and burn rate;
- `telemetry`: samples every 0.1 seconds of simulation time with position, altitude above the sampled terrain, velocities, accelerations, angle, throttle, thrust, mass, fuel, fuel used, engine state, mode, scenario, and seed;
- `events`: timestamped mission, grouped control, warning, Landing Assist, danger-zone, touchdown, outcome, and completion events;
- `report`: the existing Mission Report data, when available.

All numeric values are sanitized to finite numbers before entering a record. Held pointer controls update one grouped event with the latest value and an `endTime`; they do not create an event per render frame. A mission begins recording on `Mission.start()`, and an unfinished mission is never sent to storage.

## Browser storage

`IndexedDbFlightRecordStore` uses the database `apollo11-flight-recorder` and object store `flight-records`. It keeps the 20 newest completed records, keyed by flight ID. Reads and writes are asynchronous and failures are surfaced in the recorder panel. If IndexedDB is unavailable, the simulator remains playable and reports that storage is unavailable; no server or account is required.

## Export

The recorder panel restores the newest stored completed record after a reload and exports the current/latest completed record as pretty-printed JSON or CSV. JSON contains all metadata, telemetry, events, and Mission Report fields. CSV contains telemetry only and names SI units in its headers (`_s`, `_m`, `_m_s`, `_m_s2`, `_kg`, `_kN`, and `_deg`).

This is a simulator record, not an Apollo mission data interchange format. Sampling is 10 Hz and the model remains the existing 2D, fixed-step gameplay model.

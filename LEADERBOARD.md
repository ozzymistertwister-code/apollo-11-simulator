# Apollo 11 Shared Leaderboard

## Architecture

The browser keeps the complete `FlightRecord` in IndexedDB. With explicit public-display consent, it sends a bounded public summary and the FlightRecord needed for public details and Replay to the existing FastAPI process on the System 8 VPS. The API is exposed through nginx under `/apollo/api/` and uses a dedicated SQLite database; it does not create a new server or paid service.

## Database

The production database is `/var/lib/apollo-11-simulator/flights.sqlite3`. The `flights` table stores the server UUID, client FlightRecord ID, callsign, UTC timestamp, simulator version, mode, scenario, difficulty, outcome, grades, touchdown values, fuel values, precision/slope fields, telemetry reference/hash, bounded serialized FlightRecord, `legacy`, and `verification_status`. No IP, email, password, or request headers are stored.

## API

- `POST /apollo/api/flights` — validates and stores a public submission. Consent is required; repeated `recordId` values are idempotent.
- `GET /apollo/api/leaderboard` — returns at most ten official entries. Filters are `mode`, `scenarioId`, and `difficulty`; the UI defaults to Engineering.
- `GET /apollo/api/flights/:id` — returns the public summary and stored FlightRecord when available for details and Replay.

The UI publishes only after an explicit `SAVE TO HALL OF FAME` action. It reads the returned public record after POST; a message is not shown as saved until that read succeeds. Unverified submissions return `SERVER CONFIRMED · PENDING VERIFICATION · NOT IN TOP 10`, which explains why they are stored but absent from the official list.

Nginx applies the existing `syst8m_chat_limit` rate limit, a 32 KiB request limit, and short proxy timeouts. The API rejects unknown fields, invalid callsigns, invalid enums, non-finite numbers, metadata mismatches, non-monotonic or oversized telemetry, and outcome mismatches.

## Ranking rules

Official entries require `verified=true`, `verification_status='verified'`, `legacy=0`, and `outcome='success'`. The API always separates Classic and Engineering with the `mode` filter; scenario and difficulty filters define a comparable ranking group. Sorting within that group is deterministic:

1. safe completed outcome (`success` is required);
2. Landing Safety Grade (`A+`, `A`, `B`, `C`, `F`);
3. Precision Grade;
4. Fuel Efficiency Grade;
5. lower `abs(touchdown_vertical_speed) + abs(touchdown_horizontal_speed)`;
6. earlier UTC timestamp;
7. server UUID ascending as the final stable tie-breaker.

The query applies `LIMIT 10` after this ordering. It does not replace or delete other valid rows.

The server currently sets browser submissions to `verified=false` and `verification_status='unverified'`. Structural validation proves that the payload is well-formed and internally consistent, but it does not independently replay the physical model or prove that a browser did not forge values. Therefore the official Top 10 can remain empty until a trusted verification workflow marks a result verified. The UI explicitly reports this state and does not claim anti-cheat protection. Records from versions before 1.4.5 are marked `legacy=1` and cannot enter the official ranking without an explicit, documented verification process.

## Telemetry and privacy

The stored bounded FlightRecord enables public Replay and Analytics for a submitted result. It contains simulator telemetry, not identity data beyond the consented callsign. If the record is missing or incompatible, public actions show an explanatory unavailable state.

## Backup and recovery

Before production changes, copy the SQLite file to `/var/backups/apollo-flights-v1.4.5-before-<UTC>.sqlite3` and run `PRAGMA integrity_check`. Restore by stopping/restarting the existing `syst8m-chat` service, replacing the database from the backup, and checking API health; never delete the only backup. Frontend `/apollo/` deployments use the existing static-directory backup and atomic replacement procedure.

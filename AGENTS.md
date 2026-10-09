# Agent notes

- Keep the project self-contained. Do not modify sibling projects, server processes, or secret files.
- Treat values in `src/config/physics.ts` as gameplay parameters unless backed by a cited source.
- Preserve module boundaries in `ARCHITECTURE.md`.
- Run `npm test` and `npm run build` after physics or UI changes.
- Test touch controls with both a short tap and a held pointer; keep `pointerup`, `pointercancel`, and pointer capture handling intact.
- Prefer deterministic, pure physics functions so tests can describe behaviour without a browser.
- Do not add Virtual AGC or Luminary099 code to 0.1.x.
- Keep Flight Recorder, Replay, and Analytics as consumers of saved `FlightRecord` data; do not recalculate physics during replay.
- Preserve `recordVersion` compatibility when extending stored records; new fields must be optional or migrated explicitly.
- Keep IndexedDB retention bounded to 20 completed records and never persist an incomplete mission as complete.
- Run `npm test` and `npm run build` before every release commit. Do not create or move existing Git tags without explicit authorization.

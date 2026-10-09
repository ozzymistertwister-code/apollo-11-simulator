# Agent notes

- Keep the project self-contained. Do not modify sibling projects, server processes, or secret files.
- Treat values in `src/config/physics.ts` as gameplay parameters unless backed by a cited source.
- Preserve module boundaries in `ARCHITECTURE.md`.
- Run `npm test` and `npm run build` after physics or UI changes.
- Prefer deterministic, pure physics functions so tests can describe behaviour without a browser.
- Do not add Virtual AGC or Luminary099 code to 0.1.x.

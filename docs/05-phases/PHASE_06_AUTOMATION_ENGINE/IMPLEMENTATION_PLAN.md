# Implementation Plan — Phase 06 — Automation Engine


1. Define flow DSL/schema and validation.
2. Define engine context, events, and action union.
3. Implement pure deterministic transition logic.
4. Add flow/version persistence.
5. Add session persistence.
6. Add runtime worker consuming normalized conversation events.
7. Add action executor using central outbound pipeline.
8. Add timer/scheduled continuation mechanism.
9. Add publish/version rules.
10. Add basic non-visual editor/configuration UI sufficient for MVP.
11. Add exhaustive engine/state tests.


## Implementation discipline

- Inspect existing code before changing it.
- Preserve architecture rules.
- Do not implement later-phase features opportunistically.
- Add tests with implementation.
- Record material deviations in `docs/IMPLEMENTATION_LOG.md`.

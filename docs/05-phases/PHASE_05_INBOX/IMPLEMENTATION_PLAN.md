# Implementation Plan — Phase 05 — Realtime Team Inbox


1. Create realtime app/gateway.
2. Define authenticated tenant-scoped realtime channels.
3. Emit conversation/message projection events.
4. Build inbox APIs/projections.
5. Build Next.js inbox UI.
6. Implement send reply via outbound message application service.
7. Add reconnect/replay/fetch recovery.
8. Add authorization/load/security tests.


## Implementation discipline

- Inspect existing code before changing it.
- Preserve architecture rules.
- Do not implement later-phase features opportunistically.
- Add tests with implementation.
- Record material deviations in `docs/IMPLEMENTATION_LOG.md`.

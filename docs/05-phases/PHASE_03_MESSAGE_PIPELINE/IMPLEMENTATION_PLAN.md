# Implementation Plan — Phase 03 — Reliable Message Pipeline


1. Add `apps/webhook-ingress`.
2. Add NATS/event contracts package.
3. Add webhook receipt persistence.
4. Verify and normalize Meta events.
5. Publish normalized inbound events.
6. Create worker application/consumer framework.
7. Implement outbound request queue and provider sender.
8. Implement status-event ingestion.
9. Implement idempotency stores/constraints.
10. Implement bounded retry and terminal failure behavior.
11. Add outbox publisher.
12. Instrument metrics/traces/logs.


## Implementation discipline

- Inspect existing code before changing it.
- Preserve architecture rules.
- Do not implement later-phase features opportunistically.
- Add tests with implementation.
- Record material deviations in `docs/IMPLEMENTATION_LOG.md`.

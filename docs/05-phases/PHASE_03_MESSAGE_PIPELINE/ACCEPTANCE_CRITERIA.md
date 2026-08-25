# Acceptance Criteria — Phase 03 — Reliable Message Pipeline


- [ ] Valid provider webhook is acknowledged quickly.
- [ ] Invalid webhook is rejected.
- [ ] Duplicate inbound event causes no duplicate business effect.
- [ ] Normalized event reaches NATS.
- [ ] Worker can consume and recover from redelivery.
- [ ] Outbound requests are queued and sent through the Meta adapter.
- [ ] Transient failures retry within policy.
- [ ] Permanent failures terminate safely.
- [ ] Status events are processed idempotently.
- [ ] Required state/event writes use reliable outbox behavior.
- [ ] Observability exposes pipeline health.
- [ ] Tests/typecheck/lint/build pass.


## Completion rule

If a mandatory checkbox is not satisfied, the phase remains incomplete unless an explicit approved exception is documented.

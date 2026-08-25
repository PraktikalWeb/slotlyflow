# Failure and Recovery

## General principle

Assume every network call, worker, process, and dependency can fail.

## Required behavior

### Duplicate webhook
Must not create duplicate messages or duplicate business side effects.

### Worker crash
Unacknowledged work is redelivered and safely reprocessed.

### NATS unavailable
Ingress/API must use defined failure behavior; durable state/event consistency must not silently diverge.

### Meta API transient error
Outbound operation uses bounded retry policy.

### Meta API permanent error
Message moves to failed state with reason/error code and no infinite retry.

### PostgreSQL unavailable
Do not accept business operations that cannot be durably persisted unless explicitly designed as safe deferred operations.

### Realtime unavailable
Core messaging continues; UI can recover state from API after reconnect.

### Valkey unavailable
Durable business correctness must continue where possible; cache/presence degradation must not corrupt authoritative state.

## Recovery

- Backups.
- PITR.
- Rebuildable projections.
- Dead-letter inspection/replay procedure.
- Idempotent replay.

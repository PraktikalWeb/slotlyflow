# Database Changes — Phase 03 — Reliable Message Pipeline


Introduce/complete:
- webhook_receipts
- outbox_events
- minimal message transport persistence needed for pipeline correctness
- idempotency keys / unique provider identifiers

Do not create duplicate durable business side effects for a repeated provider event.


## Global rules

Follow `docs/02-standards/DATABASE_STANDARDS.md` and `docs/01-architecture/MULTI_TENANCY.md`.

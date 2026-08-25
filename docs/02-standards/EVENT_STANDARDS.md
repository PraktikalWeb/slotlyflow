# Event Standards

- At-least-once delivery is assumed.
- Every event has a unique event ID.
- Consumers are idempotent.
- Event payloads are versioned.
- Tenant-scoped events include `organization_id`.
- Never publish secrets.
- Event handlers should be retry-safe.
- Side effects must use idempotency keys where duplicates would be harmful.
- Consumer failure classification must distinguish transient from terminal.
- Event names follow `EVENT_ARCHITECTURE.md`.

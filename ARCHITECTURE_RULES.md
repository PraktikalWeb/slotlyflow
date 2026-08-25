# SlotlyFlow Architecture Rules

These rules apply to every phase.

## Core rules

**AR-001 — PostgreSQL is the primary transactional source of truth.**  
Valkey, NATS, browser state, and process memory are not authoritative stores for durable business state.

**AR-002 — Tenant ownership is explicit.**  
Every tenant-owned aggregate or record must be traceable to an `organization_id`.

**AR-003 — Tenant access is verified server-side.**  
Client-provided organization identifiers are never sufficient authorization.

**AR-004 — Provider-specific types stay at the boundary.**  
Meta payloads are normalized before entering core domain/application logic.

**AR-005 — External services are accessed through adapters.**  
Examples: WhatsApp provider, object storage, secret store, email provider, payment provider, AI provider.

**AR-006 — Async processing is idempotent.**  
Every consumer must safely tolerate retries and duplicate delivery.

**AR-007 — Business logic belongs in domain/application layers.**  
Controllers, route handlers, persistence adapters, UI components, and queue handlers orchestrate but do not own core rules.

**AR-008 — Durable workflows are restart-safe.**  
A process crash, deployment, or horizontal scale event must not destroy conversation or automation state.

**AR-009 — Events are versioned contracts.**  
Published event names and payload schemas are documented and versioned.

**AR-010 — Reliable publish uses an outbox strategy where state and event consistency matter.**

**AR-011 — Security fails closed.**  
Missing context, invalid authorization, invalid signatures, or unverifiable credentials must deny processing.

**AR-012 — Sensitive credentials are never stored or logged in plaintext without an approved encrypted-at-rest design.**

**AR-013 — Least privilege applies across services, database roles, infrastructure, and user permissions.**

**AR-014 — Public APIs use explicit validation.**  
Never trust unvalidated body, query, path, header, cookie, or webhook input.

**AR-015 — Observability is structured.**  
Requests, events, and jobs use correlation identifiers and structured logs.

**AR-016 — Infrastructure is replaceable.**  
Domain/application code must not require a specific cloud vendor.

**AR-017 — Scale by component.**  
Web, API, webhook ingress, realtime, and worker workloads must remain independently scalable.

**AR-018 — No premature microservice fragmentation.**  
Use strong module boundaries first. Extract independently deployed services when operational or scaling requirements justify it.

**AR-019 — Database changes are migration-driven.**  
No manual production schema drift.

**AR-020 — Architecture changes require an ADR.**

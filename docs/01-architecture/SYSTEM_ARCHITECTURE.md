# System Architecture

## Architectural style

SlotlyFlow uses a modular, event-driven architecture with independently scalable runtime components.

Initial deployment should avoid unnecessary microservice fragmentation while preserving clear boundaries that allow later extraction.

## Runtime components

### Web
- Next.js.
- Customer-facing authenticated platform.
- Marketing site may be separate or part of the same Next.js deployment.
- Never acts as the authoritative business backend.

### Core API
- NestJS with Fastify.
- Authentication/authorization orchestration.
- Organization/business operations.
- Contacts/conversations.
- Automation configuration.
- Team management.
- Analytics queries.
- Billing/admin APIs.

### Webhook Ingress
- Dedicated stateless service.
- Receives Meta webhook traffic.
- Verifies authenticity.
- Validates payload.
- Deduplicates/enqueues.
- Acknowledges provider quickly.
- Does not run long automation logic synchronously.

### Worker
Initially one deployable worker application with isolated modules:
- inbound message processing;
- automation processing;
- outbound message processing;
- notifications;
- analytics projection;
- scheduled work.

Worker modules may later be deployed separately without changing domain contracts.

### Realtime Gateway
- Dedicated long-lived connection service.
- WebSocket and/or SSE.
- Broadcasts authorized organization-scoped updates to inbox clients.

## Infrastructure

### PostgreSQL
Primary transactional database.

### NATS JetStream
Durable asynchronous event/message transport.

### Valkey
Cache, presence, short-lived distributed coordination, rate-limit state, and other ephemeral data.

### S3-compatible object storage
Media and file objects.

## Core flow

Meta -> Webhook Ingress -> NATS -> Worker -> PostgreSQL / Automation -> NATS -> Outbound Worker -> Meta

For realtime:
Worker/API -> event -> Realtime Gateway -> authorized browser clients.

## Scale boundaries

Scale independently:
- web;
- API;
- webhook ingress;
- realtime;
- worker groups.

No component may require sticky in-process durable state.

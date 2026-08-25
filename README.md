# SlotlyFlow

SlotlyFlow is a secure, multi-tenant WhatsApp automation and customer conversation platform for businesses.

The product goal is to let a non-technical business owner connect WhatsApp Business, configure automation, hand conversations to human agents, and operate from a single web platform without exposing Meta API complexity.

## Architectural priorities

1. Security by default.
2. Strong tenant isolation.
3. Horizontal scalability.
4. No hard dependency on proprietary infrastructure platforms.
5. Maintainable TypeScript code with explicit domain boundaries.
6. Reliable asynchronous message processing.
7. Clear provider abstractions.
8. Incremental delivery by phase.
9. No speculative implementation outside approved scope.
10. Every phase must satisfy its acceptance criteria before the next phase begins.

## Planned stack

- TypeScript
- pnpm workspaces
- Turborepo
- Next.js web application
- NestJS + Fastify API
- PostgreSQL
- Drizzle ORM
- NATS JetStream
- Valkey
- S3-compatible object storage
- OpenTelemetry
- Prometheus
- Grafana
- Loki
- Tempo
- Docker / OCI containers
- Kubernetes-ready deployment
- OpenTofu or Terraform
- GitHub Actions

## Documentation authority

Read `AGENTS.md` before making any change.

Architecture invariants are defined in `ARCHITECTURE_RULES.md`.

Current delivery scope is defined in `docs/05-phases/STATUS.md`.

# Requirements — Phase 01 — Platform Foundation


- Monorepo with `apps/web` and `apps/api` plus shared packages required by this phase.
- Next.js authenticated web shell.
- NestJS + Fastify API.
- PostgreSQL and Drizzle migration system.
- User registration with email/password.
- Email verification workflow interface and persistence.
- Login/logout.
- Password recovery.
- Revocable server-side sessions.
- Organization creation.
- Organization membership.
- OWNER, ADMIN, AGENT roles.
- Permission-based authorization.
- Protected `/app` area.
- Audit logging for authentication and membership/role-sensitive actions.
- Request/correlation IDs.
- Health/readiness endpoints.
- Docker-based local infrastructure definition.
- CI commands/scripts for lint, typecheck, test, and production build.

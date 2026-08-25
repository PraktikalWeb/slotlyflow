# Implementation Plan — Phase 01 — Platform Foundation


1. Bootstrap pnpm/Turborepo workspace.
2. Create `apps/web` and `apps/api`.
3. Create shared `packages/config`, `packages/contracts`, `packages/database`, `packages/auth`, `packages/security`, `packages/testing`.
4. Configure strict TypeScript and linting.
5. Add startup configuration validation using environment variable names only.
6. Configure PostgreSQL/Drizzle.
7. Implement initial migrations.
8. Implement User, Organization, OrganizationMembership and Session domain/application modules.
9. Implement password hashing behind an auth service.
10. Implement registration, verification, login, logout, password recovery, session revocation.
11. Implement organization creation and membership resolution.
12. Implement permission checks and protected API routes.
13. Implement audit log service.
14. Implement protected Next.js shell and auth pages.
15. Add health/readiness endpoints.
16. Add unit/integration/security tests.
17. Add CI workflow.


## Implementation discipline

- Inspect existing code before changing it.
- Preserve architecture rules.
- Do not implement later-phase features opportunistically.
- Add tests with implementation.
- Record material deviations in `docs/IMPLEMENTATION_LOG.md`.

# AGENTS.md

This repository is governed by explicit product, architecture, security, and phase specifications.

## Mandatory operating procedure

Before modifying code:

1. Read this file.
2. Read `README.md`.
3. Read `ARCHITECTURE_RULES.md`.
4. Read:
   - `docs/00-product/PRODUCT_VISION.md`
   - `docs/00-product/MVP_SCOPE.md`
   - `docs/00-product/GLOSSARY.md`
   - `docs/01-architecture/SYSTEM_ARCHITECTURE.md`
   - `docs/01-architecture/SECURITY_ARCHITECTURE.md`
   - `docs/01-architecture/MULTI_TENANCY.md`
   - `docs/02-standards/ENGINEERING_STANDARDS.md`
   - `docs/02-standards/SECURITY_STANDARDS.md`
5. Read every file in the active phase directory under `docs/05-phases/`.
6. Inspect the existing implementation before planning changes.
7. Implement only the active phase.
8. Run all required verification commands.
9. Compare the result against the phase acceptance criteria.
10. Update `docs/05-phases/STATUS.md` and `docs/IMPLEMENTATION_LOG.md`.

## Non-negotiable rules

- Do not invent product requirements.
- Do not silently resolve conflicting specifications.
- Do not implement future phases early.
- Do not change accepted architecture without an ADR.
- Do not introduce a vendor-specific dependency into domain logic.
- Do not place business logic in controllers, route handlers, React components, or transport adapters.
- Do not use process memory as the durable source of truth for business state.
- Do not bypass organization/tenant scoping.
- Do not trust a client-supplied `organization_id` without authorization.
- Do not access tenant-owned rows without verified organization context.
- Do not log passwords, session tokens, Meta access tokens, encryption keys, secrets, or raw credential material.
- Do not commit secrets.
- Do not create, populate, guess, or modify environment variable values. Only required environment variable names and validation rules may be added to code or documentation.
- Do not add a dependency unless the existing stack cannot reasonably satisfy the requirement.
- Do not call Meta directly from arbitrary modules. Use the defined provider adapter and outbound messaging path.
- All webhook/event consumers must be idempotent.
- All externally visible state transitions must be validated.
- Security checks fail closed.
- All migrations must be reviewable and reproducible from a clean database.
- Any breaking API or event contract requires an explicit versioning/migration decision.

## Ambiguity policy

If implementation is blocked by a genuine contradiction or missing requirement that materially affects security, data integrity, public API behavior, or architecture:

1. Do not guess.
2. Record the ambiguity in `docs/IMPLEMENTATION_LOG.md`.
3. Stop only the affected work.
4. Continue unrelated work that remains fully specified.

## Definition of done

A task is not complete because code compiles.

It is complete only when:
- required functionality is implemented;
- relevant tests pass;
- typecheck passes;
- lint passes;
- production build passes;
- security requirements are satisfied;
- tenant-isolation tests pass where applicable;
- no out-of-scope feature was added;
- documentation/status files are updated.

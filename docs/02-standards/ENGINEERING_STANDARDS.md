# Engineering Standards

## Language

TypeScript with strict compiler settings.

Avoid `any` except at unavoidable external boundaries and narrow immediately.

## Architecture

Use:
- domain layer;
- application/use-case layer;
- infrastructure adapters;
- transport/UI layer.

Dependency direction points inward toward domain/application contracts.

## Functions/modules

- Prefer small cohesive modules.
- Avoid god services.
- Avoid generic `utils` dumping grounds.
- Name modules by domain responsibility.
- Keep side effects explicit.

## Error handling

Use typed/domain error categories. Do not expose internal stack traces to clients.

## Configuration

- Validate required environment variable names at startup.
- Never provide actual environment secret values in repository documentation.
- Coding agents must not create, populate, guess, or modify environment values.

## Dependencies

Before adding a package:
1. verify existing stack cannot solve requirement cleanly;
2. prefer maintained, broadly adopted packages;
3. avoid proprietary SDK coupling in domain code;
4. document materially architectural dependencies.

## Code review priorities

1. security;
2. tenant isolation;
3. correctness/idempotency;
4. data integrity;
5. maintainability;
6. performance;
7. style.

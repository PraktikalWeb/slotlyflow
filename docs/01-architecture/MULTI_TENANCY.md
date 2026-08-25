# Multi-Tenancy

## Tenant unit

`Organization`.

## Fundamental rule

No tenant-owned read or write may occur without verified organization context.

## Request resolution

1. Authenticate user.
2. Resolve requested/current organization.
3. Verify active membership.
4. Resolve role/permissions.
5. Create server-side organization context.
6. Execute tenant-scoped operation.

Never trust `organization_id` from client input as authorization.

## Persistence

Tenant-aware repositories accept organization context explicitly.

Example conceptual signature:

`findConversation(context.organizationId, conversationId)`

not:

`findConversation(conversationId)`

for tenant-owned data.

## Defense in depth

Use:
- application authorization;
- tenant-aware repository APIs;
- foreign keys and constraints;
- carefully selected PostgreSQL RLS where useful;
- automated cross-tenant tests;
- audit logging for sensitive operations.

## Cross-tenant behavior

Unauthorized access to another tenant must return the platform-defined non-disclosing response and no foreign data.

Choose 403 versus 404 once in API standards and apply consistently.

## Background jobs

Every tenant-scoped job/event carries organization identity and validates it before side effects.

## Platform super-admin

Internal super-admin access must not bypass logging. Privileged support access must be explicit and auditable.

# Security Architecture

Security is a first-class architectural requirement.

## Security objectives

- Confidentiality of business/customer data.
- Strong tenant isolation.
- Integrity of messages and automation state.
- Availability under malformed/hostile traffic.
- Auditable privileged activity.
- Secure credential handling.
- Recoverable infrastructure and data.

## Authentication

- Secure session-based authentication for the web platform.
- Password hashing using a modern memory-hard algorithm approved by the implementation plan.
- Email verification.
- Password reset with short-lived single-use tokens.
- Session revocation.
- MFA-ready architecture.
- Authentication endpoints rate-limited.
- Generic authentication errors to reduce account enumeration.
- Email-verification delivery uses a SlotlyFlow-owned provider boundary. Tokens are passed only to the selected delivery adapter, stored hashed at rest, and never returned by public APIs or written to logs/audit metadata.

## Sessions

Production browser sessions:
- Secure;
- HttpOnly;
- SameSite policy explicitly chosen;
- bounded lifetime;
- revocable server-side;
- rotated after privilege-sensitive authentication events.

## Authorization

- Server-side RBAC.
- Organization membership validation.
- Least privilege.
- Deny by default.
- Security-sensitive actions re-check authorization at execution time.

## Webhooks

- Verify Meta signature/authenticity according to current provider specification.
- Validate request body/schema.
- Deduplicate provider events.
- Apply payload size/time limits.
- Never execute long-running automation directly in request lifecycle.
- Reject unverifiable events.

## Credentials

- Provider access tokens and secrets encrypted at rest using a secret/credential abstraction.
- Never log credential values.
- Never return credentials to browser APIs unless specifically required by protocol and approved.
- Support rotation.

## Transport

- TLS for all externally exposed services.
- Encrypted database/cache/message-bus connections where the deployment network model requires it.
- Internal trust is not sufficient authorization.

## Application protections

- Strict input validation.
- Parameterized database access.
- CSRF protection where cookie-based state-changing browser requests require it.
- XSS mitigation.
- Strict CORS.
- Security headers.
- Request rate limiting.
- File/media validation.
- No arbitrary code execution.

## Logging

Do not log:
- passwords;
- reset tokens;
- session tokens;
- access tokens;
- API secrets;
- encryption keys;
- raw credential material.

## Backups

- Automated PostgreSQL backups.
- Point-in-time recovery.
- Restoration procedure tested periodically.
- Object storage durability policy documented.

## Security testing

Mandatory:
- authentication abuse tests;
- authorization tests;
- cross-tenant access tests;
- webhook signature tests;
- duplicate-event tests;
- input validation tests;
- dependency/vulnerability scanning in CI where feasible.

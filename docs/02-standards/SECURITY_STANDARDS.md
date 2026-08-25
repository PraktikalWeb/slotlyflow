# Security Standards

- Deny by default.
- Validate all untrusted input.
- Authenticate before tenant resolution.
- Authorize before business action.
- Use least privilege.
- Keep credentials encrypted and out of logs.
- Rate-limit authentication and abuse-sensitive endpoints.
- Verify provider webhook authenticity.
- Use secure browser cookie attributes.
- Prevent CSRF where relevant.
- Prevent XSS through framework-safe rendering and sanitization where rich content is allowed.
- Prevent SQL injection through parameterized ORM/query APIs.
- Do not expose internal identifiers unnecessarily.
- Use security-focused regression tests.
- Production databases, NATS, Valkey, and internal admin surfaces must not be publicly exposed without explicit security design.

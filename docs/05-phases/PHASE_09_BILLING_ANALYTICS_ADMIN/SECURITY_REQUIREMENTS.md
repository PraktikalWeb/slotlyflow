# Security Requirements — Phase 09 — Billing, Analytics and Platform Admin


- Billing/admin actions require dedicated permissions.
- Platform super-admin is not equivalent to organization OWNER.
- Privileged access is audited.
- No generic unrestricted SQL/admin endpoint.
- Support impersonation, if ever introduced, requires a separate explicit design; do not invent it.
- Payment credentials/webhook secrets follow credential standards.


## Gate

A security requirement is not optional merely because functional tests pass.

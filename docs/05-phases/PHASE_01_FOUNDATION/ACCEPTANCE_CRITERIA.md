# Acceptance Criteria — Phase 01 — Platform Foundation


- [ ] Clean install/bootstrap succeeds.
- [ ] Database migrates from empty state.
- [ ] User can register.
- [ ] User can verify email.
- [ ] User can log in and log out.
- [ ] User can recover password.
- [ ] Sessions can be revoked and expired sessions are rejected.
- [ ] User can create an organization.
- [ ] Membership is created correctly.
- [ ] OWNER, ADMIN and AGENT permissions match documented policy.
- [ ] Protected app routes require authentication.
- [ ] Tenant-owned APIs require valid membership.
- [ ] Cross-tenant access tests prove no foreign data leakage.
- [ ] Defined security-sensitive actions create audit records.
- [ ] Auth abuse endpoints are rate-limited.
- [ ] No secrets are committed or generated.
- [ ] Lint passes.
- [ ] Typecheck passes.
- [ ] Tests pass.
- [ ] Production builds pass.
- [ ] No Phase 02+ functionality is implemented.


## Completion rule

If a mandatory checkbox is not satisfied, the phase remains incomplete unless an explicit approved exception is documented.

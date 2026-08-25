# Test Plan — Phase 01 — Platform Foundation

Required coverage includes:


- registration success/failure;
- duplicate normalized email;
- email verification valid/expired/reused;
- login valid/invalid;
- password reset valid/expired/reused;
- logout/session revocation;
- expired/revoked session denial;
- organization creation;
- role permission matrix;
- cross-tenant read/write attempts;
- owner-protection rules;
- audit events emitted;
- migration from clean DB;
- health/readiness;
- lint;
- typecheck;
- production build.


## Verification

At phase completion run:
- lint;
- typecheck;
- unit tests;
- integration/security tests relevant to this phase;
- production builds.

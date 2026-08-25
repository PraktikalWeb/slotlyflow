# Test Plan — Phase 05 — Realtime Team Inbox

Required coverage includes:


- realtime auth;
- cross-tenant subscription attempt;
- message arrival updates correct clients;
- reconnect fetches missed state;
- authorized reply;
- unauthorized reply;
- duplicate client retries do not duplicate sends when idempotency applies;
- mobile/responsive core flow smoke tests.


## Verification

At phase completion run:
- lint;
- typecheck;
- unit tests;
- integration/security tests relevant to this phase;
- production builds.

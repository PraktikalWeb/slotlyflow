# Test Plan — Phase 06 — Automation Engine

Required coverage includes:


- every node/step type;
- invalid flow rejection;
- branching;
- variables;
- timeout;
- fallback;
- restart-safe session continuation;
- duplicate inbound event;
- immutable published version;
- old-session/new-version behavior;
- cross-tenant flow/session access;
- malicious/untrusted flow content.


## Verification

At phase completion run:
- lint;
- typecheck;
- unit tests;
- integration/security tests relevant to this phase;
- production builds.

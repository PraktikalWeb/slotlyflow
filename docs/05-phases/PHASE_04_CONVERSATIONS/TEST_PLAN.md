# Test Plan — Phase 04 — Contacts and Conversations

Required coverage includes:


- inbound creates/resolves contact;
- conversation create/reuse policy;
- message persistence;
- provider duplicate message;
- message status progression;
- pagination;
- unread state;
- cross-tenant contact/conversation/message probes;
- high-volume query shape/index checks as practical.


## Verification

At phase completion run:
- lint;
- typecheck;
- unit tests;
- integration/security tests relevant to this phase;
- production builds.

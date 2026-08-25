# Test Plan — Phase 03 — Reliable Message Pipeline

Required coverage includes:


- valid webhook;
- invalid signature;
- malformed payload;
- duplicate webhook;
- worker retry after crash;
- outbound transient retry;
- outbound permanent failure;
- provider status update;
- outbox publish retry;
- correlation propagation;
- no duplicate send under redelivery.


## Verification

At phase completion run:
- lint;
- typecheck;
- unit tests;
- integration/security tests relevant to this phase;
- production builds.

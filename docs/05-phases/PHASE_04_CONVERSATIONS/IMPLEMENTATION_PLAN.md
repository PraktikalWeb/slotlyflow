# Implementation Plan — Phase 04 — Contacts and Conversations


1. Finalize contact identity rules.
2. Add schemas/indexes.
3. Implement repositories/use cases.
4. Connect inbound pipeline to contact/conversation/message persistence.
5. Connect outbound pipeline to message lifecycle persistence.
6. Add list/detail APIs.
7. Add unread/read operations.
8. Add tenant isolation and high-volume query tests.


## Implementation discipline

- Inspect existing code before changing it.
- Preserve architecture rules.
- Do not implement later-phase features opportunistically.
- Add tests with implementation.
- Record material deviations in `docs/IMPLEMENTATION_LOG.md`.

# Implementation Plan — Phase 02 — WhatsApp Connection


1. Finalize provider abstraction.
2. Add WhatsApp account/phone schemas.
3. Add encrypted credential reference/storage adapter.
4. Implement Meta onboarding callback/exchange flow based on verified current Meta documentation.
5. Persist provider IDs separately from internal IDs.
6. Implement connection status checks.
7. Add organization-scoped WhatsApp settings UI.
8. Add audit events for connect/disconnect/credential rotation.
9. Add tests using provider mocks/sandbox strategy.


## Implementation discipline

- Inspect existing code before changing it.
- Preserve architecture rules.
- Do not implement later-phase features opportunistically.
- Add tests with implementation.
- Record material deviations in `docs/IMPLEMENTATION_LOG.md`.

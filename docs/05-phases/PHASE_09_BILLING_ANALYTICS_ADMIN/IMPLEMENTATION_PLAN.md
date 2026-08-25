# Implementation Plan — Phase 09 — Billing, Analytics and Platform Admin


1. Define usage events and billing invariants.
2. Add subscription/usage schemas.
3. Add payment provider adapter boundary.
4. Build usage projections.
5. Build basic organization analytics.
6. Create separately authorized internal admin surface.
7. Add operational health/error views.
8. Add privileged-action audits.
9. Add security tests for platform admin separation.


## Implementation discipline

- Inspect existing code before changing it.
- Preserve architecture rules.
- Do not implement later-phase features opportunistically.
- Add tests with implementation.
- Record material deviations in `docs/IMPLEMENTATION_LOG.md`.

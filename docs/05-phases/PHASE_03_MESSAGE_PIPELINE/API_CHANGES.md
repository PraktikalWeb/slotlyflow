# API Changes — Phase 03 — Reliable Message Pipeline


Webhook endpoint(s) are provider-facing, not ordinary customer APIs.

Any internal outbound test endpoint must be explicitly development/admin-scoped and not become a permanent insecure public interface.


## Global rules

Follow `docs/02-standards/API_STANDARDS.md`.
All request/response schemas must be explicitly validated.

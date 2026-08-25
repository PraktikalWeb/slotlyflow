# API Changes — Phase 02 — WhatsApp Connection


Introduce organization-scoped endpoints for:
- begin connection;
- complete connection callback;
- get connection status;
- list connected phone numbers;
- disconnect/revoke where supported.

Exact provider callback mechanics must follow current Meta documentation verified during implementation.


## Global rules

Follow `docs/02-standards/API_STANDARDS.md`.
All request/response schemas must be explicitly validated.

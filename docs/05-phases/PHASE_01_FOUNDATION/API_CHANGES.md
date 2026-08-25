# API Changes — Phase 01 — Platform Foundation


- `POST /v1/auth/register`
- `POST /v1/auth/verify-email`
- `POST /v1/auth/login`
- `POST /v1/auth/logout`
- `POST /v1/auth/password/forgot`
- `POST /v1/auth/password/reset`
- `GET /v1/me`
- `POST /v1/organizations`
- `GET /v1/organizations`
- `GET /v1/organizations/:organizationId`
- membership endpoints only to the extent required for invite/list/role/remove in this phase
- `GET /health`
- `GET /ready`

All authenticated organization routes must resolve membership server-side.
Cross-tenant resource probes return 404 according to API standards.


## Global rules

Follow `docs/02-standards/API_STANDARDS.md`.
All request/response schemas must be explicitly validated.

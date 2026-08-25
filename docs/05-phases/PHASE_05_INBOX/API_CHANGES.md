# API Changes — Phase 05 — Realtime Team Inbox


- conversation list/detail APIs from Phase 04;
- agent reply endpoint;
- read/unread update endpoint;
- realtime authentication/subscription mechanism.

Agent reply must never call Meta directly from the web app.


## Global rules

Follow `docs/02-standards/API_STANDARDS.md`.
All request/response schemas must be explicitly validated.

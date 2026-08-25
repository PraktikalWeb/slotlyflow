# Database Changes — Phase 04 — Contacts and Conversations


Introduce:
- contacts
- conversations
- messages
- message_status_events
- conversation_participants if needed by approved model

Indexes must support:
- `(organization_id, conversation_id, created_at)`
- provider message uniqueness
- conversation list by organization/update time
- unread/query paths

Exact indexes should be validated against implemented queries.


## Global rules

Follow `docs/02-standards/DATABASE_STANDARDS.md` and `docs/01-architecture/MULTI_TENANCY.md`.

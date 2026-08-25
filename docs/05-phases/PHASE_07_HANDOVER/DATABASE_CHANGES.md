# Database Changes — Phase 07 — Human Handover


Introduce:
- handoffs
- agent_assignments

Include:
- organization_id
- conversation_id
- status
- requested_at
- accepted_at
- completed_at
- accepted_by/assigned user where applicable
- automation pause/resume metadata required by runtime


## Global rules

Follow `docs/02-standards/DATABASE_STANDARDS.md` and `docs/01-architecture/MULTI_TENANCY.md`.

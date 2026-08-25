# Database Changes — Phase 05 — Realtime Team Inbox


Use Phase 04 entities.

Add only inbox-specific persisted state that is genuinely durable, such as user read markers/assignments if required by approved design.

Do not persist ephemeral socket presence as authoritative business state.


## Global rules

Follow `docs/02-standards/DATABASE_STANDARDS.md` and `docs/01-architecture/MULTI_TENANCY.md`.

# Database Changes — Phase 02 — WhatsApp Connection


Introduce:
- whatsapp_accounts
- whatsapp_phone_numbers
- provider_credentials or credential references
- connection/audit metadata

All records that belong to a customer organization must be organization-scoped.

Do not store reusable provider access tokens in plaintext columns.


## Global rules

Follow `docs/02-standards/DATABASE_STANDARDS.md` and `docs/01-architecture/MULTI_TENANCY.md`.

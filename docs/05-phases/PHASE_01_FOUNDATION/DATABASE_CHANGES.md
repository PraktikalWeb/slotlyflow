# Database Changes — Phase 01 — Platform Foundation


### users
- id uuid PK
- email normalized unique not null
- password_hash not null
- email_verified_at timestamptz null
- created_at timestamptz not null
- updated_at timestamptz not null

### organizations
- id uuid PK
- name not null
- slug unique not null
- created_at timestamptz not null
- updated_at timestamptz not null

### organization_members
- organization_id uuid FK not null
- user_id uuid FK not null
- role enum/string constrained to OWNER|ADMIN|AGENT
- status constrained active/invited/disabled as implementation requires
- created_at timestamptz not null
- updated_at timestamptz not null
- unique `(organization_id, user_id)`

### sessions
- id opaque/uuid PK
- user_id FK
- token_hash or equivalent server-side verifier; never plaintext reusable session secret
- expires_at
- revoked_at nullable
- created_at
- last_used_at where needed

### email_verification_tokens
Single-use, hashed-at-rest token representation with expiry.

### password_reset_tokens
Single-use, hashed-at-rest token representation with expiry.

### audit_logs
- id
- organization_id nullable for pre-organization/global auth events
- actor_user_id nullable where system
- action
- target_type
- target_id nullable
- metadata safe JSON
- created_at


## Global rules

Follow `docs/02-standards/DATABASE_STANDARDS.md` and `docs/01-architecture/MULTI_TENANCY.md`.

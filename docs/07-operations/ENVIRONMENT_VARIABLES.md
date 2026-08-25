# Environment Variable Names

This file documents names and purposes only.

Actual values are supplied manually/outside source control.

## Rules

- Never commit `.env` secrets.
- Provide `.env.example` with variable names and safe placeholders only when implementation requires it.
- Codex must never invent, create, populate, or modify actual environment values.
- Validate required variables at startup.

## Planned categories

- application runtime
- database
- session/auth
- email transport
- NATS
- Valkey
- object storage
- Meta WhatsApp
- credential encryption/secret store
- observability

Exact variable names are introduced by the phase that actually uses them.

## Phase 01B database

- `SLOTLYFLOW_POSTGRES_DB`: PostgreSQL database name used by local SlotlyFlow Compose infrastructure.
- `SLOTLYFLOW_POSTGRES_USER`: PostgreSQL user used by local SlotlyFlow Compose infrastructure.
- `SLOTLYFLOW_POSTGRES_PASSWORD`: PostgreSQL password used by local SlotlyFlow Compose infrastructure.
- `DATABASE_URL`: application PostgreSQL connection URL. For local SlotlyFlow Compose infrastructure, it must correspond to the manually supplied SlotlyFlow PostgreSQL credentials and host port `5433`.
- `DATABASE_POOL_MAX`: optional maximum number of pooled PostgreSQL connections.

## Phase 01C API and Google OIDC

These server-only names belong in the repository-root `.env.local` for local development:

- `HOST`: API bind host; local development uses `127.0.0.1`.
- `PORT`: API port; local development uses `3001`.
- `CORS_ORIGINS`: comma-separated browser-origin allow-list; local development uses exactly `http://localhost:3000`.
- `GOOGLE_OIDC_CLIENT_ID`: manually supplied Google OAuth web-client identifier.
- `GOOGLE_OIDC_CLIENT_SECRET`: manually supplied Google OAuth client secret.
- `GOOGLE_OIDC_REDIRECT_URI`: exact Google callback; local development uses `http://localhost:3001/auth/google/callback`.
- `WEB_APP_URL`: fixed post-authentication web destination; local development uses `http://localhost:3000`.

The four Google OIDC values are required together. Server secrets must never appear in a web environment file.

## Phase 01C-D authentication UI

- `NEXT_PUBLIC_API_BASE_URL`: required browser-visible base URL for the SlotlyFlow API. It belongs in `apps/web/.env.local`; local development uses `http://localhost:3001`. Missing or malformed configuration fails startup/build rather than falling back to same-origin `/auth/*` routes. It must correspond to an explicitly allowed `CORS_ORIGINS` entry so the API can set and receive its session and CSRF cookies.

## Phase 01C verification-email delivery prerequisite

These server-only names belong in the repository-root `.env.local` when email delivery is enabled:

- `EMAIL_PROVIDER`: supported value is `smtp`; `disabled` is permitted only outside production.
- `SMTP_HOST`: provider-neutral SMTP host; local Mailpit uses `127.0.0.1`.
- `SMTP_PORT`: SMTP port; local Mailpit uses `1025`.
- `SMTP_SECURE`: `true` or `false`; local Mailpit uses `false`.
- `SMTP_USER` and `SMTP_PASSWORD`: optional SMTP credentials; they must be supplied together when used.
- `EMAIL_FROM_ADDRESS`: sender address used for SlotlyFlow transactional email.
- `EMAIL_FROM_NAME`: sender display name.

When `EMAIL_PROVIDER=smtp`, `WEB_APP_URL` is also required and is used only to construct the user-facing `/verify-email?token=...` link. Mailpit’s web inbox is available locally at `http://localhost:8025`; it requires no SMTP credentials.

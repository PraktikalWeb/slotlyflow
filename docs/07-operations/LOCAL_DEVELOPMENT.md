# Local Development

## Goal

A developer should be able to run required local dependencies reproducibly.

## Expected local infrastructure

As phases require them:
- PostgreSQL;
- Mailpit for local transactional-email capture;
- NATS JetStream;
- Valkey;
- S3-compatible local object storage if media is introduced.

Use Docker Compose or an equivalent open container workflow.

## Local application configuration

SlotlyFlow keeps server and browser configuration separate:

- repository-root `.env.local`: server-only API, database tooling, Google OIDC, and optional Compose configuration;
- `apps/web/.env.local`: browser-visible Next.js configuration only.

Both local files are ignored by Git. Their committed `.env.example` counterparts contain only variable names, placeholders, and safe localhost defaults. Never place `DATABASE_URL`, database credentials, or Google client secrets in `apps/web/.env.local` because every `NEXT_PUBLIC_*` value is browser-visible.

For a new checkout, create the local files from their templates and then manually replace the server placeholders:

```powershell
Copy-Item .env.example .env.local
Copy-Item apps/web/.env.example apps/web/.env.local
```

Required root `.env.local` values:

- `DATABASE_URL` (manually supplied, including the real local SlotlyFlow database credentials);
- `GOOGLE_OIDC_CLIENT_ID` (manually supplied);
- `GOOGLE_OIDC_CLIENT_SECRET` (manually supplied);
- `GOOGLE_OIDC_REDIRECT_URI=http://localhost:3001/auth/google/callback`;
- `WEB_APP_URL=http://localhost:3000`;
- `CORS_ORIGINS=http://localhost:3000`;
- `HOST=127.0.0.1`;
- `PORT=3001`.
- `EMAIL_PROVIDER=smtp`;
- `SMTP_HOST=127.0.0.1`;
- `SMTP_PORT=1025`;
- `SMTP_SECURE=false`;
- `EMAIL_FROM_ADDRESS` (a safe local sender address);
- `EMAIL_FROM_NAME=SlotlyFlow`.

Required `apps/web/.env.local` value:

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`.

The API development and database-migration commands load the root `.env.local` through Node's native environment-file support. Next.js loads `apps/web/.env.local` natively. Values already supplied by the launching process retain precedence. No `dotenv` package is required.

## Application startup

Start both applications from the repository root:

```powershell
pnpm dev
```

The local port contract is fixed:

- web: `http://localhost:3000`;
- API: `http://localhost:3001`.

The web development command explicitly binds port `3000`. If another process owns that port, Next.js must fail with a visible address-in-use error instead of silently moving to the API port. The API defaults to port `3001` and the local root environment file states that port explicitly. Do not terminate an unknown port owner automatically.

## PostgreSQL

SlotlyFlow PostgreSQL runs in the container on port `5432` and is published only to `localhost` on host port `5433`.

- SlotlyFlow PostgreSQL host: `localhost`
- SlotlyFlow PostgreSQL host port: `5433`
- Container PostgreSQL port: `5432`

The Compose configuration requires `SLOTLYFLOW_POSTGRES_DB`, `SLOTLYFLOW_POSTGRES_USER`, and `SLOTLYFLOW_POSTGRES_PASSWORD`. Supply them outside source control before starting the service. The application `DATABASE_URL` must use the manually supplied SlotlyFlow PostgreSQL credentials and host port `5433`.

When the root `.env.local` contains the manually supplied Compose variables, the local service can be managed explicitly with:

```powershell
docker compose --env-file .env.local -f .\infrastructure\docker\compose.yaml up -d
```

This command targets the Compose project named `slotlyflow` and does not use or alter the unrelated PostgreSQL service on host port `5432`.

## Local verification email

Mailpit is an isolated SlotlyFlow Compose service. It accepts SMTP only on `127.0.0.1:1025` and exposes its local inbox at `http://localhost:8025`.

With the safe Mailpit defaults in the root `.env.local`, create a local email/password account, open Mailpit, and use the received verification link. The link targets `WEB_APP_URL/verify-email?token=...`; the future Verify Email UI consumes that token through the API. Mailpit is a development sink, not a production email provider.

## Local Google OIDC route

The local browser flow is:

```text
http://localhost:3000/sign-in
  -> http://localhost:3001/auth/google
  -> Google
  -> http://localhost:3001/auth/google/callback
  -> http://localhost:3000
```

Missing or malformed `NEXT_PUBLIC_API_BASE_URL` now fails Next.js configuration clearly. It never silently falls back to a same-origin Next.js `/auth/google` route.

`localhost:3000` and `localhost:3001` have different origins but the same hostname and site. Browser API calls include credentials, the API allows credentials only for the configured `CORS_ORIGINS` allow-list, and the local `SameSite=Lax` cookies remain compatible across these two localhost ports. Production still requires secure cookies.

## Secrets

Documentation may list required environment variable names but must never provide real production values.

Codex must not create or populate environment values for the user.

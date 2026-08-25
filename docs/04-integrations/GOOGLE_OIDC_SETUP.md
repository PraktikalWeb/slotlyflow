# Google OIDC setup

SlotlyFlow uses Google only as an authentication provider. Google access tokens, refresh tokens, authorization codes, ID tokens, client secrets, PKCE verifiers, nonces, and raw authorization states are never persisted or logged for this authentication flow.

## Manual Google Cloud configuration

1. Select or create the intended Google Cloud project.
2. Configure the OAuth consent screen for the intended audience.
3. Create an OAuth 2.0 **Web application** client.
4. Add the exact SlotlyFlow callback URL as an authorized redirect URI. It must match `GOOGLE_OIDC_REDIRECT_URI` exactly, including scheme, host, port, and path.
5. Supply these environment variables through the approved deployment or local-development secret mechanism:

   - `GOOGLE_OIDC_CLIENT_ID`
   - `GOOGLE_OIDC_CLIENT_SECRET`
   - `GOOGLE_OIDC_REDIRECT_URI`
   - `WEB_APP_URL`

All four variables are required together when Google OIDC is enabled. `GOOGLE_OIDC_REDIRECT_URI` and `WEB_APP_URL` must be absolute HTTP(S) URLs. Actual credentials never belong in the repository.

## Local development configuration

For local development, keep the Google variables in the ignored repository-root `.env.local`. Enter the client ID and client secret manually; never place either value in `apps/web/.env.local`.

Use these Google Cloud development settings exactly:

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3001/auth/google/callback`

The non-secret local routing values are:

- `GOOGLE_OIDC_REDIRECT_URI=http://localhost:3001/auth/google/callback`
- `WEB_APP_URL=http://localhost:3000`
- API `CORS_ORIGINS=http://localhost:3000`
- web `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`

The API and database tooling load server configuration from the root `.env.local`; Next.js loads browser-visible configuration from `apps/web/.env.local`. The sign-in action therefore begins at `http://localhost:3001/auth/google`, not at a same-origin Next.js route.

## Flow and security boundaries

`GET /auth/google` starts a standards-based authorization-code flow with a durable, short-lived PostgreSQL state record, OpenID Connect nonce, and PKCE S256 challenge. The callback uses the validated OAuth state, nonce, PKCE verifier, and configured exact redirect URI as its CSRF protection boundary; it does not use the normal double-submit CSRF header intended for same-origin browser API requests.

The raw nonce and PKCE verifier exist only in short-lived HttpOnly cookies scoped to `/auth/google/callback`; PostgreSQL retains only their hashes. A callback consumes its state exactly once before identity resolution, so replay fails closed. After a successfully validated provider response, SlotlyFlow issues the normal SlotlyFlow session cookie and redirects only to the configured `WEB_APP_URL`; caller-controlled redirect destinations are never accepted.

Google identifies accounts by its stable `sub` claim, never by email. A first-time Google identity may link to an existing local account only when Google reports the email verified and the local account already has the same normalized email verified. An unverified local account is not linked automatically and requires a future explicit linking flow.

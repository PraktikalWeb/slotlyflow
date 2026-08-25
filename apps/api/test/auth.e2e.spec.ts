import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { loadApiConfig, loadAuthenticationConfig, loadDatabaseConfig } from '@slotlyflow/config';
import {
  auditLogs,
  authenticationIdentities,
  createDatabaseConnection,
  emailVerificationTokens,
  oauthAuthorizationStates,
  passwordResetTokens,
  sessions,
  users,
} from '@slotlyflow/database';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { AuthRateLimiter } from '../src/auth/rate-limiter.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import type { ExternalIdentity, OidcIdentityProvider } from '../src/auth/oidc/oidc-identity-provider.js';
import type { EmailProvider, VerificationEmailMessage } from '../src/email/email-provider.js';
import { createApplication } from '../src/application.js';

const databaseUrl = process.env.DATABASE_URL;
const databaseName = databaseUrl === undefined ? '' : new URL(databaseUrl).pathname.replace(/^\//, '');
const describeDatabase = databaseUrl !== undefined && databaseName.endsWith('_test') ? describe : describe.skip;
const password = 'correct horse battery staple';
const tokenHash = (value: string): string => createHash('sha256').update(value).digest('base64url');

describeDatabase('authentication HTTP lifecycle', () => {
  let application: NestFastifyApplication;
  let database: ReturnType<typeof createDatabaseConnection>;
  const createdEmails = new Set<string>();
  const authConfig = {
    ...loadAuthenticationConfig(),
    email: {
      provider: 'smtp' as const,
      webAppUrl: 'http://localhost:3000/',
      from: { address: 'no-reply@slotlyflow.local', name: 'SlotlyFlow' },
      smtp: { host: '127.0.0.1', port: 1025, secure: false },
    },
    googleOidc: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3001/auth/google/callback',
      webAppUrl: 'http://localhost:3000/',
    },
  };
  const deliveredMessages: VerificationEmailMessage[] = [];
  let emailProviderAvailable = true;
  let emailDeliveryFails = false;
  const emailProvider: EmailProvider = {
    async assertAvailable() { if (!emailProviderAvailable) throw new Error('mailpit unavailable'); },
    async sendVerificationEmail(message) {
      if (emailDeliveryFails) throw new Error('SMTP send failed');
      deliveredMessages.push(message);
    },
  };
  let providerIdentity: ExternalIdentity;
  const oidcProvider: OidcIdentityProvider = {
    provider: 'GOOGLE',
    isConfigured: () => true,
    async createAuthorizationUrl({ state, nonce, codeChallenge }) {
      const url = new URL('https://oidc-provider.test/authorize');
      url.searchParams.set('state', state);
      url.searchParams.set('nonce', nonce);
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
      return url.toString();
    },
    async exchangeAuthorizationCode() { return providerIdentity; },
  };

  beforeAll(async () => {
    database = createDatabaseConnection(loadDatabaseConfig());
    application = await createApplication(
      { ...loadApiConfig(), environment: 'test', cors: { enabled: false, origins: [] } },
      database,
      oidcProvider,
      authConfig,
      emailProvider,
    );
    await application.init();
  });

  afterEach(async () => {
    application.get(AuthRateLimiter).reset();
    deliveredMessages.splice(0);
    emailProviderAvailable = true;
    emailDeliveryFails = false;
    if (createdEmails.size === 0) return;

    const rows = await database.db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.emailNormalized, [...createdEmails]));
    createdEmails.clear();
    const ids = rows.map(({ id }) => id);
    if (ids.length === 0) return;

    await database.db.delete(auditLogs).where(inArray(auditLogs.actorUserId, ids));
    await database.db.delete(emailVerificationTokens).where(inArray(emailVerificationTokens.userId, ids));
    await database.db.delete(passwordResetTokens).where(inArray(passwordResetTokens.userId, ids));
    await database.db.delete(sessions).where(inArray(sessions.userId, ids));
    await database.db.delete(authenticationIdentities).where(inArray(authenticationIdentities.userId, ids));
    await database.db.delete(oauthAuthorizationStates).where(eq(oauthAuthorizationStates.provider, 'GOOGLE'));
    await database.db.delete(users).where(inArray(users.id, ids));
  });

  afterAll(async () => {
    await application?.close();
    await database?.close();
  });

  function email(prefix: string): string {
    const value = `${prefix}-${randomUUID()}@auth-e2e.test`;
    createdEmails.add(value);
    return value;
  }

  function setCookies(response: { headers: Record<string, unknown> }): string[] {
    const header = response.headers['set-cookie'];
    if (header === undefined) return [];
    return Array.isArray(header) ? header.map(String) : [String(header)];
  }

  function requireValue<T>(value: T | undefined, description: string): T {
    if (value === undefined) throw new Error(`Expected ${description}.`);
    return value;
  }

  function cookie(response: { headers: Record<string, unknown> }, name: string): string {
    const value = setCookies(response).find((header) => header.startsWith(`${name}=`));
    return requireValue(value, `${name} cookie`);
  }

  function cookiePair(response: { headers: Record<string, unknown> }, name: string): string {
    return requireValue(cookie(response, name).split(';')[0], `${name} cookie pair`);
  }

  function cookieValue(response: { headers: Record<string, unknown> }, name: string): string {
    const pair = cookiePair(response, name);
    const separator = pair.indexOf('=');
    if (separator < 1) throw new Error(`Expected ${name} cookie value.`);
    return pair.slice(separator + 1);
  }

  function location(response: { headers: Record<string, unknown> }): string {
    return requireValue(typeof response.headers.location === 'string' ? response.headers.location : undefined, 'redirect location');
  }

  async function csrf(): Promise<{ cookie: string; token: string }> {
    const response = await application.getHttpAdapter().getInstance().inject({ method: 'GET', url: '/auth/csrf' });
    const payload = response.json() as { csrfToken?: unknown };
    if (typeof payload.csrfToken !== 'string') throw new Error('Expected CSRF response token.');
    return { token: payload.csrfToken, cookie: cookieValue(response, 'slotlyflow_csrf') };
  }

  const csrfHeaders = (proof: { cookie: string; token: string }) => ({
    cookie: `slotlyflow_csrf=${proof.cookie}`,
    'x-csrf-token': proof.token,
  });

  async function verifiedFixture() {
    const fixtureEmail = email('verified');
    await application.get(AuthService).register(fixtureEmail, password);
    const result = await application.get(AuthService).verifyEmail(verificationToken(fixtureEmail));
    return { email: fixtureEmail, password, ...result };
  }

  function verificationToken(address: string): string {
    const message = [...deliveredMessages].reverse().find((candidate) => candidate.to === address);
    const url = new URL(requireValue(message, 'verification email').verificationUrl);
    return requireValue(url.searchParams.get('token') ?? undefined, 'verification token');
  }

  function expectSafeError(response: { statusCode: number; json: () => unknown }, statusCode: number, code = 'REQUEST_REJECTED'): void {
    expect(response.statusCode).toBe(statusCode);
    expect(response.json()).toEqual({
      error: { code, message: 'The request could not be completed.' },
      correlationId: expect.any(String),
    });
  }

  it('enforces complete CSRF proof validation and keeps the CSRF cookie readable', async () => {
    const server = application.getHttpAdapter().getInstance();
    const payload = { email: email('csrf'), password };
    expectSafeError(await server.inject({ method: 'POST', url: '/auth/register', payload }), 403, 'CSRF_VALIDATION_FAILED');
    expectSafeError(await server.inject({ method: 'POST', url: '/auth/email/resend', payload: { email: email('resend-csrf') } }), 403, 'CSRF_VALIDATION_FAILED');
    expectSafeError(await server.inject({ method: 'POST', url: '/auth/register', headers: { cookie: `slotlyflow_csrf=${(await csrf()).cookie}` }, payload }), 403, 'CSRF_VALIDATION_FAILED');
    expectSafeError(await server.inject({ method: 'POST', url: '/auth/register', headers: { 'x-csrf-token': (await csrf()).token }, payload }), 403, 'CSRF_VALIDATION_FAILED');
    expectSafeError(await server.inject({ method: 'POST', url: '/auth/register', headers: { cookie: 'slotlyflow_csrf=invalid', 'x-csrf-token': 'invalid' }, payload }), 403, 'CSRF_VALIDATION_FAILED');

    const proofResponse = await server.inject({ method: 'GET', url: '/auth/csrf' });
    const csrfCookie = cookie(proofResponse, 'slotlyflow_csrf');
    expect(csrfCookie).not.toContain('HttpOnly');
    expect(proofResponse.json()).toEqual({ csrfToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) });
    const proof = await csrf();
    expect((await server.inject({ method: 'POST', url: '/auth/register', headers: csrfHeaders(proof), payload })).statusCode).toBe(201);
  });

  it('registers normalized local accounts without issuing sessions and rejects invalid or duplicate registration safely', async () => {
    const server = application.getHttpAdapter().getInstance();
    const normalizedEmail = email('registration');
    const registration = await server.inject({
      method: 'POST',
      url: '/auth/register',
      headers: csrfHeaders(await csrf()),
      payload: { email: `  ${normalizedEmail.toUpperCase()}  `, password },
    });
    expect(registration.statusCode).toBe(201);
    expect(registration.json()).toEqual({ status: 'EMAIL_VERIFICATION_REQUIRED' });
    expect(setCookies(registration)).toEqual([]);
    expect(registration.json()).not.toHaveProperty('token');
    expect(registration.json()).not.toHaveProperty('passwordHash');
    const [persisted] = await database.db.select().from(users).where(eq(users.emailNormalized, normalizedEmail));
    const persistedUser = requireValue(persisted, 'persisted registered user');
    expect(persistedUser).toMatchObject({ emailNormalized: normalizedEmail, emailVerifiedAt: null });
    const persistedPasswordHash = requireValue(persistedUser.passwordHash, 'persisted password hash');
    expect(persistedPasswordHash).toMatch(/^\$argon2id\$/);
    const [audit] = await database.db.select().from(auditLogs).where(eq(auditLogs.actorUserId, persistedUser.id));
    expect(audit).toMatchObject({ action: 'auth.registered', targetType: 'user', targetId: persistedUser.id, metadata: {} });
    expect(JSON.stringify(audit?.metadata)).not.toContain(password);
    const delivered = requireValue(deliveredMessages[0], 'delivered registration email');
    expect(delivered.to).toBe(normalizedEmail);
    expect(new URL(delivered.verificationUrl)).toMatchObject({ origin: 'http://localhost:3000', pathname: '/verify-email' });
    expect(delivered.verificationUrl).toContain('token=');
    expect(registration.body).not.toContain(new URL(delivered.verificationUrl).searchParams.get('token') ?? '');

    const invalid = await server.inject({ method: 'POST', url: '/auth/register', headers: csrfHeaders(await csrf()), payload: { email: 'not-an-email', password } });
    expectSafeError(invalid, 400);
    const duplicate = await server.inject({ method: 'POST', url: '/auth/register', headers: csrfHeaders(await csrf()), payload: { email: normalizedEmail, password } });
    expectSafeError(duplicate, 409);
    expect(duplicate.body).not.toContain(password);
    expect(duplicate.body).not.toContain(persistedPasswordHash);
  });

  it('resends only for eligible local accounts while preserving generic public responses and superseding prior tokens', async () => {
    const server = application.getHttpAdapter().getInstance();
    const auth = application.get(AuthService);
    const pendingEmail = email('resend-pending');
    await auth.register(pendingEmail, password);
    const firstToken = verificationToken(pendingEmail);
    const resend = await server.inject({ method: 'POST', url: '/auth/email/resend', headers: csrfHeaders(await csrf()), payload: { email: pendingEmail.toUpperCase() } });
    expect(resend.statusCode).toBe(201);
    expect(resend.json()).toEqual({ status: 'ACCEPTED' });
    const secondToken = verificationToken(pendingEmail);
    expect(secondToken).not.toBe(firstToken);
    const [superseded] = await database.db.select().from(emailVerificationTokens).where(eq(emailVerificationTokens.tokenHash, tokenHash(firstToken)));
    expect(superseded?.usedAt).toEqual(expect.any(Date));
    expect((await database.db.select().from(emailVerificationTokens).where(and(eq(emailVerificationTokens.userId, superseded?.userId ?? ''), isNull(emailVerificationTokens.usedAt)))).length).toBe(1);

    const unknown = await server.inject({ method: 'POST', url: '/auth/email/resend', headers: csrfHeaders(await csrf()), payload: { email: email('resend-unknown') } });
    expect(unknown.statusCode).toBe(201);
    expect(unknown.json()).toEqual({ status: 'ACCEPTED' });
    const verified = await verifiedFixture();
    const verifiedResponse = await server.inject({ method: 'POST', url: '/auth/email/resend', headers: csrfHeaders(await csrf()), payload: { email: verified.email } });
    expect(verifiedResponse.json()).toEqual({ status: 'ACCEPTED' });

    const googleEmail = email('resend-google');
    await auth.authenticateGoogle({ provider: 'GOOGLE', providerSubject: `google-${randomUUID()}`, email: googleEmail, emailVerified: true, issuer: 'https://accounts.google.com' });
    const googleResponse = await server.inject({ method: 'POST', url: '/auth/email/resend', headers: csrfHeaders(await csrf()), payload: { email: googleEmail } });
    expect(googleResponse.json()).toEqual({ status: 'ACCEPTED' });
  });

  it('keeps durable registration state, emits safe audit events, and returns a controlled failure when delivery fails', async () => {
    const server = application.getHttpAdapter().getInstance();
    const registrationEmail = email('delivery-failure');
    emailDeliveryFails = true;
    expectSafeError(await server.inject({ method: 'POST', url: '/auth/register', headers: csrfHeaders(await csrf()), payload: { email: registrationEmail, password } }), 503, 'DEPENDENCY_UNAVAILABLE');
    const [user] = await database.db.select().from(users).where(eq(users.emailNormalized, registrationEmail));
    expect(user?.emailVerifiedAt).toBeNull();
    const [audit] = await database.db.select().from(auditLogs).where(eq(auditLogs.actorUserId, user?.id ?? ''));
    expect(JSON.stringify(audit?.metadata)).not.toContain('token');
    emailDeliveryFails = false;
    expect((await server.inject({ method: 'POST', url: '/auth/email/resend', headers: csrfHeaders(await csrf()), payload: { email: registrationEmail } })).json()).toEqual({ status: 'ACCEPTED' });
  });

  it('verifies only valid unexpired single-use tokens and issues the first authenticated session', async () => {
    const server = application.getHttpAdapter().getInstance();
    const auth = application.get(AuthService);
    const validEmail = email('verification-valid');
    await auth.register(validEmail, password);
    const validToken = verificationToken(validEmail);
    const expiredEmail = email('verification-expired');
    await auth.register(expiredEmail, password);
    const expiredToken = verificationToken(expiredEmail);
    const [storedVerification] = await database.db.select().from(emailVerificationTokens).where(eq(emailVerificationTokens.tokenHash, tokenHash(validToken)));
    expect(storedVerification?.tokenHash).toBe(tokenHash(validToken));
    expect(storedVerification?.tokenHash).not.toBe(validToken);
    await database.db.update(emailVerificationTokens).set({ expiresAt: new Date(0) }).where(eq(emailVerificationTokens.tokenHash, tokenHash(expiredToken)));

    expectSafeError(await server.inject({ method: 'POST', url: '/auth/email/verify', headers: csrfHeaders(await csrf()), payload: { token: randomUUID() } }), 400);
    expectSafeError(await server.inject({ method: 'POST', url: '/auth/email/verify', headers: csrfHeaders(await csrf()), payload: { token: expiredToken } }), 400);
    const verified = await server.inject({ method: 'POST', url: '/auth/email/verify', headers: csrfHeaders(await csrf()), payload: { token: validToken } });
    expect(verified.statusCode).toBe(201);
    expect(verified.json()).toEqual({ user: { id: expect.any(String), email: validEmail, emailVerified: true } });
    const sessionHeader = cookie(verified, authConfig.session.cookieName);
    expect(sessionHeader).toContain('HttpOnly');
    const sameSite = authConfig.session.sameSite.replace(/^./, (firstCharacter) => firstCharacter.toUpperCase());
    expect(sessionHeader).toContain(`SameSite=${sameSite}`);
    expect(sessionHeader.includes('Secure')).toBe(authConfig.session.secure);
    expectSafeError(await server.inject({ method: 'POST', url: '/auth/email/verify', headers: csrfHeaders(await csrf()), payload: { token: validToken } }), 400);
  });

  it('uses non-enumerating login failures and gives only verified users an HttpOnly session', async () => {
    const server = application.getHttpAdapter().getInstance();
    const auth = application.get(AuthService);
    const fixtureEmail = email('login');
    await auth.register(fixtureEmail, password);
    const unverifiedToken = verificationToken(fixtureEmail);
    const pending = await server.inject({ method: 'POST', url: '/auth/login', headers: csrfHeaders(await csrf()), payload: { email: fixtureEmail, password } });
    expectSafeError(pending, 403, 'EMAIL_VERIFICATION_REQUIRED');
    await auth.verifyEmail(unverifiedToken);

    const wrong = await server.inject({ method: 'POST', url: '/auth/login', headers: csrfHeaders(await csrf()), payload: { email: fixtureEmail, password: 'wrong password value' } });
    const absent = await server.inject({ method: 'POST', url: '/auth/login', headers: csrfHeaders(await csrf()), payload: { email: email('absent'), password: 'wrong password value' } });
    expect([wrong.statusCode, wrong.json().error]).toEqual([absent.statusCode, absent.json().error]);
    expectSafeError(wrong, 401);

    const login = await server.inject({ method: 'POST', url: '/auth/login', headers: csrfHeaders(await csrf()), payload: { email: fixtureEmail.toUpperCase(), password } });
    expect(login.statusCode).toBe(201);
    expect(login.json()).toEqual({ user: { id: expect.any(String), email: fixtureEmail, emailVerified: true } });
    const sessionHeader = cookie(login, authConfig.session.cookieName);
    expect(sessionHeader).toContain('HttpOnly');
    expect(sessionHeader).toContain('SameSite=Lax');
    expect(sessionHeader.includes('Secure')).toBe(authConfig.session.secure);
    const rawSessionToken = cookieValue(login, authConfig.session.cookieName);
    const [storedSession] = await database.db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash(rawSessionToken)));
    const persistedSession = requireValue(storedSession, 'persisted session');
    expect(persistedSession.tokenHash).toBe(tokenHash(rawSessionToken));
    expect(login.json()).not.toHaveProperty('password');
    expect(login.json()).not.toHaveProperty('passwordHash');
    expect(login.body).not.toContain(password);
    expect(login.body).not.toContain(persistedSession.tokenHash);
  });

  it('returns only the safe authenticated-user shape and rejects missing, unknown, expired, and revoked sessions', async () => {
    const server = application.getHttpAdapter().getInstance();
    const fixture = await verifiedFixture();
    const validSession = `${authConfig.session.cookieName}=${fixture.sessionToken}`;
    const me = await server.inject({ method: 'GET', url: '/auth/me', headers: { cookie: validSession } });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toEqual({ user: fixture.user });
    expect(Object.keys(me.json().user).sort()).toEqual(['email', 'emailVerified', 'id']);
    expect(me.body).not.toContain('passwordHash');
    expect(me.body).not.toContain('organization');

    expectSafeError(await server.inject({ method: 'GET', url: '/auth/me' }), 401);
    expectSafeError(await server.inject({ method: 'GET', url: '/auth/me', headers: { cookie: `${authConfig.session.cookieName}=malformed-or-unknown` } }), 401);
    await database.db.update(sessions).set({ expiresAt: new Date(0) }).where(eq(sessions.tokenHash, tokenHash(fixture.sessionToken)));
    expectSafeError(await server.inject({ method: 'GET', url: '/auth/me', headers: { cookie: validSession } }), 401);

    const revoked = await verifiedFixture();
    await database.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, tokenHash(revoked.sessionToken)));
    expectSafeError(await server.inject({ method: 'GET', url: '/auth/me', headers: { cookie: `${authConfig.session.cookieName}=${revoked.sessionToken}` } }), 401);
  });

  it('requires CSRF for logout and persists session revocation', async () => {
    const server = application.getHttpAdapter().getInstance();
    const fixture = await verifiedFixture();
    const session = `${authConfig.session.cookieName}=${fixture.sessionToken}`;
    expectSafeError(await server.inject({ method: 'POST', url: '/auth/logout', headers: { cookie: session } }), 403, 'CSRF_VALIDATION_FAILED');
    const proof = await csrf();
    const logout = await server.inject({ method: 'POST', url: '/auth/logout', headers: { cookie: `${session}; slotlyflow_csrf=${proof.cookie}`, 'x-csrf-token': proof.token } });
    expect(logout.statusCode).toBe(204);
    expect(cookie(logout, authConfig.session.cookieName)).toContain('Max-Age=0');
    expectSafeError(await server.inject({ method: 'GET', url: '/auth/me', headers: { cookie: session } }), 401);
  });

  it('keeps forgot-password responses generic, normalized, token-free, and protected by CSRF', async () => {
    const server = application.getHttpAdapter().getInstance();
    const fixture = await verifiedFixture();
    expectSafeError(await server.inject({ method: 'POST', url: '/auth/password/forgot', payload: { email: fixture.email } }), 403, 'CSRF_VALIDATION_FAILED');
    const existing = await server.inject({ method: 'POST', url: '/auth/password/forgot', headers: csrfHeaders(await csrf()), payload: { email: fixture.email.toUpperCase() } });
    const absent = await server.inject({ method: 'POST', url: '/auth/password/forgot', headers: csrfHeaders(await csrf()), payload: { email: email('forgot-absent') } });
    expect([existing.statusCode, existing.json()]).toEqual([absent.statusCode, absent.json()]);
    expect(existing.json()).toEqual({ status: 'ACCEPTED' });
    expect(existing.body).not.toContain('token');
    expect(existing.body).not.toContain('password');
  });

  it('resets passwords with valid single-use tokens, revokes every prior session, and safely rejects invalid tokens', async () => {
    const server = application.getHttpAdapter().getInstance();
    const auth = application.get(AuthService);
    const fixture = await verifiedFixture();
    const oldSession = `${authConfig.session.cookieName}=${fixture.sessionToken}`;
    const reset = await auth.forgotPassword(fixture.email);
    const expired = await auth.forgotPassword(fixture.email);
    const resetToken = requireValue(reset.token, 'password reset token fixture');
    const expiredToken = requireValue(expired.token, 'expired password reset token fixture');
    const [storedReset] = await database.db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash(resetToken)));
    const persistedReset = requireValue(storedReset, 'persisted password reset token');
    expect(persistedReset.tokenHash).toBe(tokenHash(resetToken));
    expect(persistedReset.tokenHash).not.toBe(resetToken);
    await database.db.update(passwordResetTokens).set({ expiresAt: new Date(0) }).where(eq(passwordResetTokens.tokenHash, tokenHash(expiredToken)));

    expectSafeError(await server.inject({ method: 'POST', url: '/auth/password/reset', headers: csrfHeaders(await csrf()), payload: { token: randomUUID(), password: 'replacement password phrase' } }), 400);
    expectSafeError(await server.inject({ method: 'POST', url: '/auth/password/reset', headers: csrfHeaders(await csrf()), payload: { token: expiredToken, password: 'replacement password phrase' } }), 400);
    const completed = await server.inject({ method: 'POST', url: '/auth/password/reset', headers: csrfHeaders(await csrf()), payload: { token: resetToken, password: 'replacement password phrase' } });
    expect(completed.statusCode).toBe(204);
    expect(completed.body).toBe('');
    expectSafeError(await server.inject({ method: 'GET', url: '/auth/me', headers: { cookie: oldSession } }), 401);
    expectSafeError(await server.inject({ method: 'POST', url: '/auth/login', headers: csrfHeaders(await csrf()), payload: { email: fixture.email, password } }), 401);
    const newLogin = await server.inject({ method: 'POST', url: '/auth/login', headers: csrfHeaders(await csrf()), payload: { email: fixture.email, password: 'replacement password phrase' } });
    expect(newLogin.statusCode).toBe(201);
    expect(newLogin.body).not.toContain('replacement password phrase');
    expectSafeError(await server.inject({ method: 'POST', url: '/auth/password/reset', headers: csrfHeaders(await csrf()), payload: { token: resetToken, password } }), 400);
  });

  it.each([
    ['register', '/auth/register', 5, { email: 'not-an-email', password }, 400],
    ['login', '/auth/login', 10, { email: 'nobody@auth-e2e.test', password }, 401],
    ['email verification', '/auth/email/verify', 10, { token: randomUUID() }, 400],
    ['email verification resend', '/auth/email/resend', 5, { email: 'nobody@auth-e2e.test' }, 201],
    ['password forgot', '/auth/password/forgot', 5, { email: 'nobody@auth-e2e.test' }, 201],
    ['password reset', '/auth/password/reset', 5, { token: randomUUID(), password }, 400],
  ])('wires the %s rate limit through HTTP and returns a safe 429 response', async (_name, url, limit, payload, normalStatus) => {
    const server = application.getHttpAdapter().getInstance();
    const headers = csrfHeaders(await csrf());
    for (let attempt = 0; attempt < limit; attempt += 1) {
      expect((await server.inject({ method: 'POST', url, headers, payload })).statusCode).toBe(normalStatus);
    }
    const limited = await server.inject({ method: 'POST', url, headers, payload });
    expectSafeError(limited, 429);
    expect(limited.body).not.toContain('password');
    expect(limited.body).not.toContain('token_hash');
  });

  it('creates durable hashed Google state with nonce and PKCE, then authenticates a new Google-only user using the normal session', async () => {
    const server = application.getHttpAdapter().getInstance();
    const googleEmail = email('google-new');
    providerIdentity = {
      provider: 'GOOGLE', providerSubject: `google-${randomUUID()}`, email: googleEmail,
      emailVerified: true, issuer: 'https://accounts.google.com', displayName: 'Google Test',
    };
    const initiation = await server.inject({ method: 'GET', url: '/auth/google' });
    expect(initiation.statusCode).toBe(302);
    const authorizationUrl = new URL(location(initiation));
    const state = requireValue(authorizationUrl.searchParams.get('state') ?? undefined, 'OIDC state');
    const nonce = requireValue(authorizationUrl.searchParams.get('nonce') ?? undefined, 'OIDC nonce');
    const challenge = requireValue(authorizationUrl.searchParams.get('code_challenge') ?? undefined, 'PKCE challenge');
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(initiation.body).not.toContain(state);
    expect(initiation.body).not.toContain(nonce);
    const nonceCookie = cookieValue(initiation, 'slotlyflow_google_oidc_nonce');
    const verifier = cookieValue(initiation, 'slotlyflow_google_oidc_verifier');
    expect(cookie(initiation, 'slotlyflow_google_oidc_nonce')).toContain('HttpOnly');
    expect(cookie(initiation, 'slotlyflow_google_oidc_verifier')).toContain('HttpOnly');
    const [storedState] = await database.db.select().from(oauthAuthorizationStates).where(eq(oauthAuthorizationStates.stateHash, tokenHash(state)));
    const persistedState = requireValue(storedState, 'persisted OIDC state');
    expect(persistedState).toMatchObject({ provider: 'GOOGLE', nonceHash: tokenHash(nonce), codeVerifierHash: tokenHash(verifier), usedAt: null, redirectUri: authConfig.googleOidc.redirectUri });
    expect(challenge).toBe(tokenHash(verifier));

    const callback = await server.inject({
      method: 'GET', url: `/auth/google/callback?state=${encodeURIComponent(state)}&code=provider-code&redirect=https%3A%2F%2Funtrusted.example`,
      headers: { cookie: `slotlyflow_google_oidc_nonce=${nonceCookie}; slotlyflow_google_oidc_verifier=${verifier}` },
    });
    expect(callback.statusCode).toBe(302);
    expect(location(callback)).toBe(authConfig.googleOidc.webAppUrl);
    const sessionToken = cookieValue(callback, authConfig.session.cookieName);
    expect(cookie(callback, authConfig.session.cookieName)).toContain('HttpOnly');
    const [user] = await database.db.select().from(users).where(eq(users.emailNormalized, googleEmail));
    const googleUser = requireValue(user, 'new Google user');
    expect(googleUser).toMatchObject({ passwordHash: null, emailVerifiedAt: expect.any(Date) });
    const [identity] = await database.db.select().from(authenticationIdentities).where(eq(authenticationIdentities.providerSubject, providerIdentity.providerSubject));
    expect(identity).toMatchObject({ userId: googleUser.id, provider: 'GOOGLE', providerEmail: googleEmail });
    const me = await server.inject({ method: 'GET', url: '/auth/me', headers: { cookie: `${authConfig.session.cookieName}=${sessionToken}` } });
    expect(me.json()).toEqual({ user: { id: googleUser.id, email: googleEmail, emailVerified: true } });
    expect((await database.db.select().from(oauthAuthorizationStates).where(eq(oauthAuthorizationStates.id, persistedState.id)))[0]?.usedAt).toEqual(expect.any(Date));
  });

  it('fails closed for missing or replayed state and links only a verified local account with the same email', async () => {
    const server = application.getHttpAdapter().getInstance();
    const local = await verifiedFixture();
    providerIdentity = { provider: 'GOOGLE', providerSubject: `google-${randomUUID()}`, email: local.email, emailVerified: true, issuer: 'https://accounts.google.com' };
    const initiation = await server.inject({ method: 'GET', url: '/auth/google' });
    const state = requireValue(new URL(location(initiation)).searchParams.get('state') ?? undefined, 'OIDC state');
    const nonce = cookieValue(initiation, 'slotlyflow_google_oidc_nonce');
    const verifier = cookieValue(initiation, 'slotlyflow_google_oidc_verifier');
    expectSafeError(await server.inject({ method: 'GET', url: '/auth/google/callback?state=invalid&code=provider-code' }), 400, 'OIDC_AUTHORIZATION_INVALID');
    const callbackHeaders = { cookie: `slotlyflow_google_oidc_nonce=${nonce}; slotlyflow_google_oidc_verifier=${verifier}` };
    const callbackUrl = `/auth/google/callback?state=${encodeURIComponent(state)}&code=provider-code`;
    expectSafeError(await server.inject({
      method: 'GET', url: callbackUrl,
      headers: { cookie: `slotlyflow_google_oidc_nonce=${nonce}; slotlyflow_google_oidc_verifier=${randomBytes(32).toString('base64url')}` },
    }), 400, 'OIDC_AUTHORIZATION_INVALID');
    expect((await server.inject({ method: 'GET', url: callbackUrl, headers: callbackHeaders })).statusCode).toBe(302);
    const [linked] = await database.db.select().from(authenticationIdentities).where(eq(authenticationIdentities.providerSubject, providerIdentity.providerSubject));
    expect(linked?.userId).toBe(local.user.id);
    expectSafeError(await server.inject({ method: 'GET', url: callbackUrl, headers: callbackHeaders }), 400, 'OIDC_AUTHORIZATION_INVALID');
  });

  it('does not auto-link a verified Google identity to an unverified local account', async () => {
    const server = application.getHttpAdapter().getInstance();
    const localEmail = email('google-link-pending');
    await application.get(AuthService).register(localEmail, password);
    providerIdentity = { provider: 'GOOGLE', providerSubject: `google-${randomUUID()}`, email: localEmail, emailVerified: true, issuer: 'https://accounts.google.com' };
    const initiation = await server.inject({ method: 'GET', url: '/auth/google' });
    const state = requireValue(new URL(location(initiation)).searchParams.get('state') ?? undefined, 'OIDC state');
    const nonce = cookieValue(initiation, 'slotlyflow_google_oidc_nonce');
    const verifier = cookieValue(initiation, 'slotlyflow_google_oidc_verifier');
    expectSafeError(await server.inject({
      method: 'GET', url: `/auth/google/callback?state=${encodeURIComponent(state)}&code=provider-code`,
      headers: { cookie: `slotlyflow_google_oidc_nonce=${nonce}; slotlyflow_google_oidc_verifier=${verifier}` },
    }), 403, 'GOOGLE_ACCOUNT_LINKING_REQUIRED');
    expect((await database.db.select().from(authenticationIdentities).where(eq(authenticationIdentities.providerSubject, providerIdentity.providerSubject))).length).toBe(0);
  });
});

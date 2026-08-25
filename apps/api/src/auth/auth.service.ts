import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { AuthenticationConfig } from '@slotlyflow/config';
import { authenticationIdentities, auditLogs, emailVerificationTokens, passwordResetTokens, sessions, users, type SlotlyFlowDatabase } from '@slotlyflow/database';
import type { AuthenticatedUserResponse } from '@slotlyflow/contracts';

import { AUTH_CONFIG, AUTH_DATABASE, EMAIL_PROVIDER } from './auth.tokens.js';
import { PasswordService } from './password.service.js';
import type { ExternalIdentity } from './oidc/oidc-identity-provider.js';
import type { EmailProvider } from '../email/email-provider.js';

const verificationLifetimeMs = 24 * 60 * 60 * 1000;
const resetLifetimeMs = 60 * 60 * 1000;

function normalizeEmail(value: string): string { return value.trim().toLowerCase(); }
function hashToken(value: string): string { return createHash('sha256').update(value).digest('base64url'); }
function newToken(): string { return randomBytes(32).toString('base64url'); }
function safeUser(user: { id: string; emailNormalized: string; emailVerifiedAt: Date | null }): AuthenticatedUserResponse { return { id: user.id, email: user.emailNormalized, emailVerified: user.emailVerifiedAt !== null }; }
function validEmail(value: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

interface VerificationDelivery {
  readonly userId: string;
  readonly email: string;
  readonly token: string;
  readonly expiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_DATABASE) private readonly db: SlotlyFlowDatabase,
    @Inject(AUTH_CONFIG) private readonly config: AuthenticationConfig,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  async register(email: string, password: string): Promise<void> {
    const normalized = normalizeEmail(email);
    this.assertCredentials(normalized, password);
    const passwordHash = await this.passwords.hash(password);
    const token = newToken();
    const expiresAt = new Date(Date.now() + verificationLifetimeMs);
    let delivery: VerificationDelivery;
    try {
      delivery = await this.db.transaction(async (tx) => {
        const [user] = await tx.insert(users).values({ emailNormalized: normalized, passwordHash }).returning();
        if (user === undefined) throw new Error('User creation failed.');
        await tx.insert(authenticationIdentities).values({ userId: user.id, provider: 'PASSWORD', providerSubject: normalized, providerEmail: normalized });
        await tx.insert(emailVerificationTokens).values({ userId: user.id, tokenHash: hashToken(token), expiresAt });
        await tx.insert(auditLogs).values({ actorUserId: user.id, action: 'auth.registered', targetType: 'user', targetId: user.id, metadata: {} });
        await tx.insert(auditLogs).values({ actorUserId: user.id, action: 'auth.verification_email_requested', targetType: 'user', targetId: user.id, metadata: {} });
        return { userId: user.id, email: normalized, token, expiresAt };
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('An account could not be created.');
      throw error;
    }
    await this.deliverVerificationEmail(delivery);
  }

  async resendVerification(email: string): Promise<void> {
    const normalized = normalizeEmail(email);
    if (!validEmail(normalized)) throw new BadRequestException('Invalid email address.');
    await this.assertEmailProviderAvailable();

    const delivery = await this.db.transaction(async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.emailNormalized, normalized)).for('update');
      if (user === undefined || user.emailVerifiedAt !== null || user.passwordHash === null) return undefined;

      const token = newToken();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + verificationLifetimeMs);
      await tx.update(emailVerificationTokens).set({ usedAt: now }).where(and(eq(emailVerificationTokens.userId, user.id), isNull(emailVerificationTokens.usedAt)));
      await tx.insert(emailVerificationTokens).values({ userId: user.id, tokenHash: hashToken(token), expiresAt });
      await tx.insert(auditLogs).values({ actorUserId: user.id, action: 'auth.verification_email_requested', targetType: 'user', targetId: user.id, metadata: {} });
      return { userId: user.id, email: user.emailNormalized, token, expiresAt };
    });

    if (delivery !== undefined) await this.deliverVerificationEmail(delivery);
  }

  async login(email: string, password: string): Promise<{ user: AuthenticatedUserResponse; token: string }> {
    const normalized = normalizeEmail(email);
    const [user] = await this.db.select().from(users).where(eq(users.emailNormalized, normalized));
    if (user === undefined || user.passwordHash === null || !(await this.passwords.verify(user.passwordHash, password))) throw new UnauthorizedException('Invalid email or password.');
    if (user.emailVerifiedAt === null) throw new ForbiddenException({ code: 'EMAIL_VERIFICATION_REQUIRED' });
    const token = await this.createSession(user.id);
    await this.db.insert(auditLogs).values({ actorUserId: user.id, action: 'auth.login_succeeded', targetType: 'user', targetId: user.id, metadata: {} });
    return { user: safeUser(user), token };
  }

  /** Resolves a validated provider identity into the existing User → Identity → Session model. */
  async authenticateGoogle(identity: ExternalIdentity): Promise<{ user: AuthenticatedUserResponse; token: string }> {
    if (identity.provider !== 'GOOGLE' || identity.issuer !== 'https://accounts.google.com' || !identity.emailVerified || identity.providerSubject.trim() === '') {
      throw new BadRequestException({ code: 'OIDC_IDENTITY_INVALID' });
    }
    const normalizedEmail = normalizeEmail(identity.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new BadRequestException({ code: 'OIDC_IDENTITY_INVALID' });

    const sessionToken = newToken();
    const now = new Date();
    return this.db.transaction(async (tx) => {
      const [existingIdentity] = await tx.select().from(authenticationIdentities).where(and(
        eq(authenticationIdentities.provider, 'GOOGLE'),
        eq(authenticationIdentities.providerSubject, identity.providerSubject),
      ));

      let user;
      let identityCreated = false;
      let identityLinked = false;
      if (existingIdentity !== undefined) {
        [user] = await tx.select().from(users).where(eq(users.id, existingIdentity.userId));
        if (user === undefined) throw new BadRequestException({ code: 'OIDC_IDENTITY_INVALID' });
      } else {
        const [existingEmailUser] = await tx.select().from(users).where(eq(users.emailNormalized, normalizedEmail));
        if (existingEmailUser !== undefined && existingEmailUser.emailVerifiedAt === null) {
          throw new ForbiddenException({ code: 'GOOGLE_ACCOUNT_LINKING_REQUIRED' });
        }
        if (existingEmailUser !== undefined) {
          user = existingEmailUser;
          identityLinked = true;
        } else {
          [user] = await tx.insert(users).values({ emailNormalized: normalizedEmail, passwordHash: null, emailVerifiedAt: now }).returning();
          if (user === undefined) throw new Error('Google user creation failed.');
          identityCreated = true;
        }
        await tx.insert(authenticationIdentities).values({
          userId: user.id,
          provider: 'GOOGLE',
          providerSubject: identity.providerSubject,
          providerEmail: normalizedEmail,
        });
      }

      await tx.insert(sessions).values({
        userId: user.id,
        tokenHash: hashToken(sessionToken),
        expiresAt: new Date(Date.now() + this.config.session.lifetimeSeconds * 1000),
      });
      if (identityCreated) await tx.insert(auditLogs).values({ actorUserId: user.id, action: 'auth.google_identity_created', targetType: 'user', targetId: user.id, metadata: { provider: 'GOOGLE' } });
      if (identityLinked) await tx.insert(auditLogs).values({ actorUserId: user.id, action: 'auth.google_identity_linked', targetType: 'user', targetId: user.id, metadata: { provider: 'GOOGLE' } });
      await tx.insert(auditLogs).values({ actorUserId: user.id, action: 'auth.google_login_succeeded', targetType: 'user', targetId: user.id, metadata: { provider: 'GOOGLE' } });
      return { user: safeUser(user), token: sessionToken };
    });
  }

  async current(token: string | undefined): Promise<AuthenticatedUserResponse> {
    const user = await this.resolveSession(token);
    if (user === undefined) throw new UnauthorizedException();
    return safeUser(user);
  }

  async logout(token: string | undefined): Promise<void> {
    const user = await this.resolveSession(token);
    if (user === undefined || token === undefined) return;
    await this.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, hashToken(token)));
    await this.db.insert(auditLogs).values({ actorUserId: user.id, action: 'auth.logout', targetType: 'user', targetId: user.id, metadata: {} });
  }

  async verifyEmail(token: string): Promise<{ user: AuthenticatedUserResponse; sessionToken: string }> {
    const now = new Date();
    const [record] = await this.db.select().from(emailVerificationTokens).where(and(eq(emailVerificationTokens.tokenHash, hashToken(token)), isNull(emailVerificationTokens.usedAt), gt(emailVerificationTokens.expiresAt, now)));
    if (record === undefined) throw new BadRequestException('Verification link is invalid or expired.');
    return this.db.transaction(async (tx) => {
      const [user] = await tx.update(users).set({ emailVerifiedAt: now, updatedAt: now }).where(eq(users.id, record.userId)).returning();
      if (user === undefined) throw new BadRequestException();
      const [consumed] = await tx.update(emailVerificationTokens).set({ usedAt: now }).where(and(eq(emailVerificationTokens.id, record.id), isNull(emailVerificationTokens.usedAt))).returning();
      if (consumed === undefined) throw new BadRequestException('Verification link is invalid or expired.');
      const sessionToken = newToken();
      await tx.insert(sessions).values({ userId: user.id, tokenHash: hashToken(sessionToken), expiresAt: new Date(Date.now() + this.config.session.lifetimeSeconds * 1000) });
      await tx.insert(auditLogs).values({ actorUserId: user.id, action: 'auth.email_verified', targetType: 'user', targetId: user.id, metadata: {} });
      return { user: safeUser(user), sessionToken };
    });
  }

  async forgotPassword(email: string): Promise<{ token?: string }> {
    const [user] = await this.db.select().from(users).where(eq(users.emailNormalized, normalizeEmail(email)));
    if (user === undefined) return {};
    const token = newToken();
    await this.db.insert(passwordResetTokens).values({ userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + resetLifetimeMs) });
    return { token };
  }

  async resetPassword(token: string, password: string): Promise<void> {
    this.assertPassword(password);
    const now = new Date();
    const [record] = await this.db.select().from(passwordResetTokens).where(and(eq(passwordResetTokens.tokenHash, hashToken(token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, now)));
    if (record === undefined) throw new BadRequestException('Reset link is invalid or expired.');
    const passwordHash = await this.passwords.hash(password);
    await this.db.transaction(async (tx) => {
      const [consumed] = await tx.update(passwordResetTokens).set({ usedAt: now }).where(and(eq(passwordResetTokens.id, record.id), isNull(passwordResetTokens.usedAt))).returning();
      if (consumed === undefined) throw new BadRequestException('Reset link is invalid or expired.');
      await tx.update(users).set({ passwordHash, updatedAt: now }).where(eq(users.id, record.userId));
      await tx.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.userId, record.userId), isNull(sessions.revokedAt)));
      await tx.insert(auditLogs).values({ actorUserId: record.userId, action: 'auth.password_reset', targetType: 'user', targetId: record.userId, metadata: {} });
    });
  }

  private async deliverVerificationEmail(delivery: VerificationDelivery): Promise<void> {
    try {
      await this.emailProvider.sendVerificationEmail({
        to: delivery.email,
        verificationUrl: this.verificationUrl(delivery.token),
        expiresAt: delivery.expiresAt,
      });
    } catch {
      await this.db.insert(auditLogs).values({ actorUserId: delivery.userId, action: 'auth.verification_email_delivery_failed', targetType: 'user', targetId: delivery.userId, metadata: {} });
      throw new ServiceUnavailableException({ code: 'DEPENDENCY_UNAVAILABLE' });
    }
    await this.db.insert(auditLogs).values({ actorUserId: delivery.userId, action: 'auth.verification_email_delivered', targetType: 'user', targetId: delivery.userId, metadata: {} });
  }
  private async assertEmailProviderAvailable(): Promise<void> {
    try { await this.emailProvider.assertAvailable(); } catch { throw new ServiceUnavailableException({ code: 'DEPENDENCY_UNAVAILABLE' }); }
  }
  private verificationUrl(token: string): string {
    if (this.config.email.provider !== 'smtp') throw new ServiceUnavailableException({ code: 'DEPENDENCY_UNAVAILABLE' });
    const url = new URL('/verify-email', this.config.email.webAppUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }
  private async createSession(userId: string): Promise<string> { const token = newToken(); await this.db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + this.config.session.lifetimeSeconds * 1000) }); return token; }
  private async resolveSession(token: string | undefined) { if (token === undefined) return undefined; const [session] = await this.db.select().from(sessions).where(and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()))); if (session === undefined) return undefined; const [user] = await this.db.select().from(users).where(eq(users.id, session.userId)); if (user !== undefined) await this.db.update(sessions).set({ lastUsedAt: new Date() }).where(eq(sessions.id, session.id)); return user; }
  private assertCredentials(email: string, password: string): void { if (!validEmail(email)) throw new BadRequestException('Invalid registration details.'); this.assertPassword(password); }
  private assertPassword(password: string): void { if (password.length < 12 || password.length > 256) throw new BadRequestException('Invalid registration details.'); }
  private isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    if ('code' in error && error.code === '23505') return true;
    return 'cause' in error && this.isUniqueViolation(error.cause);
  }
}

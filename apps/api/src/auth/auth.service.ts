import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { AuthenticationConfig } from '@slotlyflow/config';
import { authenticationIdentities, auditLogs, emailVerificationTokens, passwordResetTokens, sessions, users, type SlotlyFlowDatabase } from '@slotlyflow/database';
import type { AuthenticatedUserResponse } from '@slotlyflow/contracts';

import { AUTH_CONFIG, AUTH_DATABASE, EMAIL_PROVIDER } from './auth.tokens.js';
import { PasswordService } from './password.service.js';
import { noOidcDiagnostics, safeExceptionType, type OidcDiagnosticReporter, type OidcDiagnosticStage } from './oidc/oidc-diagnostics.js';
import type { ExternalIdentity } from './oidc/oidc-identity-provider.js';
import type { EmailProvider } from '../email/email-provider.js';
import { resolveAuthenticatedSession } from './session-authentication.js';
import {
  noRegistrationDiagnostics,
  safeRegistrationExceptionType,
  type RegistrationDiagnosticReporter,
  type RegistrationStage,
} from '../observability/registration-diagnostics.js';

const verificationLifetimeMs = 24 * 60 * 60 * 1000;
const resetLifetimeMs = 60 * 60 * 1000;
const googleIdentityLockTimeoutMs = 5_000;
const googleIdentityStatementTimeoutMs = 10_000;
const maximumNameLength = 100;

function normalizeEmail(value: string): string { return value.trim().toLowerCase(); }
function hashToken(value: string): string { return createHash('sha256').update(value).digest('base64url'); }
function newToken(): string { return randomBytes(32).toString('base64url'); }
function safeUser(
  user: { id: string; firstName: string | null; lastName: string | null; emailNormalized: string; emailVerifiedAt: Date | null },
  passwordAuthenticationEnabled: boolean,
): AuthenticatedUserResponse {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.emailNormalized,
    emailVerified: user.emailVerifiedAt !== null,
    passwordAuthenticationEnabled,
  };
}
function validEmail(value: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

interface RegistrationProfile {
  readonly firstName: unknown;
  readonly lastName: unknown;
}

interface VerificationDelivery {
  readonly userId: string;
  readonly email: string;
  readonly firstName: string | null;
  readonly token: string;
  readonly expiresAt: Date;
}

interface PasswordResetDelivery {
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

  async register(
    email: string,
    password: string,
    diagnostics: RegistrationDiagnosticReporter = noRegistrationDiagnostics,
    profile?: RegistrationProfile,
  ): Promise<void> {
    const normalized = normalizeEmail(email);
    let firstName: string;
    let lastName: string;
    try {
      firstName = this.normalizeRequiredName(profile?.firstName);
      lastName = this.normalizeRequiredName(profile?.lastName);
      this.assertCredentials(normalized, password);
    } catch (error) {
      diagnostics({ stage: 'body_validation', outcome: 'failure', exceptionType: safeRegistrationExceptionType(error) });
      throw error;
    }
    diagnostics({ stage: 'body_validation', outcome: 'success' });

    const existingUser = await this.findRegisteredUser(normalized, diagnostics);
    if (existingUser !== undefined) throw new ConflictException('An account could not be created.');

    let passwordHash: string;
    try {
      passwordHash = await this.passwords.hash(password);
    } catch (error) {
      diagnostics({ stage: 'password_hashing', outcome: 'failure', exceptionType: safeRegistrationExceptionType(error) });
      throw error;
    }
    diagnostics({ stage: 'password_hashing', outcome: 'success' });
    const token = newToken();
    diagnostics({ stage: 'verification_token_generation', outcome: 'success' });
    const expiresAt = new Date(Date.now() + verificationLifetimeMs);
    let delivery: VerificationDelivery;
    let stage: RegistrationStage = 'user_insert';
    try {
      delivery = await this.db.transaction(async (tx) => {
        const [user] = await tx.insert(users).values({ firstName, lastName, emailNormalized: normalized, passwordHash }).returning();
        if (user === undefined) throw new Error('User creation failed.');
        diagnostics({ stage: 'user_insert', outcome: 'success' });
        await tx.insert(authenticationIdentities).values({ userId: user.id, provider: 'PASSWORD', providerSubject: normalized, providerEmail: normalized });
        stage = 'verification_token_insert';
        await tx.insert(emailVerificationTokens).values({ userId: user.id, tokenHash: hashToken(token), expiresAt });
        diagnostics({ stage: 'verification_token_insert', outcome: 'success' });
        await tx.insert(auditLogs).values({ actorUserId: user.id, action: 'auth.registered', targetType: 'user', targetId: user.id, metadata: {} });
        await tx.insert(auditLogs).values({ actorUserId: user.id, action: 'auth.verification_email_requested', targetType: 'user', targetId: user.id, metadata: {} });
        return { userId: user.id, email: normalized, firstName: user.firstName, token, expiresAt };
      });
      diagnostics({ stage: 'database_transaction_commit', outcome: 'success' });
    } catch (error) {
      diagnostics({ stage, outcome: 'failure', exceptionType: safeRegistrationExceptionType(error) });
      if (this.isUniqueViolation(error)) throw new ConflictException('An account could not be created.');
      throw error;
    }
    diagnostics({ stage: 'email_provider_called', outcome: 'success' });
    await this.deliverVerificationEmail(delivery, diagnostics);
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
      return { userId: user.id, email: user.emailNormalized, firstName: user.firstName, token, expiresAt };
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
    return { user: safeUser(user, true), token };
  }

  /** Resolves a validated provider identity into the existing User → Identity → Session model. */
  async authenticateGoogle(identity: ExternalIdentity, diagnostics: OidcDiagnosticReporter = noOidcDiagnostics): Promise<{ user: AuthenticatedUserResponse; token: string }> {
    if (identity.provider !== 'GOOGLE' || identity.issuer !== 'https://accounts.google.com' || !identity.emailVerified || identity.providerSubject.trim() === '') {
      throw new BadRequestException({ code: 'OIDC_IDENTITY_INVALID' });
    }
    const normalizedEmail = normalizeEmail(identity.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new BadRequestException({ code: 'OIDC_IDENTITY_INVALID' });

    const sessionToken = newToken();
    const now = new Date();
    let stage: OidcDiagnosticStage = 'user_identity_lookup';
    try {
      const result = await this.db.transaction(async (tx) => {
        await tx.execute(sql.raw(`set local lock_timeout = '${googleIdentityLockTimeoutMs}ms'`));
        await tx.execute(sql.raw(`set local statement_timeout = '${googleIdentityStatementTimeoutMs}ms'`));
        const [existingIdentity] = await tx.select().from(authenticationIdentities).where(and(
          eq(authenticationIdentities.provider, 'GOOGLE'),
          eq(authenticationIdentities.providerSubject, identity.providerSubject),
        ));
        diagnostics({ stage: 'user_identity_lookup', outcome: 'success' });

        let user;
        let identityCreated = false;
        let identityLinked = false;
        stage = 'user_account_resolution';
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
            [user] = await tx.insert(users).values({
              firstName: this.normalizeOptionalName(identity.firstName),
              lastName: this.normalizeOptionalName(identity.lastName),
              emailNormalized: normalizedEmail,
              passwordHash: null,
              emailVerifiedAt: now,
            }).returning();
            if (user === undefined) throw new Error('Google user creation failed.');
            identityCreated = true;
          }
          stage = 'identity_persistence';
          await tx.insert(authenticationIdentities).values({
            userId: user.id,
            provider: 'GOOGLE',
            providerSubject: identity.providerSubject,
            providerEmail: normalizedEmail,
          });
          diagnostics({ stage: 'identity_persistence', outcome: 'success' });
        }
        diagnostics({ stage: 'user_account_resolution', outcome: 'success' });

        stage = 'session_creation';
        await tx.insert(sessions).values({
          userId: user.id,
          tokenHash: hashToken(sessionToken),
          expiresAt: new Date(Date.now() + this.config.session.lifetimeSeconds * 1000),
        });
        if (identityCreated) await tx.insert(auditLogs).values({ actorUserId: user.id, action: 'auth.google_identity_created', targetType: 'user', targetId: user.id, metadata: { provider: 'GOOGLE' } });
        if (identityLinked) await tx.insert(auditLogs).values({ actorUserId: user.id, action: 'auth.google_identity_linked', targetType: 'user', targetId: user.id, metadata: { provider: 'GOOGLE' } });
        await tx.insert(auditLogs).values({ actorUserId: user.id, action: 'auth.google_login_succeeded', targetType: 'user', targetId: user.id, metadata: { provider: 'GOOGLE' } });
        return { user: safeUser(user, user.passwordHash !== null), token: sessionToken };
      });
      diagnostics({ stage: 'user_identity_resolution', outcome: 'success' });
      diagnostics({ stage: 'session_creation', outcome: 'success' });
      return result;
    } catch (error) {
      diagnostics({ stage, outcome: 'failure', exceptionType: safeExceptionType(error) });
      if (this.isDatabaseTransactionTimeout(error)) {
        throw new ServiceUnavailableException({ code: 'DEPENDENCY_UNAVAILABLE' });
      }
      throw error;
    }
  }

  async current(token: string | undefined): Promise<AuthenticatedUserResponse> {
    const user = await this.resolveSession(token);
    if (user === undefined) throw new UnauthorizedException();
    return safeUser(user, user.passwordAuthenticationEnabled);
  }

  async updateProfile(token: string | undefined, firstNameValue: unknown, lastNameValue: unknown): Promise<AuthenticatedUserResponse> {
    const actor = await this.resolveSession(token);
    if (actor === undefined) throw new UnauthorizedException();
    const firstName = this.normalizeRequiredName(firstNameValue);
    const lastName = this.normalizeRequiredName(lastNameValue);
    const now = new Date();

    return this.db.transaction(async (tx) => {
      const [user] = await tx.update(users).set({ firstName, lastName, updatedAt: now }).where(eq(users.id, actor.id)).returning();
      if (user === undefined) throw new UnauthorizedException();
      await tx.insert(auditLogs).values({
        actorUserId: actor.id,
        action: 'auth.profile_updated',
        targetType: 'user',
        targetId: actor.id,
        metadata: { fields: ['firstName', 'lastName'] },
      });
      return safeUser(user, user.passwordHash !== null);
    });
  }

  async changePassword(
    token: string | undefined,
    currentPassword: unknown,
    newPassword: unknown,
  ): Promise<{ readonly user: AuthenticatedUserResponse; readonly token: string }> {
    const actor = await this.resolveSession(token);
    if (actor === undefined) throw new UnauthorizedException();
    if (typeof currentPassword !== 'string' || currentPassword.length === 0 || currentPassword.length > 256) {
      throw new UnauthorizedException({ code: 'CURRENT_PASSWORD_INVALID' });
    }
    this.assertPassword(newPassword);

    const [existingUser] = await this.db.select().from(users).where(eq(users.id, actor.id));
    if (existingUser === undefined) throw new UnauthorizedException();
    if (existingUser.passwordHash === null) throw new BadRequestException({ code: 'PASSWORD_CHANGE_UNAVAILABLE' });
    if (!(await this.passwords.verify(existingUser.passwordHash, currentPassword))) {
      throw new UnauthorizedException({ code: 'CURRENT_PASSWORD_INVALID' });
    }

    const passwordHash = await this.passwords.hash(newPassword);
    const replacementToken = newToken();
    const now = new Date();
    return this.db.transaction(async (tx) => {
      const [lockedUser] = await tx.select().from(users).where(eq(users.id, actor.id)).for('update');
      if (lockedUser === undefined) throw new UnauthorizedException();
      if (lockedUser.passwordHash !== existingUser.passwordHash) {
        throw new UnauthorizedException({ code: 'CURRENT_PASSWORD_INVALID' });
      }
      const [user] = await tx.update(users).set({ passwordHash, updatedAt: now }).where(eq(users.id, actor.id)).returning();
      if (user === undefined) throw new UnauthorizedException();
      await tx.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.userId, actor.id), isNull(sessions.revokedAt)));
      await tx.insert(sessions).values({
        userId: actor.id,
        tokenHash: hashToken(replacementToken),
        expiresAt: new Date(now.getTime() + this.config.session.lifetimeSeconds * 1000),
      });
      await tx.insert(auditLogs).values({ actorUserId: actor.id, action: 'auth.password_changed', targetType: 'user', targetId: actor.id, metadata: {} });
      return { user: safeUser(user, true), token: replacementToken };
    });
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
      return { user: safeUser(user, user.passwordHash !== null), sessionToken };
    });
  }

  async forgotPassword(email: string): Promise<{ token?: string }> {
    const normalized = normalizeEmail(email);
    if (!validEmail(normalized)) throw new BadRequestException('Invalid email address.');
    await this.assertEmailProviderAvailable();

    const delivery = await this.db.transaction(async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.emailNormalized, normalized)).for('update');
      if (user === undefined || user.passwordHash === null) return undefined;

      const token = newToken();
      const expiresAt = new Date(Date.now() + resetLifetimeMs);
      await tx.insert(passwordResetTokens).values({ userId: user.id, tokenHash: hashToken(token), expiresAt });
      await tx.insert(auditLogs).values({ actorUserId: user.id, action: 'auth.password_reset_requested', targetType: 'user', targetId: user.id, metadata: {} });
      return { userId: user.id, email: user.emailNormalized, token, expiresAt };
    });

    if (delivery === undefined) return {};
    await this.deliverPasswordResetEmail(delivery);
    return { token: delivery.token };
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

  private async deliverVerificationEmail(
    delivery: VerificationDelivery,
    diagnostics: RegistrationDiagnosticReporter = noRegistrationDiagnostics,
  ): Promise<void> {
    try {
      await this.emailProvider.sendVerificationEmail({
        to: delivery.email,
        firstName: delivery.firstName,
        verificationUrl: this.verificationUrl(delivery.token),
        expiresAt: delivery.expiresAt,
      }, diagnostics);
    } catch {
      await this.db.insert(auditLogs).values({ actorUserId: delivery.userId, action: 'auth.verification_email_delivery_failed', targetType: 'user', targetId: delivery.userId, metadata: {} });
      throw new ServiceUnavailableException({ code: 'DEPENDENCY_UNAVAILABLE' });
    }
    await this.db.insert(auditLogs).values({ actorUserId: delivery.userId, action: 'auth.verification_email_delivered', targetType: 'user', targetId: delivery.userId, metadata: {} });
  }
  private async deliverPasswordResetEmail(delivery: PasswordResetDelivery): Promise<void> {
    try {
      await this.emailProvider.sendPasswordResetEmail({
        to: delivery.email,
        passwordResetUrl: this.passwordResetUrl(delivery.token),
        expiresAt: delivery.expiresAt,
      });
    } catch {
      // Keep the public recovery result generic: delivery must not reveal account eligibility.
      await this.db.insert(auditLogs).values({ actorUserId: delivery.userId, action: 'auth.password_reset_email_delivery_failed', targetType: 'user', targetId: delivery.userId, metadata: {} });
      return;
    }
    await this.db.insert(auditLogs).values({ actorUserId: delivery.userId, action: 'auth.password_reset_email_delivered', targetType: 'user', targetId: delivery.userId, metadata: {} });
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
  private passwordResetUrl(token: string): string {
    if (this.config.email.provider !== 'smtp') throw new ServiceUnavailableException({ code: 'DEPENDENCY_UNAVAILABLE' });
    const url = new URL('/reset-password', this.config.email.webAppUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }
  private async createSession(userId: string): Promise<string> { const token = newToken(); await this.db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + this.config.session.lifetimeSeconds * 1000) }); return token; }
  private async findRegisteredUser(email: string, diagnostics: RegistrationDiagnosticReporter) {
    try {
      const [user] = await this.db.select({ id: users.id }).from(users).where(eq(users.emailNormalized, email));
      diagnostics({ stage: 'existing_user_lookup', outcome: 'success' });
      return user;
    } catch (error) {
      diagnostics({ stage: 'existing_user_lookup', outcome: 'failure', exceptionType: safeRegistrationExceptionType(error) });
      throw error;
    }
  }
  private isDatabaseTransactionTimeout(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    if ('code' in error && (error.code === '55P03' || error.code === '57014')) return true;
    return 'cause' in error && this.isDatabaseTransactionTimeout(error.cause);
  }
  private async resolveSession(token: string | undefined) { return resolveAuthenticatedSession(this.db, token); }
  private normalizeRequiredName(value: unknown): string {
    if (typeof value !== 'string') throw new BadRequestException('Invalid registration details.');
    const normalized = value.trim();
    if (normalized.length === 0 || normalized.length > maximumNameLength) {
      throw new BadRequestException('Invalid registration details.');
    }
    return normalized;
  }
  private normalizeOptionalName(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized.length > 0 && normalized.length <= maximumNameLength ? normalized : null;
  }
  private assertCredentials(email: string, password: string): void { if (!validEmail(email)) throw new BadRequestException('Invalid registration details.'); this.assertPassword(password); }
  private assertPassword(password: unknown): asserts password is string {
    if (typeof password !== 'string' || password.length < 12 || password.length > 256) {
      throw new BadRequestException('Invalid registration details.');
    }
  }
  private isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    if ('code' in error && error.code === '23505') return true;
    return 'cause' in error && this.isUniqueViolation(error.cause);
  }
}

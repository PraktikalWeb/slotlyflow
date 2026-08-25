import { createHash, randomBytes } from 'node:crypto';

import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { AuthenticationConfig } from '@slotlyflow/config';
import { oauthAuthorizationStates, type SlotlyFlowDatabase } from '@slotlyflow/database';
import { and, eq, gt, isNull } from 'drizzle-orm';

import { AuthService } from '../auth.service.js';
import { AUTH_CONFIG, AUTH_DATABASE, OIDC_IDENTITY_PROVIDER } from '../auth.tokens.js';
import type { OidcIdentityProvider } from './oidc-identity-provider.js';

const authorizationLifetimeMs = 10 * 60 * 1000;
const hash = (value: string): string => createHash('sha256').update(value).digest('base64url');
const randomValue = (): string => randomBytes(32).toString('base64url');
const challengeFor = (verifier: string): string => createHash('sha256').update(verifier).digest('base64url');

export interface GoogleAuthorizationCookies {
  readonly nonce: string;
  readonly codeVerifier: string;
}

@Injectable()
export class OidcAuthenticationService {
  constructor(
    @Inject(AUTH_DATABASE) private readonly db: SlotlyFlowDatabase,
    @Inject(AUTH_CONFIG) private readonly config: AuthenticationConfig,
    @Inject(OIDC_IDENTITY_PROVIDER) private readonly provider: OidcIdentityProvider,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  async beginGoogleAuthorization(): Promise<{ authorizationUrl: string; state: string; cookies: GoogleAuthorizationCookies }> {
    this.assertConfigured();
    const state = randomValue();
    const nonce = randomValue();
    const codeVerifier = randomValue();
    const authorizationUrl = await this.provider.createAuthorizationUrl({
      state,
      nonce,
      codeChallenge: challengeFor(codeVerifier),
    });
    await this.db.insert(oauthAuthorizationStates).values({
      provider: 'GOOGLE',
      stateHash: hash(state),
      nonceHash: hash(nonce),
      codeVerifierHash: hash(codeVerifier),
      redirectUri: this.config.googleOidc?.redirectUri ?? '',
      expiresAt: new Date(Date.now() + authorizationLifetimeMs),
    });
    return { authorizationUrl, state, cookies: { nonce, codeVerifier } };
  }

  async completeGoogleAuthorization(query: unknown, cookies: { readonly nonce: string | undefined; readonly codeVerifier: string | undefined }): Promise<{ token: string }> {
    this.assertConfigured();
    const { state, code } = parseCallback(query);
    const nonce = requireCookie(cookies.nonce);
    const codeVerifier = requireCookie(cookies.codeVerifier);
    const now = new Date();
    const authorization = await this.db.transaction(async (tx) => {
      const [record] = await tx.select().from(oauthAuthorizationStates).where(and(
        eq(oauthAuthorizationStates.provider, 'GOOGLE'),
        eq(oauthAuthorizationStates.stateHash, hash(state)),
        isNull(oauthAuthorizationStates.usedAt),
        gt(oauthAuthorizationStates.expiresAt, now),
      ));
      if (record === undefined || record.redirectUri !== this.config.googleOidc?.redirectUri || record.nonceHash !== hash(nonce) || record.codeVerifierHash !== hash(codeVerifier)) {
        throw new BadRequestException({ code: 'OIDC_AUTHORIZATION_INVALID' });
      }
      const [consumed] = await tx.update(oauthAuthorizationStates)
        .set({ usedAt: now })
        .where(and(eq(oauthAuthorizationStates.id, record.id), isNull(oauthAuthorizationStates.usedAt)))
        .returning();
      if (consumed === undefined) throw new BadRequestException({ code: 'OIDC_AUTHORIZATION_INVALID' });
      return record;
    });
    // The provider validates issuer, audience, expiry, nonce, state, and PKCE before returning a normalized identity.
    const identity = await this.provider.exchangeAuthorizationCode({ code, state, nonce, codeVerifier });
    if (authorization.provider !== identity.provider) throw new BadRequestException({ code: 'OIDC_IDENTITY_INVALID' });
    return this.auth.authenticateGoogle(identity).then(({ token }) => ({ token }));
  }

  private assertConfigured(): void {
    if (!this.provider.isConfigured() || this.config.googleOidc === undefined) {
      throw new ServiceUnavailableException({ code: 'OIDC_PROVIDER_NOT_CONFIGURED' });
    }
  }
}

function parseCallback(query: unknown): { state: string; code: string } {
  if (typeof query !== 'object' || query === null || !('state' in query) || !('code' in query) || typeof query.state !== 'string' || typeof query.code !== 'string' || query.state.length < 32 || query.code.length === 0) {
    throw new BadRequestException({ code: 'OIDC_AUTHORIZATION_INVALID' });
  }
  return { state: query.state, code: query.code };
}

function requireCookie(value: string | undefined): string {
  if (value === undefined || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new BadRequestException({ code: 'OIDC_AUTHORIZATION_INVALID' });
  return value;
}

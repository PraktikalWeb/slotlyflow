import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { GoogleOidcConfig } from '@slotlyflow/config';
import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  discovery,
  type Configuration,
} from 'openid-client';

import type { ExternalIdentity, OidcIdentityProvider } from './oidc-identity-provider.js';

const googleIssuer = 'https://accounts.google.com';

/** Google-specific OIDC adapter. No provider token material leaves this boundary. */
@Injectable()
export class GoogleOidcIdentityProvider implements OidcIdentityProvider {
  readonly provider = 'GOOGLE' as const;
  private configuration: Promise<Configuration> | undefined;

  constructor(private readonly config: GoogleOidcConfig | undefined) {}

  isConfigured(): boolean {
    return this.config !== undefined;
  }

  async createAuthorizationUrl(input: { readonly state: string; readonly nonce: string; readonly codeChallenge: string }): Promise<string> {
    const config = await this.getConfiguration();
    return buildAuthorizationUrl(config, {
      redirect_uri: this.requireConfig().redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: input.state,
      nonce: input.nonce,
      code_challenge: input.codeChallenge,
      code_challenge_method: 'S256',
    }).toString();
  }

  async exchangeAuthorizationCode(input: {
    readonly code: string;
    readonly state: string;
    readonly nonce: string;
    readonly codeVerifier: string;
  }): Promise<ExternalIdentity> {
    const config = await this.getConfiguration();
    const callback = new URL(this.requireConfig().redirectUri);
    callback.searchParams.set('code', input.code);
    callback.searchParams.set('state', input.state);
    const result = await authorizationCodeGrant(config, callback, {
      expectedState: input.state,
      expectedNonce: input.nonce,
      pkceCodeVerifier: input.codeVerifier,
    });
    const claims = result.claims();
    if (claims === undefined || typeof claims.sub !== 'string' || claims.sub.length === 0 || typeof claims.email !== 'string' || claims.email.length === 0 || claims.email_verified !== true) {
      throw new BadRequestException({ code: 'OIDC_IDENTITY_INVALID' });
    }
    return {
      provider: 'GOOGLE',
      providerSubject: claims.sub,
      email: claims.email,
      emailVerified: true,
      issuer: googleIssuer,
      ...(typeof claims.name === 'string' ? { displayName: claims.name } : {}),
    };
  }

  async calculateCodeChallenge(codeVerifier: string): Promise<string> {
    return calculatePKCECodeChallenge(codeVerifier);
  }

  private async getConfiguration(): Promise<Configuration> {
    this.configuration ??= discovery(
      new URL(googleIssuer),
      this.requireConfig().clientId,
      { client_secret: this.requireConfig().clientSecret },
    );
    return this.configuration;
  }

  private requireConfig(): GoogleOidcConfig {
    if (this.config === undefined) throw new ServiceUnavailableException({ code: 'OIDC_PROVIDER_NOT_CONFIGURED' });
    return this.config;
  }
}

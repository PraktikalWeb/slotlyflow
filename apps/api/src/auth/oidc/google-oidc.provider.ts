import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { GoogleOidcConfig } from '@slotlyflow/config';
import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  ClientError,
  discovery,
  ResponseBodyError,
  WWWAuthenticateChallengeError,
  type Configuration,
} from 'openid-client';

import { noOidcDiagnostics, safeExceptionType, type OidcDiagnosticReporter, type OidcDiagnosticStage } from './oidc-diagnostics.js';
import type { ExternalIdentity, OidcIdentityProvider } from './oidc-identity-provider.js';

const googleIssuer = 'https://accounts.google.com';
const maximumNameLength = 100;

function normalizedOptionalName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maximumNameLength ? normalized : undefined;
}

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
    readonly authorizationResponseIssuer?: string;
  }, diagnostics: OidcDiagnosticReporter = noOidcDiagnostics): Promise<ExternalIdentity> {
    const config = await this.getConfiguration();
    const callback = new URL(this.requireConfig().redirectUri);
    callback.searchParams.set('code', input.code);
    callback.searchParams.set('state', input.state);
    if (input.authorizationResponseIssuer !== undefined) {
      callback.searchParams.set('iss', input.authorizationResponseIssuer);
    }
    let result;
    try {
      result = await authorizationCodeGrant(config, callback, {
        expectedState: input.state,
        expectedNonce: input.nonce,
        pkceCodeVerifier: input.codeVerifier,
      });
    } catch (error) {
      const failure = classifyGrantFailure(error);
      for (const stage of failure.precedingSuccessfulStages) diagnostics({ stage, outcome: 'success' });
      diagnostics({ stage: failure.stage, outcome: 'failure', exceptionType: failure.exceptionType });
      throw error;
    }
    diagnostics({ stage: 'google_authorization_code_exchange', outcome: 'success' });
    diagnostics({ stage: 'google_token_response_validation', outcome: 'success' });
    diagnostics({ stage: 'issuer_validation', outcome: 'success' });
    diagnostics({ stage: 'audience_validation', outcome: 'success' });
    diagnostics({ stage: 'nonce_validation', outcome: 'success' });

    try {
      const claims = result.claims();
      if (claims === undefined || typeof claims.sub !== 'string' || claims.sub.length === 0 || typeof claims.email !== 'string' || claims.email.length === 0 || claims.email_verified !== true) {
        throw new BadRequestException({ code: 'OIDC_IDENTITY_INVALID' });
      }
      const firstName = normalizedOptionalName(claims.given_name);
      const lastName = normalizedOptionalName(claims.family_name);
      diagnostics({ stage: 'identity_normalization', outcome: 'success' });
      return {
        provider: 'GOOGLE',
        providerSubject: claims.sub,
        email: claims.email,
        emailVerified: true,
        issuer: googleIssuer,
        ...(firstName === undefined ? {} : { firstName }),
        ...(lastName === undefined ? {} : { lastName }),
      };
    } catch (error) {
      diagnostics({ stage: 'identity_normalization', outcome: 'failure', exceptionType: safeExceptionType(error) });
      throw error;
    }
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

interface GrantFailureClassification {
  readonly stage: OidcDiagnosticStage;
  readonly precedingSuccessfulStages: readonly OidcDiagnosticStage[];
  readonly exceptionType: string;
}

const exchangeSucceeded: readonly OidcDiagnosticStage[] = ['google_authorization_code_exchange'];
const responseValidated: readonly OidcDiagnosticStage[] = [...exchangeSucceeded, 'google_token_response_validation'];

function classifyGrantFailure(error: unknown): GrantFailureClassification {
  if (error instanceof ResponseBodyError) {
    const exceptionType = error.error === 'invalid_client'
      ? 'GoogleClientAuthenticationError'
      : error.error === 'invalid_grant'
        ? 'GoogleAuthorizationGrantError'
        : 'GoogleTokenEndpointResponseError';
    return { stage: 'google_authorization_code_exchange', precedingSuccessfulStages: [], exceptionType };
  }
  if (error instanceof WWWAuthenticateChallengeError) {
    return { stage: 'google_authorization_code_exchange', precedingSuccessfulStages: [], exceptionType: 'GoogleClientAuthenticationError' };
  }
  if (error instanceof ClientError && error.code === 'OAUTH_JWT_CLAIM_COMPARISON_FAILED') {
    const claim = claimName(error);
    if (claim === 'iss') return { stage: 'issuer_validation', precedingSuccessfulStages: responseValidated, exceptionType: safeExceptionType(error) };
    if (claim === 'aud' || claim === 'azp') return { stage: 'audience_validation', precedingSuccessfulStages: [...responseValidated, 'issuer_validation'], exceptionType: safeExceptionType(error) };
    if (claim === 'nonce') return { stage: 'nonce_validation', precedingSuccessfulStages: [...responseValidated, 'issuer_validation', 'audience_validation'], exceptionType: safeExceptionType(error) };
  }
  if (error instanceof ClientError && (error.code?.startsWith('OAUTH_JWT_') === true || error.code === 'OAUTH_KEY_SELECTION_FAILED')) {
    return { stage: 'google_token_response_validation', precedingSuccessfulStages: exchangeSucceeded, exceptionType: safeExceptionType(error) };
  }
  if (error instanceof ClientError) {
    return {
      stage: 'google_authorization_code_exchange',
      precedingSuccessfulStages: [],
      exceptionType: safeClientErrorType(error.code),
    };
  }
  return { stage: 'google_authorization_code_exchange', precedingSuccessfulStages: [], exceptionType: safeExceptionType(error) };
}

function safeClientErrorType(code: string | undefined): string {
  switch (code) {
    case 'ERR_INVALID_ARG_TYPE':
    case 'ERR_INVALID_ARG_VALUE':
      return 'OidcClientInputValidationError';
    case 'OAUTH_INVALID_RESPONSE':
      return 'GoogleAuthorizationResponseValidationError';
    case 'OAUTH_RESPONSE_IS_NOT_CONFORM':
      return 'GoogleTokenEndpointHttpError';
    case 'OAUTH_RESPONSE_IS_NOT_JSON':
    case 'OAUTH_PARSE_ERROR':
      return 'GoogleTokenResponseFormatError';
    case 'OAUTH_MISSING_SERVER_METADATA':
      return 'GoogleDiscoveryMetadataError';
    case 'OAUTH_TIMEOUT':
    case 'OAUTH_ABORT':
      return 'GoogleTokenEndpointNetworkError';
    default:
      return 'OidcClientError';
  }
}

function claimName(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== 'object' || current === null || !('cause' in current)) return undefined;
    current = current.cause;
    if (typeof current === 'object' && current !== null && 'claim' in current && typeof current.claim === 'string') return current.claim;
  }
  return undefined;
}

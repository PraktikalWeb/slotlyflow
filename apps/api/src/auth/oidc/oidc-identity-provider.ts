import type { OidcDiagnosticReporter } from './oidc-diagnostics.js';

/** Normalized boundary between SlotlyFlow authentication and an external OIDC provider. */
export interface ExternalIdentity {
  readonly provider: 'GOOGLE';
  readonly providerSubject: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly issuer: string;
  readonly firstName?: string;
  readonly lastName?: string;
  /** Legacy adapter field retained for compatibility; canonical persistence uses the split name fields. */
  readonly displayName?: string;
}

export interface OidcIdentityProvider {
  readonly provider: 'GOOGLE';
  isConfigured(): boolean;
  createAuthorizationUrl(input: {
    readonly state: string;
    readonly nonce: string;
    readonly codeChallenge: string;
  }): Promise<string>;
  exchangeAuthorizationCode(input: {
    readonly code: string;
    readonly state: string;
    readonly nonce: string;
    readonly codeVerifier: string;
    readonly authorizationResponseIssuer?: string;
  }, diagnostics?: OidcDiagnosticReporter): Promise<ExternalIdentity>;
}

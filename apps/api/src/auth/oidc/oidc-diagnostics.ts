export type OidcDiagnosticStage =
  | 'state_lookup'
  | 'state_consumption'
  | 'pkce_verifier_validation'
  | 'google_authorization_code_exchange'
  | 'google_token_response_validation'
  | 'issuer_validation'
  | 'audience_validation'
  | 'nonce_validation'
  | 'identity_normalization'
  | 'user_identity_lookup'
  | 'user_account_resolution'
  | 'identity_persistence'
  | 'user_identity_resolution'
  | 'session_creation'
  | 'final_redirect';

export type OidcDiagnosticEvent =
  | { readonly stage: OidcDiagnosticStage; readonly outcome: 'success' }
  | { readonly stage: OidcDiagnosticStage; readonly outcome: 'failure'; readonly exceptionType: string };

export type OidcDiagnosticReporter = (event: OidcDiagnosticEvent) => void;

export const noOidcDiagnostics: OidcDiagnosticReporter = () => undefined;

interface OidcDiagnosticLog {
  info(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
}

export function createOidcDiagnosticReporter(correlationId: string, log: OidcDiagnosticLog): OidcDiagnosticReporter {
  return (event) => {
    const fields = {
      correlation_id: correlationId,
      provider: 'GOOGLE',
      oidc_stage: event.stage,
      oidc_outcome: event.outcome,
      ...(event.outcome === 'failure' ? { exception_type: event.exceptionType } : {}),
    };
    if (event.outcome === 'failure') log.error(fields, 'OIDC stage failed');
    else log.info(fields, 'OIDC stage completed');
  };
}

/** Returns a class/type label only. Error messages and attached values are intentionally ignored. */
export function safeExceptionType(error: unknown): string {
  if (!(error instanceof Error)) return 'UnknownError';
  const type = error.constructor.name;
  return /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(type) ? type : 'UnknownError';
}

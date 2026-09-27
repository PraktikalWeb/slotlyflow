export type RegistrationStage =
  | 'register_request_received'
  | 'csrf_validation'
  | 'body_validation'
  | 'existing_user_lookup'
  | 'password_hashing'
  | 'user_insert'
  | 'verification_token_generation'
  | 'verification_token_insert'
  | 'database_transaction_commit'
  | 'email_provider_called'
  | 'email_configuration_resolved'
  | 'nodemailer_transporter_created'
  | 'smtp_connection_started'
  | 'smtp_connection_established'
  | 'smtp_greeting_received'
  | 'send_mail_started'
  | 'send_mail_completed'
  | 'controller_service_returned'
  | 'http_response_sent';

type SafeEmailConfigurationStatus = {
  readonly email_provider: 'smtp';
  readonly smtp_host_loaded: boolean;
  readonly smtp_port_loaded: boolean;
  readonly smtp_secure_loaded: boolean;
  readonly email_from_address_loaded: boolean;
  readonly email_from_name_loaded: boolean;
};

export type RegistrationDiagnosticEvent =
  | { readonly stage: RegistrationStage; readonly outcome: 'success' }
  | { readonly stage: RegistrationStage; readonly outcome: 'failure'; readonly exceptionType: string }
  | {
      readonly stage: 'email_configuration_resolved';
      readonly outcome: 'success';
      readonly configuration: SafeEmailConfigurationStatus;
    };

export type RegistrationDiagnosticReporter = (event: RegistrationDiagnosticEvent) => void;

export const noRegistrationDiagnostics: RegistrationDiagnosticReporter = () => undefined;

interface RegistrationDiagnosticLog {
  info(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
}

export function createRegistrationDiagnosticReporter(
  correlationId: string,
  log: RegistrationDiagnosticLog,
): RegistrationDiagnosticReporter {
  return (event) => {
    const fields = {
      correlation_id: correlationId,
      workflow: 'registration',
      registration_stage: event.stage,
      registration_outcome: event.outcome,
      ...('configuration' in event ? event.configuration : {}),
      ...(event.outcome === 'failure' ? { exception_type: event.exceptionType } : {}),
    };
    if (event.outcome === 'failure') log.error(fields, 'Registration stage failed');
    else log.info(fields, 'Registration stage completed');
  };
}

/** Returns a class/type label only. Error messages and attached values are intentionally ignored. */
export function safeRegistrationExceptionType(error: unknown): string {
  if (!(error instanceof Error)) return 'UnknownError';
  const type = error.constructor.name;
  return /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(type) ? type : 'UnknownError';
}

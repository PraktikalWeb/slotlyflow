import type { CoexistenceContactSyncFailureCategory } from './whatsapp-provider.js';

export type CoexistenceContactSyncEventName =
  | 'coexistence_contact_sync_request_started'
  | 'coexistence_contact_sync_request_accepted'
  | 'coexistence_contact_sync_request_already_attempted'
  | 'coexistence_contact_sync_request_failed';

export interface CoexistenceContactSyncDiagnosticEvent {
  readonly event: CoexistenceContactSyncEventName;
  readonly organizationId?: string;
  readonly connectionId?: string;
  readonly onboardingId?: string;
  readonly failureCategory?: CoexistenceContactSyncFailureCategory;
  readonly providerErrorCode?: string;
  readonly providerErrorSubcode?: string;
  readonly providerRequestId?: string;
}

export type CoexistenceContactSyncDiagnosticReporter = (
  event: CoexistenceContactSyncDiagnosticEvent,
) => void;

export const noCoexistenceContactSyncDiagnostics: CoexistenceContactSyncDiagnosticReporter = () => undefined;

interface CoexistenceContactSyncLog {
  info(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
}

export function createCoexistenceContactSyncDiagnosticReporter(
  correlationId: string,
  log: CoexistenceContactSyncLog,
): CoexistenceContactSyncDiagnosticReporter {
  return (event) => {
    const fields = {
      correlation_id: correlationId,
      provider: 'META',
      coexistence_contact_sync_event: event.event,
      ...(event.organizationId === undefined ? {} : { organization_id: event.organizationId }),
      ...(event.connectionId === undefined ? {} : { connection_id: event.connectionId }),
      ...(event.onboardingId === undefined ? {} : { onboarding_id: event.onboardingId }),
      ...(event.failureCategory === undefined ? {} : { failure_category: event.failureCategory }),
      ...(event.providerErrorCode === undefined ? {} : { provider_error_code: event.providerErrorCode }),
      ...(event.providerErrorSubcode === undefined ? {} : { provider_error_subcode: event.providerErrorSubcode }),
      ...(event.providerRequestId === undefined ? {} : { provider_request_id: event.providerRequestId }),
    };
    if (event.event === 'coexistence_contact_sync_request_failed') {
      log.error(fields, 'Coexistence Contact sync request failed');
    } else {
      log.info(fields, 'Coexistence Contact sync request stage completed');
    }
  };
}

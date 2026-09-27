import type { CoexistenceContactSyncFailureCategory } from './whatsapp-provider.js';

export type CoexistenceHistorySyncEventName =
  | 'coexistence_history_sync_request_started'
  | 'coexistence_history_sync_request_accepted'
  | 'coexistence_history_sync_request_already_attempted'
  | 'coexistence_history_sync_request_declined'
  | 'coexistence_history_sync_request_failed'
  | 'coexistence_history_sync_webhook_received'
  | 'coexistence_history_sync_webhook_processed';

export interface CoexistenceHistorySyncDiagnosticEvent {
  readonly event: CoexistenceHistorySyncEventName;
  readonly organizationId?: string;
  readonly connectionId?: string;
  readonly onboardingId?: string;
  readonly failureCategory?: CoexistenceContactSyncFailureCategory;
  readonly providerErrorCode?: string;
  readonly providerErrorSubcode?: string;
  readonly providerRequestId?: string;
  readonly entriesReceived?: number;
  readonly threadsExamined?: number;
  readonly validUniqueIdentities?: number;
  readonly contactsCreated?: number;
  readonly contactsExisting?: number;
  readonly contactsSkipped?: number;
}

export type CoexistenceHistorySyncDiagnosticReporter = (
  event: CoexistenceHistorySyncDiagnosticEvent,
) => void;

export const noCoexistenceHistorySyncDiagnostics: CoexistenceHistorySyncDiagnosticReporter = () => undefined;

interface CoexistenceHistorySyncLog {
  info(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
}

/** Bounded history-sync diagnostics; identities, message content, and raw payloads are deliberately absent. */
export function createCoexistenceHistorySyncDiagnosticReporter(
  correlationId: string,
  log: CoexistenceHistorySyncLog,
): CoexistenceHistorySyncDiagnosticReporter {
  return (event) => {
    const fields = {
      correlation_id: correlationId,
      provider: 'META',
      coexistence_history_sync_event: event.event,
      ...(event.organizationId === undefined ? {} : { organization_id: event.organizationId }),
      ...(event.connectionId === undefined ? {} : { connection_id: event.connectionId }),
      ...(event.onboardingId === undefined ? {} : { onboarding_id: event.onboardingId }),
      ...(event.failureCategory === undefined ? {} : { failure_category: event.failureCategory }),
      ...(event.providerErrorCode === undefined ? {} : { provider_error_code: event.providerErrorCode }),
      ...(event.providerErrorSubcode === undefined ? {} : { provider_error_subcode: event.providerErrorSubcode }),
      ...(event.providerRequestId === undefined ? {} : { provider_request_id: event.providerRequestId }),
      ...(event.entriesReceived === undefined ? {} : { entries_received: event.entriesReceived }),
      ...(event.threadsExamined === undefined ? {} : { history_threads_examined: event.threadsExamined }),
      ...(event.validUniqueIdentities === undefined ? {} : { valid_unique_identities: event.validUniqueIdentities }),
      ...(event.contactsCreated === undefined ? {} : { contacts_created: event.contactsCreated }),
      ...(event.contactsExisting === undefined ? {} : { contacts_existing: event.contactsExisting }),
      ...(event.contactsSkipped === undefined ? {} : { contacts_skipped: event.contactsSkipped }),
    };
    if (event.event === 'coexistence_history_sync_request_failed') {
      log.error(fields, 'Coexistence history sync request failed');
    } else {
      log.info(fields, 'Coexistence history sync stage completed');
    }
  };
}

export type ContactDiagnosticEventName =
  | 'coexistence_contact_sync_received'
  | 'coexistence_contact_created'
  | 'coexistence_contact_existing'
  | 'coexistence_contact_updated_as_saved'
  | 'coexistence_contact_skipped'
  | 'coexistence_contact_sync_processed'
  | 'coexistence_history_sync_received'
  | 'coexistence_history_contact_created'
  | 'coexistence_history_contact_existing'
  | 'coexistence_history_contact_skipped'
  | 'coexistence_history_sync_processed'
  | 'inbound_contact_created'
  | 'inbound_contact_existing'
  | 'inbound_contact_skipped';

export interface ContactDiagnosticEvent {
  readonly event: ContactDiagnosticEventName;
  readonly organizationId?: string;
  readonly connectionId?: string;
  readonly entriesReceived?: number;
  readonly created?: number;
  readonly existing?: number;
  readonly updatedAsSaved?: number;
  readonly skipped?: number;
  readonly reason?: 'IDENTITY_INVALID' | 'ENTITY_UNSUPPORTED' | 'ACTION_UNSUPPORTED' | 'CONNECTION_UNKNOWN';
}

export type ContactDiagnosticReporter = (event: ContactDiagnosticEvent) => void;

export const noContactDiagnostics: ContactDiagnosticReporter = () => undefined;

interface ContactLog {
  info(fields: Record<string, unknown>, message: string): void;
}

/** Bounded request diagnostics; customer identities and payload contents are deliberately absent. */
export function createContactDiagnosticReporter(
  correlationId: string,
  log: ContactLog,
): ContactDiagnosticReporter {
  return (event) => {
    log.info({
      correlation_id: correlationId,
      provider: 'META',
      contact_event: event.event,
      ...(event.organizationId === undefined ? {} : { organization_id: event.organizationId }),
      ...(event.connectionId === undefined ? {} : { connection_id: event.connectionId }),
      ...(event.entriesReceived === undefined ? {} : { entries_received: event.entriesReceived }),
      ...(event.created === undefined ? {} : { contacts_created: event.created }),
      ...(event.existing === undefined ? {} : { contacts_existing: event.existing }),
      ...(event.updatedAsSaved === undefined ? {} : { contacts_updated_as_saved: event.updatedAsSaved }),
      ...(event.skipped === undefined ? {} : { contacts_skipped: event.skipped }),
      ...(event.reason === undefined ? {} : { skip_reason: event.reason }),
    }, 'WhatsApp Contact ingestion stage completed');
  };
}

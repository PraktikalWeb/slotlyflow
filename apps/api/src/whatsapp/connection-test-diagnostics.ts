export type ConnectionTestDiagnosticEventName =
  | 'connection_test_message_received'
  | 'connection_test_reply_requested'
  | 'connection_test_reply_meta_request_started'
  | 'connection_test_reply_meta_accepted'
  | 'connection_test_reply_failed'
  | 'connection_test_passed';

export interface ConnectionTestDiagnosticEvent {
  readonly event: ConnectionTestDiagnosticEventName;
  readonly organizationId?: string;
  readonly connectionId?: string;
  readonly connectionTestId?: string;
  readonly inboundProviderMessageId?: string;
  readonly outboundProviderMessageId?: string;
  readonly resultClassification?: string;
  readonly providerErrorCode?: string;
}

export type ConnectionTestDiagnosticReporter = (event: ConnectionTestDiagnosticEvent) => void;

export const noConnectionTestDiagnostics: ConnectionTestDiagnosticReporter = () => undefined;

interface ConnectionTestLog {
  info(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
}

/** Request-correlated diagnostics containing identifiers only, never numbers, text, or credentials. */
export function createConnectionTestDiagnosticReporter(
  correlationId: string,
  log: ConnectionTestLog,
): ConnectionTestDiagnosticReporter {
  return (event) => {
    const fields = {
      correlation_id: correlationId,
      provider: 'META',
      connection_test_event: event.event,
      ...(event.organizationId === undefined ? {} : { organization_id: event.organizationId }),
      ...(event.connectionId === undefined ? {} : { connection_id: event.connectionId }),
      ...(event.connectionTestId === undefined ? {} : { connection_test_id: event.connectionTestId }),
      ...(event.inboundProviderMessageId === undefined ? {} : { inbound_provider_message_id: event.inboundProviderMessageId }),
      ...(event.outboundProviderMessageId === undefined ? {} : { outbound_provider_message_id: event.outboundProviderMessageId }),
      ...(event.resultClassification === undefined ? {} : { result_classification: event.resultClassification }),
      ...(event.providerErrorCode === undefined ? {} : { provider_error_code: event.providerErrorCode }),
    };
    if (event.event === 'connection_test_reply_failed') log.error(fields, 'WhatsApp Connection Test reply failed');
    else log.info(fields, 'WhatsApp Connection Test stage completed');
  };
}

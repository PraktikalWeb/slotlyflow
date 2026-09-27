export type WabaSubscriptionEventName =
  | 'waba_subscription_check_started'
  | 'waba_subscription_already_present'
  | 'waba_subscription_requested'
  | 'waba_subscription_succeeded'
  | 'waba_subscription_failed';

export type WabaSubscriptionFailureCategory =
  | 'AUTHORIZATION'
  | 'WABA_ACCESS'
  | 'TRANSIENT'
  | 'CONFIGURATION';

export interface WabaSubscriptionDiagnosticEvent {
  readonly event: WabaSubscriptionEventName;
  readonly organizationId?: string;
  readonly connectionId?: string;
  readonly failureCategory?: WabaSubscriptionFailureCategory;
  readonly providerErrorCode?: string;
}

export type WabaSubscriptionDiagnosticReporter = (event: WabaSubscriptionDiagnosticEvent) => void;

export const noWabaSubscriptionDiagnostics: WabaSubscriptionDiagnosticReporter = () => undefined;

interface WabaSubscriptionLog {
  info(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
}

export function createWabaSubscriptionDiagnosticReporter(
  correlationId: string,
  log: WabaSubscriptionLog,
): WabaSubscriptionDiagnosticReporter {
  return (event) => {
    const fields = {
      correlation_id: correlationId,
      provider: 'META',
      waba_subscription_event: event.event,
      ...(event.organizationId === undefined ? {} : { organization_id: event.organizationId }),
      ...(event.connectionId === undefined ? {} : { connection_id: event.connectionId }),
      ...(event.failureCategory === undefined ? {} : { failure_category: event.failureCategory }),
      ...(event.providerErrorCode === undefined ? {} : { provider_error_code: event.providerErrorCode }),
    };
    if (event.event === 'waba_subscription_failed') log.error(fields, 'WABA subscription failed');
    else log.info(fields, 'WABA subscription stage completed');
  };
}

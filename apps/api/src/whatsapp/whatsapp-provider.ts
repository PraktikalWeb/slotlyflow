import type { PreparedProviderCredential, ProviderCredentialReference } from './credential-store.js';
import type { VerifiedWhatsAppConnectionResult, WhatsAppProviderName } from './whatsapp-connection.types.js';
import type { WabaSubscriptionDiagnosticReporter, WabaSubscriptionFailureCategory } from './waba-subscription-diagnostics.js';
import type { CoexistenceContactSyncDiagnosticReporter } from './coexistence-contact-sync-diagnostics.js';
import type { CoexistenceHistorySyncDiagnosticReporter } from './coexistence-history-sync-diagnostics.js';

export type WhatsAppConnectionValidationResult =
  | {
      readonly outcome: 'VERIFIED';
      readonly externalWabaId: string;
      readonly externalPhoneNumberId: string;
      readonly displayPhoneNumber: string | null;
    }
  | { readonly outcome: 'DISCONNECTED'; readonly code: 'META_ASSET_UNAVAILABLE' }
  | { readonly outcome: 'NEEDS_REAUTH'; readonly code: 'META_AUTHORIZATION_REJECTED' | 'META_CREDENTIAL_EXPIRED' }
  | { readonly outcome: 'CONFLICT'; readonly code: 'META_IDENTITY_CONFLICT' }
  | {
      readonly outcome: 'CHECK_FAILED';
      readonly code: 'CREDENTIAL_UNAVAILABLE' | 'META_RATE_LIMITED' | 'META_RESPONSE_INVALID' | 'META_UNAVAILABLE';
    };

export type WabaSubscriptionResult = {
  readonly outcome: 'ALREADY_SUBSCRIBED' | 'SUBSCRIBED';
};

export type CoexistenceContactSyncResult = {
  readonly outcome: 'REQUESTED';
  readonly providerRequestId: string;
};

export type CoexistenceHistorySyncResult = CoexistenceContactSyncResult;

export type CoexistenceContactSyncFailureCategory =
  | 'AUTHORIZATION'
  | 'ELIGIBILITY_OR_PERMISSION'
  | 'PROVIDER_REJECTED'
  | 'TRANSIENT'
  | 'CONFIGURATION';

export class CoexistenceContactSyncError extends Error {
  constructor(
    readonly category: CoexistenceContactSyncFailureCategory,
    readonly providerErrorCode: string,
    readonly providerErrorSubcode?: string,
    readonly reauthenticationCode?: 'META_AUTHORIZATION_REJECTED' | 'META_CREDENTIAL_EXPIRED',
  ) {
    super('The Coexistence Contact sync request could not be completed.');
    this.name = 'CoexistenceContactSyncError';
  }
}

export class CoexistenceHistorySyncError extends Error {
  constructor(
    readonly category: CoexistenceContactSyncFailureCategory,
    readonly providerErrorCode: string,
    readonly providerErrorSubcode?: string,
    readonly reauthenticationCode?: 'META_AUTHORIZATION_REJECTED' | 'META_CREDENTIAL_EXPIRED',
  ) {
    super('The Coexistence history sync request could not be completed.');
    this.name = 'CoexistenceHistorySyncError';
  }
}

export class WhatsAppWebhookSubscriptionError extends Error {
  constructor(
    readonly category: WabaSubscriptionFailureCategory,
    readonly providerErrorCode: string,
    readonly reauthenticationCode?: 'META_AUTHORIZATION_REJECTED' | 'META_CREDENTIAL_EXPIRED',
  ) {
    super('The WhatsApp webhook subscription could not be ensured.');
    this.name = 'WhatsAppWebhookSubscriptionError';
  }
}

/**
 * SlotlyFlow-owned provider boundary for future connection onboarding only.
 * Provider implementations normalize raw callback/provider responses before
 * returning this result to the application service.
 */
export interface WhatsAppConnectionProvider {
  readonly provider: WhatsAppProviderName;
  completeExistingBusinessAppConnection(completion: {
    readonly authorizationCode: string;
    readonly phoneNumberIdHint: string | null;
    readonly whatsappBusinessAccountIdHint: string | null;
  }): Promise<{ readonly connection: Omit<VerifiedWhatsAppConnectionResult, 'credentialReference'>; readonly credential: PreparedProviderCredential }>;
  validateExistingConnection(input: {
    readonly credentialReference: ProviderCredentialReference;
    readonly expectedWabaId: string;
    readonly expectedPhoneNumberId: string;
  }): Promise<WhatsAppConnectionValidationResult>;
  ensureWabaSubscribedToApp?(input: {
    readonly credentialReference: ProviderCredentialReference;
    readonly expectedWabaId: string;
  }, diagnostics?: WabaSubscriptionDiagnosticReporter): Promise<WabaSubscriptionResult>;
  requestCoexistenceContactSync?(input: {
    readonly credentialReference: ProviderCredentialReference;
    readonly expectedPhoneNumberId: string;
  }, diagnostics?: CoexistenceContactSyncDiagnosticReporter): Promise<CoexistenceContactSyncResult>;
  requestCoexistenceHistorySync?(input: {
    readonly credentialReference: ProviderCredentialReference;
    readonly expectedPhoneNumberId: string;
  }, diagnostics?: CoexistenceHistorySyncDiagnosticReporter): Promise<CoexistenceHistorySyncResult>;
}

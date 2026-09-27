import type { ProviderCredentialReference } from './credential-store.js';
import type { WhatsAppProviderName } from './whatsapp-connection.types.js';

/** Provider-neutral request assembled only from trusted persisted state. */
export interface OutboundWhatsAppTextMessage {
  readonly senderPhoneNumberId: string;
  readonly recipientWhatsAppId: string;
  readonly credentialReference: ProviderCredentialReference;
  readonly text: string;
}

export interface OutboundWhatsAppReplyOption {
  readonly id: string;
  readonly label: string;
}

/** Provider-neutral reply-button message assembled from reviewed Bot output. */
export interface OutboundWhatsAppInteractiveMessage {
  readonly senderPhoneNumberId: string;
  readonly recipientWhatsAppId: string;
  readonly credentialReference: ProviderCredentialReference;
  readonly body: string;
  readonly options: readonly OutboundWhatsAppReplyOption[];
}

/** Safe normalized outcome; raw provider responses never leave an adapter. */
export interface OutboundWhatsAppMessageResult {
  readonly providerMessageId: string;
  readonly acceptedAt: Date;
}

export interface WhatsAppMessagingProvider {
  readonly provider: WhatsAppProviderName;
  sendText(message: OutboundWhatsAppTextMessage): Promise<OutboundWhatsAppMessageResult>;
  sendInteractive?(message: OutboundWhatsAppInteractiveMessage): Promise<OutboundWhatsAppMessageResult>;
}

export type WhatsAppMessagingProviderFailureKind =
  | 'CREDENTIAL_INVALID'
  | 'REJECTED'
  | 'UNAVAILABLE'
  | 'OUTCOME_UNKNOWN';

/** Deliberately safe classification; never carry Graph payloads or token material. */
export class WhatsAppMessagingProviderError extends Error {
  constructor(
    readonly kind: WhatsAppMessagingProviderFailureKind,
    readonly providerErrorCode?: string,
  ) {
    super('WhatsApp messaging provider operation failed.');
    this.name = 'WhatsAppMessagingProviderError';
  }
}

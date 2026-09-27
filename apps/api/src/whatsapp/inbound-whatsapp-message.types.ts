import type { WhatsAppProviderName } from './whatsapp-connection.types.js';

export type InboundWhatsAppMessageType = 'TEXT' | 'INTERACTIVE_REPLY' | 'UNSUPPORTED';

/**
 * Provider-neutral inbound message contract. Meta JSON is normalized before it
 * enters application/persistence code so future providers do not leak their
 * webhook shapes into SlotlyFlow's domain.
 */
export interface InboundWhatsAppMessage {
  readonly provider: WhatsAppProviderName;
  readonly providerMessageId: string;
  readonly destinationPhoneNumberId: string;
  readonly customerWhatsAppId: string;
  readonly customerDisplayName: string | null;
  readonly occurredAt: Date;
  readonly messageType: InboundWhatsAppMessageType;
  readonly textBody: string | null;
  readonly interactiveOptionId?: string | null;
}

export type InboundMessagePersistenceResult =
  | {
    readonly outcome: 'stored';
    readonly organizationId: string;
    readonly connectionId: string;
    readonly conversationId: string;
    readonly inboundMessageId: string;
    readonly customerWhatsAppId: string;
  }
  | {
    readonly outcome: 'duplicate';
    readonly organizationId: string;
    readonly connectionId: string;
  }
  | { readonly outcome: 'unknown_connection' };

import type { WhatsAppProviderName } from './whatsapp-connection.types.js';

/** A provider-normalized outbound message sent from the Business app. */
export interface HumanBusinessAppMessage {
  readonly provider: WhatsAppProviderName;
  readonly providerMessageId: string;
  readonly wabaId: string;
  readonly destinationPhoneNumberId: string;
  readonly customerWhatsAppId: string;
  readonly occurredAt: Date;
  readonly messageType: 'TEXT' | 'UNSUPPORTED';
  readonly textBody: string | null;
}

export type HumanBusinessAppPersistenceResult =
  | { readonly outcome: 'stored'; readonly organizationId: string; readonly connectionId: string; readonly conversationId: string; readonly handoverActive: boolean }
  | { readonly outcome: 'duplicate' }
  | { readonly outcome: 'unknown_connection' }
  | { readonly outcome: 'unknown_conversation' };

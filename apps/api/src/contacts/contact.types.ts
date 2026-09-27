import type { WhatsAppProviderName } from '../whatsapp/whatsapp-connection.types.js';

export type ContactOrigin = 'COEXISTENCE' | 'INBOUND_MESSAGE';

/** Provider-neutral identity accepted by the Contacts application boundary. */
export interface ContactIdentityInput {
  readonly provider: WhatsAppProviderName;
  readonly destinationPhoneNumberId: string;
  readonly whatsappId: string;
  readonly phoneNumber: string;
  readonly origin: ContactOrigin;
  readonly isSavedContact: boolean;
}

export interface CoexistenceContactIdentity {
  readonly provider: 'META';
  readonly destinationPhoneNumberId: string;
  readonly whatsappId: string;
  readonly phoneNumber: string;
}

export type ContactPersistenceResult =
  | { readonly outcome: 'unknown_connection' }
  | {
      readonly outcome: 'created' | 'existing';
      readonly organizationId: string;
      readonly connectionId: string;
    };

export interface ContactBatchPersistenceResult {
  readonly created: number;
  readonly existing: number;
  readonly updatedAsSaved: number;
  readonly skipped: number;
}

export type ContactBatchRepositoryResult =
  | (ContactBatchPersistenceResult & {
      readonly outcome: 'unknown_connection';
    })
  | (ContactBatchPersistenceResult & {
      readonly outcome: 'persisted';
      readonly organizationId: string;
      readonly connectionId: string;
    });

import { Inject, Injectable } from '@nestjs/common';

import type { InboundWhatsAppMessage } from '../whatsapp/inbound-whatsapp-message.types.js';
import { DrizzleContactRepository } from './contact.repository.js';
import {
  noContactDiagnostics,
  type ContactDiagnosticReporter,
} from './contact-diagnostics.js';
import type {
  CoexistenceContactIdentity,
  ContactBatchPersistenceResult,
  ContactPersistenceResult,
} from './contact.types.js';
import { normalizeWhatsAppContactIdentity } from './whatsapp-contact-identity.js';

@Injectable()
export class ContactService {
  constructor(@Inject(DrizzleContactRepository) private readonly contacts: DrizzleContactRepository) {}

  async ingestCoexistenceContacts(
    identities: readonly CoexistenceContactIdentity[],
    diagnostics: ContactDiagnosticReporter = noContactDiagnostics,
  ): Promise<ContactBatchPersistenceResult> {
    let created = 0;
    let existing = 0;
    let updatedAsSaved = 0;
    let skipped = 0;

    const groups = groupCoexistenceIdentities(identities);
    for (const group of groups.values()) {
      const result = await this.contacts.upsertManyForVerifiedConnection({
        provider: group.provider,
        destinationPhoneNumberId: group.destinationPhoneNumberId,
        contacts: [...group.identities.values()].map((identity) => ({
          ...identity,
          origin: 'COEXISTENCE' as const,
          isSavedContact: true,
        })),
      });
      if (result.outcome === 'persisted') {
        const repeatedInBatch = group.received - group.identities.size;
        created += result.created;
        existing += result.existing + repeatedInBatch;
        updatedAsSaved += result.updatedAsSaved;
        if (result.created > 0) diagnostics({ event: 'coexistence_contact_created', ...scope(result), created: result.created });
        if (result.existing + repeatedInBatch > 0) {
          diagnostics({ event: 'coexistence_contact_existing', ...scope(result), existing: result.existing + repeatedInBatch });
        }
        if (result.updatedAsSaved > 0) {
          diagnostics({ event: 'coexistence_contact_updated_as_saved', ...scope(result), updatedAsSaved: result.updatedAsSaved });
        }
      } else {
        skipped += group.received;
        diagnostics({ event: 'coexistence_contact_skipped', reason: 'CONNECTION_UNKNOWN', skipped: group.received });
      }
    }

    return { created, existing, updatedAsSaved, skipped };
  }

  async ingestCoexistenceHistoryContacts(
    identities: readonly CoexistenceContactIdentity[],
    diagnostics: ContactDiagnosticReporter = noContactDiagnostics,
  ): Promise<ContactBatchPersistenceResult> {
    let created = 0;
    let existing = 0;
    let skipped = 0;

    const groups = groupCoexistenceIdentities(identities);
    for (const group of groups.values()) {
      const result = await this.contacts.upsertManyForVerifiedConnection({
        provider: group.provider,
        destinationPhoneNumberId: group.destinationPhoneNumberId,
        contacts: [...group.identities.values()].map((identity) => ({
          ...identity,
          origin: 'COEXISTENCE' as const,
          isSavedContact: false,
        })),
      });
      if (result.outcome === 'persisted') {
        const repeatedInBatch = group.received - group.identities.size;
        created += result.created;
        existing += result.existing + repeatedInBatch;
        if (result.created > 0) diagnostics({ event: 'coexistence_history_contact_created', ...scope(result), created: result.created });
        if (result.existing + repeatedInBatch > 0) {
          diagnostics({ event: 'coexistence_history_contact_existing', ...scope(result), existing: result.existing + repeatedInBatch });
        }
      } else {
        skipped += group.received;
        diagnostics({ event: 'coexistence_history_contact_skipped', reason: 'CONNECTION_UNKNOWN', skipped: group.received });
      }
    }

    return { created, existing, updatedAsSaved: 0, skipped };
  }

  async ingestInboundSender(
    message: InboundWhatsAppMessage,
    diagnostics: ContactDiagnosticReporter = noContactDiagnostics,
  ): Promise<ContactPersistenceResult | undefined> {
    const identity = normalizeWhatsAppContactIdentity(message.customerWhatsAppId);
    if (identity === undefined) {
      diagnostics({ event: 'inbound_contact_skipped', reason: 'IDENTITY_INVALID' });
      return undefined;
    }

    const result = await this.contacts.upsertForVerifiedConnection({
      provider: message.provider,
      destinationPhoneNumberId: message.destinationPhoneNumberId,
      ...identity,
      origin: 'INBOUND_MESSAGE',
      isSavedContact: false,
    });
    if (result.outcome === 'created') diagnostics({ event: 'inbound_contact_created', ...scope(result) });
    else if (result.outcome === 'existing') diagnostics({ event: 'inbound_contact_existing', ...scope(result) });
    else diagnostics({ event: 'inbound_contact_skipped', reason: 'CONNECTION_UNKNOWN' });
    return result;
  }
}

interface CoexistenceIdentityGroup {
  readonly provider: 'META';
  readonly destinationPhoneNumberId: string;
  readonly identities: Map<string, Pick<CoexistenceContactIdentity, 'whatsappId' | 'phoneNumber'>>;
  received: number;
}

function groupCoexistenceIdentities(identities: readonly CoexistenceContactIdentity[]): Map<string, CoexistenceIdentityGroup> {
  const groups = new Map<string, CoexistenceIdentityGroup>();
  for (const identity of identities) {
    const key = `${identity.provider}:${identity.destinationPhoneNumberId}`;
    let group = groups.get(key);
    if (group === undefined) {
      group = {
        provider: identity.provider,
        destinationPhoneNumberId: identity.destinationPhoneNumberId,
        identities: new Map(),
        received: 0,
      };
      groups.set(key, group);
    }
    group.received += 1;
    if (!group.identities.has(identity.whatsappId)) {
      group.identities.set(identity.whatsappId, {
        whatsappId: identity.whatsappId,
        phoneNumber: identity.phoneNumber,
      });
    }
  }
  return groups;
}

function scope(result: { readonly organizationId?: string; readonly connectionId?: string }): { readonly organizationId?: string; readonly connectionId?: string } {
  return {
    ...(result.organizationId === undefined ? {} : { organizationId: result.organizationId }),
    ...(result.connectionId === undefined ? {} : { connectionId: result.connectionId }),
  };
}

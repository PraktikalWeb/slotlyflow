import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { contacts, type SlotlyFlowDatabase, whatsappConnections } from '@slotlyflow/database';

import { AUTH_DATABASE } from '../auth/auth.tokens.js';
import type {
  ContactBatchRepositoryResult,
  ContactIdentityInput,
  ContactPersistenceResult,
} from './contact.types.js';

const maximumInsertBatchSize = 250;

@Injectable()
export class DrizzleContactRepository {
  constructor(@Inject(AUTH_DATABASE) private readonly db: SlotlyFlowDatabase) {}

  /**
   * Resolves ownership from the stored connection and uses the database
   * uniqueness constraint as the final concurrent-delivery dedupe boundary.
   */
  async upsertForVerifiedConnection(input: ContactIdentityInput): Promise<ContactPersistenceResult> {
    const result = await this.upsertManyForVerifiedConnection({
      provider: input.provider,
      destinationPhoneNumberId: input.destinationPhoneNumberId,
      contacts: [{
        whatsappId: input.whatsappId,
        phoneNumber: input.phoneNumber,
        origin: input.origin,
        isSavedContact: input.isSavedContact,
      }],
    });
    if (result.outcome === 'unknown_connection') return { outcome: 'unknown_connection' };
    return {
      outcome: result.created === 1 ? 'created' : 'existing',
      organizationId: result.organizationId,
      connectionId: result.connectionId,
    };
  }

  async upsertManyForVerifiedConnection(input: {
    readonly provider: ContactIdentityInput['provider'];
    readonly destinationPhoneNumberId: string;
    readonly contacts: readonly Pick<ContactIdentityInput, 'whatsappId' | 'phoneNumber' | 'origin' | 'isSavedContact'>[];
  }): Promise<ContactBatchRepositoryResult> {
    return this.db.transaction(async (tx) => {
      const [connection] = await tx.select({
        id: whatsappConnections.id,
        organizationId: whatsappConnections.organizationId,
      }).from(whatsappConnections).where(and(
        eq(whatsappConnections.provider, input.provider),
        eq(whatsappConnections.externalPhoneNumberId, input.destinationPhoneNumberId),
        eq(whatsappConnections.connectionStatus, 'CONNECTED'),
      ));
      if (connection === undefined) return { outcome: 'unknown_connection', created: 0, existing: 0, updatedAsSaved: 0, skipped: input.contacts.length };

      let created = 0;
      let updatedAsSaved = 0;
      for (let offset = 0; offset < input.contacts.length; offset += maximumInsertBatchSize) {
        const batch = input.contacts.slice(offset, offset + maximumInsertBatchSize);
        if (batch.length === 0) continue;
        const existing = await tx.select({
          whatsappId: contacts.whatsappId,
          isSavedContact: contacts.isSavedContact,
        }).from(contacts).where(and(
          eq(contacts.organizationId, connection.organizationId),
          eq(contacts.whatsappConnectionId, connection.id),
          inArray(contacts.whatsappId, batch.map((contact) => contact.whatsappId)),
        ));
        const existingByWhatsAppId = new Map(existing.map((contact) => [contact.whatsappId, contact]));
        const upserted = await tx.insert(contacts).values(batch.map((contact) => ({
          organizationId: connection.organizationId,
          whatsappConnectionId: connection.id,
          whatsappId: contact.whatsappId,
          phoneNumber: contact.phoneNumber,
          origin: contact.origin,
          isSavedContact: contact.isSavedContact,
        }))).onConflictDoUpdate({
          target: [contacts.organizationId, contacts.whatsappConnectionId, contacts.whatsappId],
          set: {
            origin: sql`case when excluded.origin = 'COEXISTENCE'::contact_origin then 'COEXISTENCE'::contact_origin else ${contacts.origin} end`,
            isSavedContact: sql`${contacts.isSavedContact} or excluded.is_saved_contact`,
            updatedAt: sql`case
              when (${contacts.origin} <> 'COEXISTENCE'::contact_origin and excluded.origin = 'COEXISTENCE'::contact_origin)
                or (${contacts.isSavedContact} = false and excluded.is_saved_contact = true)
              then now()
              else ${contacts.updatedAt}
            end`,
          },
        }).returning({ id: contacts.id });
        created += batch.length - existing.length;
        updatedAsSaved += batch.filter((contact) => (
          contact.isSavedContact && existingByWhatsAppId.get(contact.whatsappId)?.isSavedContact === false
        )).length;
        if (upserted.length !== batch.length) throw new Error('Contact upsert did not return every identity.');
      }

      return {
        outcome: 'persisted',
        created,
        existing: input.contacts.length - created,
        updatedAsSaved,
        skipped: 0,
        organizationId: connection.organizationId,
        connectionId: connection.id,
      };
    });
  }

  async findInScope(input: {
    readonly organizationId: string;
    readonly whatsappConnectionId: string;
    readonly whatsappId: string;
  }): Promise<{ readonly id: string; readonly origin: ContactIdentityInput['origin'] } | undefined> {
    const [contact] = await this.db.select({ id: contacts.id, origin: contacts.origin }).from(contacts).where(and(
      eq(contacts.organizationId, input.organizationId),
      eq(contacts.whatsappConnectionId, input.whatsappConnectionId),
      eq(contacts.whatsappId, input.whatsappId),
    ));
    return contact;
  }
}

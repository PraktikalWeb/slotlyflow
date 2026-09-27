import { boolean, foreignKey, index, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { organizations } from './organizations.js';
import { whatsappConnections } from './whatsapp-connections.js';

export const contactOrigin = pgEnum('contact_origin', ['COEXISTENCE', 'INBOUND_MESSAGE']);

/**
 * A first-class customer identity known within one Business WhatsApp runtime.
 * Origin records the strongest acquisition provenance: Coexistence evidence
 * upgrades inbound-only evidence, while lower-precedence events never downgrade it.
 */
export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    whatsappConnectionId: uuid('whatsapp_connection_id').notNull(),
    whatsappId: varchar('whatsapp_id', { length: 64 }).notNull(),
    phoneNumber: varchar('phone_number', { length: 32 }).notNull(),
    origin: contactOrigin('origin').notNull(),
    isSavedContact: boolean('is_saved_contact').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: 'contacts_organization_connection_fkey',
      columns: [table.organizationId, table.whatsappConnectionId],
      foreignColumns: [whatsappConnections.organizationId, whatsappConnections.id],
    }).onDelete('restrict').onUpdate('cascade'),
    uniqueIndex('contacts_org_connection_whatsapp_id_unique').on(
      table.organizationId,
      table.whatsappConnectionId,
      table.whatsappId,
    ),
    index('contacts_organization_connection_created_idx').on(
      table.organizationId,
      table.whatsappConnectionId,
      table.createdAt,
    ),
  ],
);

import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { organizations } from './organizations.js';
import { whatsappConnections } from './whatsapp-connections.js';

/**
 * The smallest tenant-owned customer thread needed by the M3 inbound message
 * loop. A WhatsApp customer identity is intentionally unique only within the
 * connected Business number, never across SlotlyFlow Organizations.
 */
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    whatsappConnectionId: uuid('whatsapp_connection_id')
      .notNull()
      .references(() => whatsappConnections.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    customerWhatsAppId: varchar('customer_whatsapp_id', { length: 64 }).notNull(),
    customerDisplayName: varchar('customer_display_name', { length: 256 }),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('conversations_org_connection_customer_unique').on(
      table.organizationId,
      table.whatsappConnectionId,
      table.customerWhatsAppId,
    ),
    uniqueIndex('conversations_organization_id_id_unique').on(table.organizationId, table.id),
    uniqueIndex('conversations_execution_context_unique').on(
      table.organizationId,
      table.whatsappConnectionId,
      table.id,
    ),
    index('conversations_organization_last_message_idx').on(table.organizationId, table.lastMessageAt),
    index('conversations_connection_last_message_idx').on(table.whatsappConnectionId, table.lastMessageAt),
  ],
);

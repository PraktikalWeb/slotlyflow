import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar, text } from 'drizzle-orm/pg-core';

import { conversations } from './conversations.js';
import { organizations } from './organizations.js';
import { whatsappConnectionProvider, whatsappConnections } from './whatsapp-connections.js';

export const messageDirection = pgEnum('message_direction', ['INBOUND', 'OUTBOUND']);
export const messageOrigin = pgEnum('message_origin', ['CUSTOMER_INBOUND', 'SLOTLYFLOW_API_OUTBOUND', 'BUSINESS_APP_OUTBOUND']);
export const messageType = pgEnum('message_type', ['TEXT', 'UNSUPPORTED']);
/** Provider lifecycle is meaningful only for outbound messages. */
export const outboundMessageStatus = pgEnum('outbound_message_status', ['ACCEPTED', 'SENT', 'DELIVERED', 'READ', 'FAILED']);

/**
 * A normalized, tenant-owned provider message. Raw provider webhook payloads
 * and provider credentials are deliberately not stored here.
 */
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    whatsappConnectionId: uuid('whatsapp_connection_id')
      .notNull()
      .references(() => whatsappConnections.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    provider: whatsappConnectionProvider('provider').notNull(),
    providerMessageId: varchar('provider_message_id', { length: 255 }).notNull(),
    direction: messageDirection('direction').notNull(),
    origin: messageOrigin('origin').notNull(),
    messageType: messageType('message_type').notNull(),
    textBody: text('text_body'),
    interactiveOptionId: varchar('interactive_option_id', { length: 255 }),
    interactiveOptions: jsonb('interactive_options').$type<readonly { readonly id: string; readonly label: string }[] | null>(),
    outboundStatus: outboundMessageStatus('outbound_status'),
    outboundStatusUpdatedAt: timestamp('outbound_status_updated_at', { withTimezone: true }),
    providerTimestamp: timestamp('provider_timestamp', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Meta retries failed deliveries. This database constraint is the durable
    // idempotency boundary for the provider message identifier.
    uniqueIndex('messages_provider_message_id_unique').on(table.provider, table.providerMessageId),
    index('messages_organization_conversation_created_idx').on(
      table.organizationId,
      table.conversationId,
      table.createdAt,
    ),
    index('messages_connection_provider_timestamp_idx').on(
      table.whatsappConnectionId,
      table.providerTimestamp,
    ),
    index('messages_outbound_provider_status_idx').on(
      table.whatsappConnectionId,
      table.outboundStatus,
      table.outboundStatusUpdatedAt,
    ),
    check(
      'messages_origin_direction_consistent',
      sql`(${table.origin} = 'CUSTOMER_INBOUND' and ${table.direction} = 'INBOUND')
        or (${table.origin} in ('SLOTLYFLOW_API_OUTBOUND', 'BUSINESS_APP_OUTBOUND') and ${table.direction} = 'OUTBOUND')`,
    ),
    check(
      'messages_outbound_status_only_for_outbound',
      sql`(${table.outboundStatus} is null) or (${table.direction} = 'OUTBOUND')`,
    ),
    check(
      'messages_outbound_status_timestamp_pair',
      sql`(${table.outboundStatus} is null and ${table.outboundStatusUpdatedAt} is null) or (${table.outboundStatus} is not null and ${table.outboundStatusUpdatedAt} is not null)`,
    ),
    check(
      'messages_interactive_reply_only_for_inbound',
      sql`(${table.interactiveOptionId} is null) or (${table.direction} = 'INBOUND')`,
    ),
    check(
      'messages_interactive_options_only_for_outbound',
      sql`(${table.interactiveOptions} is null) or (${table.direction} = 'OUTBOUND')`,
    ),
  ],
);

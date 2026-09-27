import { index, jsonb, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar, text } from 'drizzle-orm/pg-core';

import { conversations } from './conversations.js';
import { messages } from './messages.js';
import { organizations } from './organizations.js';
import { whatsappConnections } from './whatsapp-connections.js';

/**
 * A narrowly-scoped idempotency ledger for direct text and reply-button sends.
 * It is not a generic workflow or asynchronous outbox framework.
 */
export const outboundMessageRequestState = pgEnum('outbound_message_request_state', [
  'PENDING',
  'COMPLETED',
  'REJECTED',
]);

export const outboundMessageRequests = pgTable(
  'outbound_message_requests',
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
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    textBody: text('text_body').notNull(),
    interactiveOptions: jsonb('interactive_options').$type<readonly { readonly id: string; readonly label: string }[] | null>(),
    state: outboundMessageRequestState('state').notNull().default('PENDING'),
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('outbound_message_requests_organization_idempotency_unique').on(
      table.organizationId,
      table.idempotencyKey,
    ),
    index('outbound_message_requests_conversation_state_idx').on(
      table.conversationId,
      table.state,
    ),
  ],
);

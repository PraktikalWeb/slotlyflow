import { foreignKey, index, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { botDeployments, botVersions } from './bots.js';
import { conversations } from './conversations.js';
import { organizations } from './organizations.js';
import { whatsappConnections } from './whatsapp-connections.js';

/**
 * Durable provider-neutral execution state for one Bot deployment/version in
 * one trusted conversation. Human handover rows remain the authority for
 * automation suppression after a handover.
 */
export const botConversationStates = pgTable(
  'bot_conversation_states',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    whatsappConnectionId: uuid('whatsapp_connection_id').notNull(),
    conversationId: uuid('conversation_id').notNull(),
    botDeploymentId: uuid('bot_deployment_id').notNull(),
    botVersionId: uuid('bot_version_id')
      .notNull()
      .references(() => botVersions.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    state: varchar('state', { length: 64 }).notNull(),
    // Explicit collection answers for trusted deterministic bots; never a client-supplied tenant context.
    data: jsonb('data').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: 'bot_conversation_states_organization_connection_fkey',
      columns: [table.organizationId, table.whatsappConnectionId],
      foreignColumns: [whatsappConnections.organizationId, whatsappConnections.id],
    }).onDelete('restrict').onUpdate('cascade'),
    foreignKey({
      name: 'bot_conversation_states_conversation_context_fkey',
      columns: [table.organizationId, table.whatsappConnectionId, table.conversationId],
      foreignColumns: [conversations.organizationId, conversations.whatsappConnectionId, conversations.id],
    }).onDelete('restrict').onUpdate('cascade'),
    foreignKey({
      name: 'bot_conversation_states_deployment_context_fkey',
      columns: [table.organizationId, table.whatsappConnectionId, table.botDeploymentId, table.botVersionId],
      foreignColumns: [botDeployments.organizationId, botDeployments.whatsappConnectionId, botDeployments.id, botDeployments.botVersionId],
    }).onDelete('restrict').onUpdate('cascade'),
    uniqueIndex('bot_conversation_states_execution_context_unique').on(
      table.organizationId,
      table.conversationId,
      table.botDeploymentId,
      table.botVersionId,
    ),
    index('bot_conversation_states_connection_conversation_idx').on(
      table.organizationId,
      table.whatsappConnectionId,
      table.conversationId,
    ),
  ],
);

import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, index, jsonb, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { organizations } from './organizations.js';
import { whatsappConnections } from './whatsapp-connections.js';

/** Platform-curated reusable bot catalogue entries. */
export const botDefinitionStatus = pgEnum('bot_definition_status', ['ACTIVE', 'ARCHIVED']);

/** Published versions are immutable; no executable content is persisted here. */
export const botVersionStatus = pgEnum('bot_version_status', ['PUBLISHED', 'RETIRED']);

/** A connection can have historical inactive deployments but only one active target. */
export const botDeploymentStatus = pgEnum('bot_deployment_status', ['INACTIVE', 'ACTIVE']);

export const botDefinitions = pgTable(
  'bot_definitions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    definitionKey: varchar('definition_key', { length: 120 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    description: varchar('description', { length: 1_000 }),
    status: botDefinitionStatus('status').default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('bot_definitions_definition_key_unique').on(table.definitionKey),
    index('bot_definitions_status_created_idx').on(table.status, table.createdAt),
  ],
);

export const botVersions = pgTable(
  'bot_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    botDefinitionId: uuid('bot_definition_id')
      .notNull()
      .references(() => botDefinitions.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    version: varchar('version', { length: 32 }).notNull(),
    implementationKey: varchar('implementation_key', { length: 160 }).notNull(),
    configurationSchema: jsonb('configuration_schema').$type<Record<string, unknown> | null>(),
    status: botVersionStatus('status').default('PUBLISHED').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('bot_versions_definition_version_unique').on(table.botDefinitionId, table.version),
    index('bot_versions_definition_status_published_idx').on(table.botDefinitionId, table.status, table.publishedAt),
  ],
);

/**
 * A durable assignment of a published platform bot version to one exact,
 * Organization-owned WhatsApp connection. Version changes create a successor
 * row rather than rewriting historical deployment/version evidence.
 */
export const botDeployments = pgTable(
  'bot_deployments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    whatsappConnectionId: uuid('whatsapp_connection_id').notNull(),
    botVersionId: uuid('bot_version_id')
      .notNull()
      .references(() => botVersions.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    configuration: jsonb('configuration').$type<Record<string, unknown> | null>(),
    status: botDeploymentStatus('status').default('INACTIVE').notNull(),
    // Deployment routing and Business publication are deliberately separate:
    // platform staff select the route, while the Business controls whether the
    // active route may execute for new inbound messages.
    isPublished: boolean('is_published').default(false).notNull(),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: 'bot_deployments_organization_connection_fkey',
      columns: [table.organizationId, table.whatsappConnectionId],
      foreignColumns: [whatsappConnections.organizationId, whatsappConnections.id],
    }).onDelete('restrict').onUpdate('cascade'),
    uniqueIndex('bot_deployments_one_active_per_connection')
      .on(table.whatsappConnectionId)
      .where(sql`${table.status} = 'ACTIVE'`),
    index('bot_deployments_organization_connection_status_idx').on(
      table.organizationId,
      table.whatsappConnectionId,
      table.status,
    ),
    index('bot_deployments_version_created_idx').on(table.botVersionId, table.createdAt),
    uniqueIndex('bot_deployments_execution_context_unique').on(
      table.organizationId,
      table.whatsappConnectionId,
      table.id,
      table.botVersionId,
    ),
    check(
      'bot_deployments_active_timestamp_required',
      sql`(${table.status} <> 'ACTIVE') or (${table.activatedAt} is not null)`,
    ),
  ],
);

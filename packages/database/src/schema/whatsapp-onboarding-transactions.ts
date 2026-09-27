import { sql } from 'drizzle-orm';
import { check, index, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { organizations } from './organizations.js';
import { users } from './users.js';
import { whatsappConnectionProvider, whatsappConnectionSource } from './whatsapp-connections.js';

/** Short-lived, durable state for one server-authorized provider onboarding attempt. */
export const whatsappOnboardingTransactionStatus = pgEnum('whatsapp_onboarding_transaction_status', [
  'STARTED',
  'COMPLETED',
  'EXPIRED',
  'CANCELLED',
]);

export const whatsappCoexistenceContactSyncStatus = pgEnum('whatsapp_coexistence_contact_sync_status', [
  'ATTEMPTED',
  'ACCEPTED',
  'FAILED',
]);

export const whatsappCoexistenceHistorySyncStatus = pgEnum('whatsapp_coexistence_history_sync_status', [
  'ATTEMPTED',
  'ACCEPTED',
  'DECLINED',
  'FAILED',
  'PROCESSED',
]);

export const whatsappOnboardingTransactions = pgTable(
  'whatsapp_onboarding_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    provider: whatsappConnectionProvider('provider').notNull(),
    connectionSource: whatsappConnectionSource('connection_source').notNull(),
    status: whatsappOnboardingTransactionStatus('status').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    coexistenceContactSyncStatus: whatsappCoexistenceContactSyncStatus('coexistence_contact_sync_status'),
    coexistenceContactSyncAttemptedAt: timestamp('coexistence_contact_sync_attempted_at', { withTimezone: true }),
    coexistenceContactSyncAcceptedAt: timestamp('coexistence_contact_sync_accepted_at', { withTimezone: true }),
    coexistenceContactSyncProviderRequestId: varchar('coexistence_contact_sync_provider_request_id', { length: 255 }),
    coexistenceContactSyncFailureCategory: varchar('coexistence_contact_sync_failure_category', { length: 64 }),
    coexistenceContactSyncProviderErrorCode: varchar('coexistence_contact_sync_provider_error_code', { length: 64 }),
    coexistenceContactSyncProviderErrorSubcode: varchar('coexistence_contact_sync_provider_error_subcode', { length: 64 }),
    coexistenceHistorySyncStatus: whatsappCoexistenceHistorySyncStatus('coexistence_history_sync_status'),
    coexistenceHistorySyncAttemptedAt: timestamp('coexistence_history_sync_attempted_at', { withTimezone: true }),
    coexistenceHistorySyncAcceptedAt: timestamp('coexistence_history_sync_accepted_at', { withTimezone: true }),
    coexistenceHistorySyncProcessedAt: timestamp('coexistence_history_sync_processed_at', { withTimezone: true }),
    coexistenceHistorySyncProviderRequestId: varchar('coexistence_history_sync_provider_request_id', { length: 255 }),
    coexistenceHistorySyncFailureCategory: varchar('coexistence_history_sync_failure_category', { length: 64 }),
    coexistenceHistorySyncProviderErrorCode: varchar('coexistence_history_sync_provider_error_code', { length: 64 }),
    coexistenceHistorySyncProviderErrorSubcode: varchar('coexistence_history_sync_provider_error_subcode', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // A lock on the Organization row serializes start attempts; this partial
    // uniqueness constraint is the database integrity boundary as well.
    uniqueIndex('whatsapp_onboarding_transactions_active_organization_unique')
      .on(table.organizationId)
      .where(sql`${table.status} = 'STARTED'`),
    index('whatsapp_onboarding_tx_org_status_expires_idx')
      .on(table.organizationId, table.status, table.expiresAt),
    index('whatsapp_onboarding_transactions_actor_user_id_idx').on(table.actorUserId),
    check('whatsapp_onboarding_transactions_expiry_after_creation', sql`${table.expiresAt} > ${table.createdAt}`),
    check(
      'whatsapp_onboarding_transactions_contact_sync_state_valid',
      sql`(${table.coexistenceContactSyncStatus} is null and ${table.coexistenceContactSyncAttemptedAt} is null)
        or (${table.coexistenceContactSyncStatus} is not null and ${table.coexistenceContactSyncAttemptedAt} is not null)`,
    ),
    check(
      'whatsapp_onboarding_transactions_contact_sync_acceptance_valid',
      sql`${table.coexistenceContactSyncStatus} <> 'ACCEPTED'
        or (${table.coexistenceContactSyncAcceptedAt} is not null and ${table.coexistenceContactSyncProviderRequestId} is not null)`,
    ),
    check(
      'whatsapp_onboarding_transactions_contact_sync_failure_valid',
      sql`${table.coexistenceContactSyncStatus} <> 'FAILED'
        or (${table.coexistenceContactSyncFailureCategory} is not null and ${table.coexistenceContactSyncProviderErrorCode} is not null)`,
    ),
    check(
      'whatsapp_onboarding_transactions_history_sync_state_valid',
      sql`(${table.coexistenceHistorySyncStatus} is null and ${table.coexistenceHistorySyncAttemptedAt} is null)
        or (${table.coexistenceHistorySyncStatus} is not null and ${table.coexistenceHistorySyncAttemptedAt} is not null)`,
    ),
    check(
      'whatsapp_onboarding_transactions_history_sync_acceptance_valid',
      sql`${table.coexistenceHistorySyncStatus} <> 'ACCEPTED'
        or (${table.coexistenceHistorySyncAcceptedAt} is not null and ${table.coexistenceHistorySyncProviderRequestId} is not null)`,
    ),
    check(
      'whatsapp_onboarding_transactions_history_sync_failure_valid',
      sql`${table.coexistenceHistorySyncStatus} <> 'FAILED'
        or (${table.coexistenceHistorySyncFailureCategory} is not null and ${table.coexistenceHistorySyncProviderErrorCode} is not null)`,
    ),
    check(
      'whatsapp_onboarding_transactions_history_sync_processed_valid',
      sql`${table.coexistenceHistorySyncStatus} <> 'PROCESSED'
        or ${table.coexistenceHistorySyncProcessedAt} is not null`,
    ),
  ],
);

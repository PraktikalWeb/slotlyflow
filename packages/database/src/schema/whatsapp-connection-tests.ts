import { sql } from 'drizzle-orm';
import { check, index, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { organizations } from './organizations.js';
import { whatsappConnections } from './whatsapp-connections.js';

export const whatsappConnectionTestStatus = pgEnum('whatsapp_connection_test_status', ['IN_PROGRESS', 'PASSED', 'FAILED']);
export const whatsappConnectionTestStage = pgEnum('whatsapp_connection_test_stage', ['WAITING_FOR_MESSAGE', 'MESSAGE_RECEIVED', 'REPLY_SENT', 'PASSED', 'FAILED']);

/** A short-lived platform-controlled webhook-path verification, never an automation. */
export const whatsappConnectionTests = pgTable(
  'whatsapp_connection_tests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    whatsappConnectionId: uuid('whatsapp_connection_id').notNull().references(() => whatsappConnections.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    destinationPhoneNumberId: varchar('destination_phone_number_id', { length: 255 }).notNull(),
    testSenderPhoneNumber: varchar('test_sender_phone_number', { length: 32 }).notNull(),
    status: whatsappConnectionTestStatus('status').notNull().default('IN_PROGRESS'),
    stage: whatsappConnectionTestStage('stage').notNull().default('WAITING_FOR_MESSAGE'),
    inboundProviderMessageId: varchar('inbound_provider_message_id', { length: 255 }),
    failureCode: varchar('failure_code', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    inboundReceivedAt: timestamp('inbound_received_at', { withTimezone: true }),
    replySentAt: timestamp('reply_sent_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('whatsapp_connection_tests_one_active_per_connection').on(table.whatsappConnectionId).where(sql`${table.status} = 'IN_PROGRESS'`),
    uniqueIndex('whatsapp_connection_tests_inbound_message_unique').on(table.inboundProviderMessageId).where(sql`${table.inboundProviderMessageId} is not null`),
    index('whatsapp_connection_tests_lookup_idx').on(table.destinationPhoneNumberId, table.testSenderPhoneNumber, table.status, table.expiresAt),
    index('whatsapp_connection_tests_organization_connection_idx').on(table.organizationId, table.whatsappConnectionId, table.createdAt),
    check('whatsapp_connection_tests_terminal_timestamp', sql`(${table.status} = 'IN_PROGRESS') or (${table.completedAt} is not null)`),
  ],
);

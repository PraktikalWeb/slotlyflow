import { sql } from 'drizzle-orm';
import { check, index, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { organizations } from './organizations.js';

export const whatsappConnectionProvider = pgEnum('whatsapp_connection_provider', ['META']);
export const whatsappConnectionSource = pgEnum('whatsapp_connection_source', [
  'EXISTING_BUSINESS_APP',
  'NEW_NUMBER',
  'EXISTING_PLATFORM',
]);
export const whatsappConnectionStatus = pgEnum('whatsapp_connection_status', [
  'PENDING',
  'VERIFYING',
  'CONNECTED',
  'FAILED',
  'DISCONNECTED',
  'NEEDS_REAUTH',
  'CONFLICT',
]);
export const whatsappConnectionVerificationStatus = pgEnum('whatsapp_connection_verification_status', [
  'VERIFIED',
  'CHECK_FAILED',
]);

/**
 * One Organization-owned WhatsApp connection. Provider credentials are held
 * only by an opaque reference; this resource never contains plaintext secret
 * material or provider payloads.
 */
export const whatsappConnections = pgTable(
  'whatsapp_connections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    provider: whatsappConnectionProvider('provider').notNull(),
    connectionSource: whatsappConnectionSource('connection_source').notNull(),
    connectionStatus: whatsappConnectionStatus('connection_status').notNull(),
    externalWabaId: varchar('external_waba_id', { length: 255 }),
    externalPhoneNumberId: varchar('external_phone_number_id', { length: 255 }),
    displayPhoneNumber: varchar('display_phone_number', { length: 64 }),
    credentialReference: varchar('credential_reference', { length: 255 }),
    verificationStatus: whatsappConnectionVerificationStatus('verification_status'),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
    lastVerificationCode: varchar('last_verification_code', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // M1 supports exactly one connection resource per Organization. A later
    // deliberate multi-number decision can widen this constraint by migration.
    uniqueIndex('whatsapp_connections_organization_id_unique').on(table.organizationId),
    // Composite ownership target used by tenant-owned resources that must bind
    // an Organization and its exact connection at the database boundary.
    uniqueIndex('whatsapp_connections_organization_id_id_unique').on(table.organizationId, table.id),
    // A provider phone number may never silently be claimed by two Businesses.
    uniqueIndex('whatsapp_connections_provider_phone_number_unique').on(table.provider, table.externalPhoneNumberId),
    index('whatsapp_connections_organization_status_idx').on(table.organizationId, table.connectionStatus),
    check(
      'whatsapp_connections_connected_details_required',
      sql`(${table.connectionStatus} <> 'CONNECTED') or (
        ${table.externalWabaId} is not null and
        ${table.externalPhoneNumberId} is not null and
        ${table.credentialReference} is not null
      )`,
    ),
  ],
);

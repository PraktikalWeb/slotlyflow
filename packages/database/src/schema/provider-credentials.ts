import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { organizations } from './organizations.js';
import { whatsappConnectionProvider } from './whatsapp-connections.js';

/**
 * Encrypted provider material only. This table deliberately has no plaintext
 * token, authorization-code, or raw-provider-payload column.
 */
export const providerCredentials = pgTable(
  'provider_credentials',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    provider: whatsappConnectionProvider('provider').notNull(),
    encryptionVersion: varchar('encryption_version', { length: 32 }).notNull(),
    nonce: varchar('nonce', { length: 64 }).notNull(),
    ciphertext: varchar('ciphertext', { length: 8192 }).notNull(),
    authenticationTag: varchar('authentication_tag', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('provider_credentials_organization_provider_idx').on(table.organizationId, table.provider),
  ],
);

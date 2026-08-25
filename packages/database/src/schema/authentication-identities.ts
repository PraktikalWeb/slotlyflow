import { index, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { users } from './users.js';

export const authenticationProvider = pgEnum('authentication_provider', ['PASSWORD', 'GOOGLE']);

export const authenticationIdentities = pgTable(
  'authentication_identities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    provider: authenticationProvider('provider').notNull(),
    providerSubject: varchar('provider_subject', { length: 320 }).notNull(),
    providerEmail: varchar('provider_email', { length: 320 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('authentication_identities_provider_subject_unique').on(table.provider, table.providerSubject),
    index('authentication_identities_user_id_idx').on(table.userId),
  ],
);

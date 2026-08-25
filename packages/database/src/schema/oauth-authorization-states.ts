import { index, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const oauthAuthorizationProvider = pgEnum('oauth_authorization_provider', ['GOOGLE']);

export const oauthAuthorizationStates = pgTable(
  'oauth_authorization_states',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: oauthAuthorizationProvider('provider').notNull(),
    stateHash: varchar('state_hash', { length: 255 }).notNull(),
    nonceHash: varchar('nonce_hash', { length: 255 }).notNull(),
    codeVerifierHash: varchar('code_verifier_hash', { length: 255 }).notNull(),
    redirectUri: varchar('redirect_uri', { length: 2048 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('oauth_authorization_states_state_hash_unique').on(table.stateHash),
    index('oauth_authorization_states_expires_at_idx').on(table.expiresAt),
  ],
);

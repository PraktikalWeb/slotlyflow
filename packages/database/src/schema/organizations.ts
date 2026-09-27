import { index, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const organizationLifecycleStatus = pgEnum('organization_lifecycle_status', ['ACTIVE', 'SUSPENDED']);

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    businessEmail: varchar('business_email', { length: 320 }),
    contactNumber: varchar('contact_number', { length: 40 }),
    website: varchar('website', { length: 2048 }),
    timezone: varchar('timezone', { length: 100 }).default('Africa/Johannesburg').notNull(),
    status: organizationLifecycleStatus('status').default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('organizations_slug_unique').on(table.slug),
    index('organizations_status_created_at_idx').on(table.status, table.createdAt),
    index('organizations_created_at_idx').on(table.createdAt),
  ],
);

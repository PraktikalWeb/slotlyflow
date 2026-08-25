import { index, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { organizations } from './organizations.js';
import { users } from './users.js';

export const organizationMemberRole = pgEnum('organization_member_role', ['OWNER', 'ADMIN', 'AGENT']);
export const organizationMemberStatus = pgEnum('organization_member_status', [
  'active',
  'invited',
  'disabled',
]);

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    role: organizationMemberRole('role').notNull(),
    status: organizationMemberStatus('status').default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('organization_members_organization_user_unique').on(table.organizationId, table.userId),
    index('organization_members_organization_id_idx').on(table.organizationId),
    index('organization_members_user_id_idx').on(table.userId),
  ],
);

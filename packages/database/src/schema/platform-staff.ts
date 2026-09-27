import { index, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { users } from './users.js';

export const platformStaffRole = pgEnum('platform_staff_role', [
  'SUPER_ADMIN',
  'SUPPORT',
  'BILLING_ADMIN',
  'OPERATIONS',
]);

export const platformStaffStatus = pgEnum('platform_staff_status', ['ACTIVE', 'SUSPENDED']);

/**
 * SlotlyFlow operator authorization. This is deliberately independent from
 * Organization membership and never grants access through Business routes.
 */
export const platformStaff = pgTable(
  'platform_staff',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    role: platformStaffRole('role').notNull(),
    status: platformStaffStatus('status').default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('platform_staff_user_id_unique').on(table.userId),
    index('platform_staff_role_status_idx').on(table.role, table.status),
    index('platform_staff_created_at_idx').on(table.createdAt),
  ],
);

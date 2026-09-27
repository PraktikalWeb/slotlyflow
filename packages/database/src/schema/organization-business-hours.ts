import { boolean, check, pgEnum, pgTable, primaryKey, time, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { organizations } from './organizations.js';

export const organizationBusinessDay = pgEnum('organization_business_day', [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]);

export const organizationBusinessHours = pgTable(
  'organization_business_hours',
  {
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    day: organizationBusinessDay('day').notNull(),
    enabled: boolean('enabled').notNull(),
    opensAt: time('opens_at', { precision: 0 }),
    closesAt: time('closes_at', { precision: 0 }),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.day] }),
    check(
      'organization_business_hours_valid_schedule',
      sql`(
        (${table.enabled} = true and ${table.opensAt} is not null and ${table.closesAt} is not null and ${table.opensAt} < ${table.closesAt})
        or
        (${table.enabled} = false and ${table.opensAt} is null and ${table.closesAt} is null)
      )`,
    ),
  ],
);

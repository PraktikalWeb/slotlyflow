import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { organizations } from './organizations.js';
import { users } from './users.js';

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'restrict',
      onUpdate: 'cascade',
    }),
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'restrict',
      onUpdate: 'cascade',
    }),
    action: varchar('action', { length: 120 }).notNull(),
    targetType: varchar('target_type', { length: 120 }).notNull(),
    targetId: text('target_id'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('audit_logs_organization_created_at_idx').on(table.organizationId, table.createdAt),
    index('audit_logs_actor_user_id_idx').on(table.actorUserId),
  ],
);

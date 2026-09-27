import { foreignKey, index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { organizationMembers } from './organization-members.js';
import { organizations } from './organizations.js';

/** A Business-scoped group of eligible human consultants. */
export const teams = pgTable(
  'teams',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('teams_organization_id_id_unique').on(table.organizationId, table.id),
    uniqueIndex('teams_organization_name_unique').on(table.organizationId, table.name),
    index('teams_organization_created_idx').on(table.organizationId, table.createdAt),
  ],
);

/** A team member is always an existing membership in the same Business. */
export const teamMembers = pgTable(
  'team_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    teamId: uuid('team_id').notNull(),
    organizationMemberId: uuid('organization_member_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: 'team_members_organization_team_fkey',
      columns: [table.organizationId, table.teamId],
      foreignColumns: [teams.organizationId, teams.id],
    }).onDelete('restrict').onUpdate('cascade'),
    foreignKey({
      name: 'team_members_organization_membership_fkey',
      columns: [table.organizationId, table.organizationMemberId],
      foreignColumns: [organizationMembers.organizationId, organizationMembers.id],
    }).onDelete('restrict').onUpdate('cascade'),
    uniqueIndex('team_members_team_membership_unique').on(table.teamId, table.organizationMemberId),
    uniqueIndex('team_members_organization_team_membership_unique').on(table.organizationId, table.teamId, table.organizationMemberId),
    index('team_members_organization_team_idx').on(table.organizationId, table.teamId),
  ],
);

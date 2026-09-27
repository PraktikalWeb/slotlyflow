import { sql } from 'drizzle-orm';
import { check, foreignKey, index, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { conversations } from './conversations.js';
import { organizationMembers } from './organization-members.js';
import { organizations } from './organizations.js';
import { teamMembers, teams } from './teams.js';

export const handoverAssignmentStatus = pgEnum('handover_assignment_status', ['WAITING', 'ASSIGNED']);

/** The minimal durable consultant-assignment state needed for a human handover. */
export const handoverAssignments = pgTable(
  'handover_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    conversationId: uuid('conversation_id').notNull(),
    teamId: uuid('team_id'),
    assigneeMembershipId: uuid('assignee_membership_id'),
    status: handoverAssignmentStatus('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: 'handover_assignments_organization_conversation_fkey',
      columns: [table.organizationId, table.conversationId],
      foreignColumns: [conversations.organizationId, conversations.id],
    }).onDelete('restrict').onUpdate('cascade'),
    foreignKey({
      name: 'handover_assignments_organization_team_fkey',
      columns: [table.organizationId, table.teamId],
      foreignColumns: [teams.organizationId, teams.id],
    }).onDelete('restrict').onUpdate('cascade'),
    foreignKey({
      name: 'handover_assignments_organization_membership_fkey',
      columns: [table.organizationId, table.assigneeMembershipId],
      foreignColumns: [organizationMembers.organizationId, organizationMembers.id],
    }).onDelete('restrict').onUpdate('cascade'),
    foreignKey({
      name: 'handover_assignments_team_assignee_fkey',
      columns: [table.organizationId, table.teamId, table.assigneeMembershipId],
      foreignColumns: [teamMembers.organizationId, teamMembers.teamId, teamMembers.organizationMemberId],
    }).onDelete('restrict').onUpdate('cascade'),
    uniqueIndex('handover_assignments_organization_conversation_unique').on(table.organizationId, table.conversationId),
    uniqueIndex('handover_assignments_organization_id_id_unique').on(table.organizationId, table.id),
    uniqueIndex('handover_assignments_organization_id_conversation_unique').on(table.organizationId, table.id, table.conversationId),
    index('handover_assignments_team_status_assigned_idx').on(table.organizationId, table.teamId, table.status, table.assignedAt, table.id),
    check(
      'handover_assignments_state_consistent',
      sql`(${table.status} = 'WAITING' and ${table.assigneeMembershipId} is null)
        or (${table.status} = 'ASSIGNED' and ${table.teamId} is not null and ${table.assigneeMembershipId} is not null and ${table.assignedAt} is not null)`,
    ),
  ],
);

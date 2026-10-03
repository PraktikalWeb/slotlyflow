import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { handoverAssignments } from './handovers.js';
import { conversations } from './conversations.js';
import { organizationMembers } from './organization-members.js';
import { organizations } from './organizations.js';
import { teams } from './teams.js';
import { users } from './users.js';

export const notificationType = pgEnum('notification_type', ['HANDOVER_ASSIGNED']);
export const notificationResourceType = pgEnum('notification_resource_type', ['CONVERSATION']);
export const notificationDeliveryChannel = pgEnum('notification_delivery_channel', ['EMAIL']);
export const notificationDeliveryStatus = pgEnum('notification_delivery_status', ['PENDING', 'SENDING', 'SENT', 'FAILED', 'FAILED_PERMANENTLY', 'BLOCKED']);

/** Business-level handover routing and safe fallback-email configuration. */
export const organizationNotificationSettings = pgTable(
  'organization_notification_settings',
  {
    organizationId: uuid('organization_id')
      .primaryKey()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    handoverTeamId: uuid('handover_team_id'),
    fallbackEmailAddresses: text('fallback_email_addresses').array().notNull().default(sql`'{}'::text[]`),
    emailNotificationsEnabled: boolean('email_notifications_enabled').notNull().default(true),
    handoverAutoCloseEnabled: boolean('handover_auto_close_enabled').notNull().default(true),
    handoverInactivityMinutes: integer('handover_inactivity_minutes').notNull().default(1440),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: 'organization_notification_settings_handover_team_fkey',
      columns: [table.organizationId, table.handoverTeamId],
      foreignColumns: [teams.organizationId, teams.id],
    }).onDelete('restrict').onUpdate('cascade'),
    check('organization_notification_settings_handover_inactivity_bounds', sql`${table.handoverInactivityMinutes} between 15 and 43200`),
  ],
);

/** A user-owned delivery preference; it never grants Business authorization. */
export const userNotificationPreferences = pgTable(
  'user_notification_preferences',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    preferredEmail: varchar('preferred_email', { length: 320 }),
    emailNotificationsEnabled: boolean('email_notifications_enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
);

/** Durable in-app records; fallback-only records deliberately have no platform recipient. */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    type: notificationType('type').notNull(),
    recipientUserId: uuid('recipient_user_id'),
    recipientMembershipId: uuid('recipient_membership_id'),
    teamId: uuid('team_id'),
    handoverAssignmentId: uuid('handover_assignment_id').notNull(),
    resourceType: notificationResourceType('resource_type').notNull(),
    resourceId: uuid('resource_id').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    body: varchar('body', { length: 1_000 }).notNull(),
    deduplicationKey: varchar('deduplication_key', { length: 255 }).notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: 'notifications_organization_recipient_membership_user_fkey',
      columns: [table.organizationId, table.recipientMembershipId, table.recipientUserId],
      foreignColumns: [organizationMembers.organizationId, organizationMembers.id, organizationMembers.userId],
    }).onDelete('restrict').onUpdate('cascade'),
    foreignKey({
      name: 'notifications_organization_team_fkey',
      columns: [table.organizationId, table.teamId],
      foreignColumns: [teams.organizationId, teams.id],
    }).onDelete('restrict').onUpdate('cascade'),
    foreignKey({
      name: 'notifications_organization_handover_assignment_fkey',
      columns: [table.organizationId, table.handoverAssignmentId],
      foreignColumns: [handoverAssignments.organizationId, handoverAssignments.id],
    }).onDelete('restrict').onUpdate('cascade'),
    foreignKey({
      name: 'notifications_assignment_conversation_fkey',
      columns: [table.organizationId, table.handoverAssignmentId, table.resourceId],
      foreignColumns: [handoverAssignments.organizationId, handoverAssignments.id, handoverAssignments.conversationId],
    }).onDelete('restrict').onUpdate('cascade'),
    // Only conversations are supported notification resources in this first slice.
    // The composite key keeps the resource in the same Business as the notification.
    foreignKey({
      name: 'notifications_organization_conversation_resource_fkey',
      columns: [table.organizationId, table.resourceId],
      foreignColumns: [conversations.organizationId, conversations.id],
    }).onDelete('restrict').onUpdate('cascade'),
    uniqueIndex('notifications_organization_id_id_unique').on(table.organizationId, table.id),
    uniqueIndex('notifications_organization_id_recipient_unique').on(table.organizationId, table.id, table.recipientMembershipId, table.recipientUserId),
    uniqueIndex('notifications_deduplication_key_unique').on(table.deduplicationKey),
    index('notifications_recipient_created_idx').on(table.organizationId, table.recipientUserId, table.createdAt, table.id),
    index('notifications_recipient_unread_created_idx').on(table.organizationId, table.recipientUserId, table.readAt, table.createdAt),
    check('notifications_recipient_pair_consistent', sql`(${table.recipientUserId} is null and ${table.recipientMembershipId} is null) or (${table.recipientUserId} is not null and ${table.recipientMembershipId} is not null)`),
  ],
);

/** Durable, claimable email outbox rows separate notification creation from delivery. */
export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    notificationId: uuid('notification_id').notNull(),
    recipientUserId: uuid('recipient_user_id'),
    recipientMembershipId: uuid('recipient_membership_id'),
    channel: notificationDeliveryChannel('channel').notNull().default('EMAIL'),
    destination: varchar('destination', { length: 320 }).notNull(),
    status: notificationDeliveryStatus('status').notNull().default('PENDING'),
    attemptCount: integer('attempt_count').notNull().default(0),
    providerMessageId: varchar('provider_message_id', { length: 255 }),
    lastErrorCode: varchar('last_error_code', { length: 64 }),
    failureClassification: varchar('failure_classification', { length: 64 }),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: 'notification_deliveries_organization_notification_fkey',
      columns: [table.organizationId, table.notificationId],
      foreignColumns: [notifications.organizationId, notifications.id],
    }).onDelete('restrict').onUpdate('cascade'),
    foreignKey({
      name: 'notification_deliveries_notification_recipient_fkey',
      columns: [table.organizationId, table.notificationId, table.recipientMembershipId, table.recipientUserId],
      foreignColumns: [notifications.organizationId, notifications.id, notifications.recipientMembershipId, notifications.recipientUserId],
    }).onDelete('restrict').onUpdate('cascade'),
    foreignKey({
      name: 'notification_deliveries_organization_recipient_membership_user_fkey',
      columns: [table.organizationId, table.recipientMembershipId, table.recipientUserId],
      foreignColumns: [organizationMembers.organizationId, organizationMembers.id, organizationMembers.userId],
    }).onDelete('restrict').onUpdate('cascade'),
    uniqueIndex('notification_deliveries_notification_channel_destination_unique').on(table.notificationId, table.channel, table.destination),
    index('notification_deliveries_claim_idx').on(table.status, table.nextAttemptAt, table.lockedAt, table.createdAt, table.id),
    index('notification_deliveries_organization_created_idx').on(table.organizationId, table.createdAt),
    check('notification_deliveries_attempt_count_non_negative', sql`${table.attemptCount} >= 0`),
    check('notification_deliveries_recipient_pair_consistent', sql`(${table.recipientUserId} is null and ${table.recipientMembershipId} is null) or (${table.recipientUserId} is not null and ${table.recipientMembershipId} is not null)`),
  ],
);

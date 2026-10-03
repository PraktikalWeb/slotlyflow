import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, isNull, lt, lte, or, sql } from 'drizzle-orm';
import {
  auditLogs,
  botConversationStates,
  contacts,
  handoverAssignments,
  conversations,
  notificationDeliveries,
  notifications,
  organizationMembers,
  organizationNotificationSettings,
  organizations,
  teamMembers,
  teams,
  userNotificationPreferences,
  users,
  type SlotlyFlowDatabase,
} from '@slotlyflow/database';

import { AUTH_DATABASE } from '../auth/auth.tokens.js';
import type { TrustedAutomationHandoverContext } from './handover-context.types.js';
import { defaultHandoverInactivityMinutes, handoverDeadline } from './handover-inactivity.policy.js';

export interface StoredNotification {
  readonly id: string;
  readonly type: 'HANDOVER_ASSIGNED';
  readonly resourceType: 'CONVERSATION';
  readonly resourceId: string;
  readonly title: string;
  readonly body: string;
  readonly readAt: Date | null;
  readonly createdAt: Date;
}

export interface NotificationSettings {
  readonly handoverTeamId: string | null;
  readonly fallbackEmailAddresses: readonly string[];
  readonly emailNotificationsEnabled: boolean;
}

export interface HandoverInactivitySettings {
  readonly handoverAutoCloseEnabled: boolean;
  readonly handoverInactivityMinutes: number;
}

export type HandoverCloseReason = 'inactivity_timeout' | 'manual';
export type HandoverCloseOutcome = 'closed' | 'already_closed' | 'not_due' | 'not_found';

export interface UserNotificationPreferences {
  readonly preferredEmail: string | null;
  readonly emailNotificationsEnabled: boolean;
}

export interface TeamSummary {
  readonly id: string;
  readonly name: string;
  readonly memberCount: number;
}

export interface HandoverPublication {
  readonly organizationId: string;
  readonly assignment: {
    readonly id: string;
    readonly status: 'WAITING' | 'ASSIGNED';
    readonly conversationId: string;
    readonly teamId: string | null;
    readonly assigneeUserId: string | null;
  };
  readonly created: boolean;
}

export interface ClaimedNotificationDelivery {
  readonly id: string;
  readonly organizationId: string;
  readonly notificationId: string;
  readonly destination: string;
  readonly recipientUserId: string | null;
  readonly recipientMembershipId: string | null;
  readonly attemptCount: number;
}

export type DeliveryAuthorization =
  | { readonly allowed: true; readonly organizationId: string; readonly destination: string; readonly businessName: string; readonly customerDisplayName: string; readonly conversationId: string; readonly handoverContext: TrustedAutomationHandoverContext | null }
  | { readonly allowed: false; readonly organizationId: string; readonly reason: 'INVALID_ASSIGNMENT' | 'INVALID_MEMBERSHIP' | 'INVALID_NOTIFICATION_RECIPIENT' | 'INVALID_TEAM_MEMBERSHIP' | 'FALLBACK_CONFIGURATION_CHANGED' | 'EMAIL_DISABLED' | 'DESTINATION_CHANGED' | 'RESOURCE_UNAVAILABLE' };

@Injectable()
export class DrizzleNotificationRepository {
  constructor(@Inject(AUTH_DATABASE) private readonly db: SlotlyFlowDatabase) {}

  async hasHandoverForConversation(organizationId: string, conversationId: string): Promise<boolean> {
    const [row] = await this.db.select({ id: handoverAssignments.id }).from(handoverAssignments).where(and(
      eq(handoverAssignments.organizationId, organizationId),
      eq(handoverAssignments.conversationId, conversationId),
      sql`${handoverAssignments.status} in ('WAITING', 'ASSIGNED')`,
    ));
    return row !== undefined;
  }

  async handoverInactivitySettings(organizationId: string): Promise<HandoverInactivitySettings> {
    const [settings] = await this.db.select({
      handoverAutoCloseEnabled: organizationNotificationSettings.handoverAutoCloseEnabled,
      handoverInactivityMinutes: organizationNotificationSettings.handoverInactivityMinutes,
    }).from(organizationNotificationSettings).where(eq(organizationNotificationSettings.organizationId, organizationId));
    return settings ?? { handoverAutoCloseEnabled: true, handoverInactivityMinutes: defaultHandoverInactivityMinutes };
  }

  async saveHandoverInactivitySettings(organizationId: string, settings: HandoverInactivitySettings): Promise<HandoverInactivitySettings> {
    return this.db.transaction(async (tx) => {
      await tx.insert(organizationNotificationSettings).values({ organizationId }).onConflictDoNothing();
      await tx.update(organizationNotificationSettings).set({ ...settings, updatedAt: new Date() })
        .where(eq(organizationNotificationSettings.organizationId, organizationId));
      // A configuration change applies to currently active handovers, not only future ones.
      await tx.update(handoverAssignments).set({
        autoCloseAt: settings.handoverAutoCloseEnabled
          ? sql`${handoverAssignments.lastActivityAt} + (${settings.handoverInactivityMinutes} * interval '1 minute')`
          : null,
      }).where(and(
        eq(handoverAssignments.organizationId, organizationId),
        sql`${handoverAssignments.status} in ('WAITING', 'ASSIGNED')`,
      ));
      return settings;
    });
  }

  async recordCustomerActivityInTransaction(
    tx: Parameters<SlotlyFlowDatabase['transaction']>[0] extends (tx: infer Transaction) => unknown ? Transaction : never,
    organizationId: string,
    conversationId: string,
    activityAt: Date,
  ): Promise<boolean> {
    return this.recordActivityInTransaction(tx, organizationId, conversationId, activityAt, 'CUSTOMER');
  }

  async recordHumanActivityInTransaction(
    tx: Parameters<SlotlyFlowDatabase['transaction']>[0] extends (tx: infer Transaction) => unknown ? Transaction : never,
    organizationId: string,
    conversationId: string,
    activityAt: Date,
  ): Promise<boolean> {
    return this.recordActivityInTransaction(tx, organizationId, conversationId, activityAt, 'HUMAN');
  }

  private async recordActivityInTransaction(
    tx: Parameters<SlotlyFlowDatabase['transaction']>[0] extends (tx: infer Transaction) => unknown ? Transaction : never,
    organizationId: string,
    conversationId: string,
    activityAt: Date,
    source: 'CUSTOMER' | 'HUMAN',
  ): Promise<boolean> {
    // The caller holds its inbound transaction until this update commits.
    // Avoid a settings write for conversations without a human handover.
    const [candidate] = await tx.select({ id: handoverAssignments.id }).from(handoverAssignments).where(and(
      eq(handoverAssignments.organizationId, organizationId),
      eq(handoverAssignments.conversationId, conversationId),
      sql`${handoverAssignments.status} in ('WAITING', 'ASSIGNED')`,
    ));
    if (candidate === undefined) return false;
    // Lock settings before the assignment, matching configuration writes and close.
    await tx.insert(organizationNotificationSettings).values({ organizationId }).onConflictDoNothing();
    const [settings] = await tx.select().from(organizationNotificationSettings)
      .where(eq(organizationNotificationSettings.organizationId, organizationId)).for('update');
    if (settings === undefined) throw new Error('Handover settings are unavailable.');
    const [active] = await tx.select().from(handoverAssignments).where(and(
      eq(handoverAssignments.organizationId, organizationId),
      eq(handoverAssignments.conversationId, conversationId),
      sql`${handoverAssignments.status} in ('WAITING', 'ASSIGNED')`,
    )).for('update');
    if (active === undefined) return false;
    const lastActivityAt = new Date(Math.max(active.lastActivityAt.getTime(), activityAt.getTime()));
    await tx.update(handoverAssignments).set({
      lastActivityAt,
      lastHumanActivityAt: source === 'HUMAN'
        ? new Date(Math.max(active.lastHumanActivityAt?.getTime() ?? 0, activityAt.getTime()))
        : active.lastHumanActivityAt,
      autoCloseAt: handoverDeadline(lastActivityAt, settings),
      updatedAt: new Date(),
    }).where(and(eq(handoverAssignments.organizationId, organizationId), eq(handoverAssignments.id, active.id)));
    return true;
  }

  async listDueHandovers(now: Date, limit: number): Promise<readonly { readonly id: string; readonly organizationId: string }[]> {
    return this.db.select({ id: handoverAssignments.id, organizationId: handoverAssignments.organizationId })
      .from(handoverAssignments).where(and(
        sql`${handoverAssignments.status} in ('WAITING', 'ASSIGNED')`,
        lte(handoverAssignments.autoCloseAt, now),
      )).orderBy(asc(handoverAssignments.autoCloseAt), asc(handoverAssignments.id)).limit(limit);
  }

  async closeHandover(input: {
    readonly organizationId: string;
    readonly handoverId: string;
    readonly reason: HandoverCloseReason;
    readonly actorUserId: string | null;
    readonly now: Date;
  }): Promise<HandoverCloseOutcome> {
    return this.db.transaction(async (tx) => {
      const [candidate] = await tx.select({ conversationId: handoverAssignments.conversationId })
        .from(handoverAssignments).where(and(
          eq(handoverAssignments.organizationId, input.organizationId),
          eq(handoverAssignments.id, input.handoverId),
        ));
      if (candidate === undefined) return 'not_found';
      // Inbound persistence locks this same conversation before extending the
      // deadline. Whichever operation gets that lock first defines the order.
      const [conversation] = await tx.select({ id: conversations.id }).from(conversations).where(and(
        eq(conversations.organizationId, input.organizationId),
        eq(conversations.id, candidate.conversationId),
      )).for('update');
      if (conversation === undefined) return 'not_found';
      await tx.insert(organizationNotificationSettings).values({ organizationId: input.organizationId }).onConflictDoNothing();
      const [settings] = await tx.select().from(organizationNotificationSettings)
        .where(eq(organizationNotificationSettings.organizationId, input.organizationId)).for('update');
      if (settings === undefined) throw new Error('Handover settings are unavailable.');
      const [assignment] = await tx.select().from(handoverAssignments).where(and(
        eq(handoverAssignments.organizationId, input.organizationId),
        eq(handoverAssignments.id, input.handoverId),
      )).for('update');
      if (assignment === undefined) return 'not_found';
      if (assignment.status === 'CLOSED') return 'already_closed';
      if (input.reason === 'inactivity_timeout' && (
        !settings.handoverAutoCloseEnabled || assignment.autoCloseAt === null || assignment.autoCloseAt.getTime() > input.now.getTime()
      )) return 'not_due';
      const [closed] = await tx.update(handoverAssignments).set({
        status: 'CLOSED', closedAt: input.now, closedReason: input.reason, autoCloseAt: null, updatedAt: input.now,
      }).where(and(
        eq(handoverAssignments.organizationId, input.organizationId),
        eq(handoverAssignments.id, assignment.id),
        sql`${handoverAssignments.status} in ('WAITING', 'ASSIGNED')`,
        ...(input.reason === 'inactivity_timeout' ? [lte(handoverAssignments.autoCloseAt, input.now)] : []),
      )).returning({ id: handoverAssignments.id });
      if (closed === undefined) return 'not_due';
      await tx.delete(botConversationStates).where(and(
        eq(botConversationStates.organizationId, input.organizationId),
        eq(botConversationStates.conversationId, assignment.conversationId),
      ));
      await tx.insert(auditLogs).values({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: 'handover.closed',
        targetType: 'conversation',
        targetId: assignment.conversationId,
        metadata: { handoverAssignmentId: assignment.id, reason: input.reason },
      });
      return 'closed';
    });
  }

  async listTeams(organizationId: string): Promise<readonly TeamSummary[]> {
    const rows = await this.db
      .select({
        id: teams.id,
        name: teams.name,
        memberCount: sql<number>`count(${teamMembers.id})::int`,
      })
      .from(teams)
      .leftJoin(teamMembers, and(eq(teamMembers.organizationId, teams.organizationId), eq(teamMembers.teamId, teams.id)))
      .where(eq(teams.organizationId, organizationId))
      .groupBy(teams.id, teams.name, teams.createdAt)
      .orderBy(asc(teams.createdAt), asc(teams.id));
    return rows;
  }

  async createTeam(organizationId: string, name: string): Promise<TeamSummary> {
    const [team] = await this.db.insert(teams).values({ organizationId, name }).returning();
    if (team === undefined) throw new Error('Team creation failed.');
    return { id: team.id, name: team.name, memberCount: 0 };
  }

  async addActiveMemberToTeam(organizationId: string, teamId: string, membershipId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [team] = await tx.select({ id: teams.id }).from(teams).where(and(
        eq(teams.organizationId, organizationId),
        eq(teams.id, teamId),
      )).for('update');
      if (team === undefined) return false;
      const [membership] = await tx.select({ id: organizationMembers.id }).from(organizationMembers).where(and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.id, membershipId),
        eq(organizationMembers.status, 'active'),
      ));
      if (membership === undefined) return false;
      await tx.insert(teamMembers).values({
        organizationId,
        teamId: team.id,
        organizationMemberId: membership.id,
      }).onConflictDoNothing({ target: [teamMembers.teamId, teamMembers.organizationMemberId] });
      return true;
    });
  }

  async notificationSettings(organizationId: string): Promise<NotificationSettings> {
    const [settings] = await this.db.select().from(organizationNotificationSettings).where(eq(
      organizationNotificationSettings.organizationId,
      organizationId,
    ));
    return settings === undefined
      ? { handoverTeamId: null, fallbackEmailAddresses: [], emailNotificationsEnabled: true }
      : {
          handoverTeamId: settings.handoverTeamId,
          fallbackEmailAddresses: settings.fallbackEmailAddresses,
          emailNotificationsEnabled: settings.emailNotificationsEnabled,
        };
  }

  async saveNotificationSettings(organizationId: string, settings: NotificationSettings): Promise<NotificationSettings> {
    const [stored] = await this.db.insert(organizationNotificationSettings).values({
      organizationId,
      handoverTeamId: settings.handoverTeamId,
      fallbackEmailAddresses: [...settings.fallbackEmailAddresses],
      emailNotificationsEnabled: settings.emailNotificationsEnabled,
    }).onConflictDoUpdate({
      target: organizationNotificationSettings.organizationId,
      set: {
        handoverTeamId: settings.handoverTeamId,
        fallbackEmailAddresses: [...settings.fallbackEmailAddresses],
        emailNotificationsEnabled: settings.emailNotificationsEnabled,
        updatedAt: new Date(),
      },
    }).returning();
    if (stored === undefined) throw new Error('Notification settings persistence failed.');
    return {
      handoverTeamId: stored.handoverTeamId,
      fallbackEmailAddresses: stored.fallbackEmailAddresses,
      emailNotificationsEnabled: stored.emailNotificationsEnabled,
    };
  }

  async userPreferences(userId: string): Promise<UserNotificationPreferences> {
    const [preferences] = await this.db.select().from(userNotificationPreferences).where(eq(userNotificationPreferences.userId, userId));
    return preferences === undefined
      ? { preferredEmail: null, emailNotificationsEnabled: true }
      : { preferredEmail: preferences.preferredEmail, emailNotificationsEnabled: preferences.emailNotificationsEnabled };
  }

  async saveUserPreferences(userId: string, preferences: UserNotificationPreferences): Promise<UserNotificationPreferences> {
    const [stored] = await this.db.insert(userNotificationPreferences).values({
      userId,
      preferredEmail: preferences.preferredEmail,
      emailNotificationsEnabled: preferences.emailNotificationsEnabled,
    }).onConflictDoUpdate({
      target: userNotificationPreferences.userId,
      set: {
        preferredEmail: preferences.preferredEmail,
        emailNotificationsEnabled: preferences.emailNotificationsEnabled,
        updatedAt: new Date(),
      },
    }).returning();
    if (stored === undefined) throw new Error('Notification preference persistence failed.');
    return { preferredEmail: stored.preferredEmail, emailNotificationsEnabled: stored.emailNotificationsEnabled };
  }

  async listForRecipient(organizationId: string, userId: string): Promise<readonly StoredNotification[]> {
    return this.db.select({
      id: notifications.id,
      type: notifications.type,
      resourceType: notifications.resourceType,
      resourceId: notifications.resourceId,
      title: notifications.title,
      body: notifications.body,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    }).from(notifications).where(and(
      eq(notifications.organizationId, organizationId),
      eq(notifications.recipientUserId, userId),
    )).orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(20);
  }

  async unreadCountForRecipient(organizationId: string, userId: string): Promise<number> {
    const [row] = await this.db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(and(
      eq(notifications.organizationId, organizationId),
      eq(notifications.recipientUserId, userId),
      isNull(notifications.readAt),
    ));
    return row?.count ?? 0;
  }

  async markReadForRecipient(organizationId: string, userId: string, notificationId: string): Promise<boolean> {
    const updated = await this.db.update(notifications).set({ readAt: new Date(), updatedAt: new Date() }).where(and(
      eq(notifications.organizationId, organizationId),
      eq(notifications.id, notificationId),
      eq(notifications.recipientUserId, userId),
    )).returning({ id: notifications.id });
    return updated.length === 1;
  }

  async claimNextDelivery(now: Date, staleSendingBefore: Date, maximumAttempts: number): Promise<ClaimedNotificationDelivery | undefined> {
    return this.db.transaction(async (tx) => {
      await tx.update(notificationDeliveries).set({
        status: 'FAILED_PERMANENTLY',
        lockedAt: null,
        nextAttemptAt: null,
        lastErrorCode: 'STALE_DELIVERY_ATTEMPTS_EXHAUSTED',
        failureClassification: 'PERMANENT_AFTER_RETRIES',
        updatedAt: now,
      }).where(and(
        eq(notificationDeliveries.status, 'SENDING'),
        lt(notificationDeliveries.lockedAt, staleSendingBefore),
        gte(notificationDeliveries.attemptCount, maximumAttempts),
      ));

      const [candidate] = await tx.select().from(notificationDeliveries).where(or(
        eq(notificationDeliveries.status, 'PENDING'),
        and(
          eq(notificationDeliveries.status, 'FAILED'),
          lt(notificationDeliveries.attemptCount, maximumAttempts),
          or(isNull(notificationDeliveries.nextAttemptAt), lte(notificationDeliveries.nextAttemptAt, now)),
        ),
        and(
          eq(notificationDeliveries.status, 'SENDING'),
          lt(notificationDeliveries.attemptCount, maximumAttempts),
          lt(notificationDeliveries.lockedAt, staleSendingBefore),
        ),
      )).orderBy(asc(notificationDeliveries.createdAt), asc(notificationDeliveries.id)).limit(1).for('update');
      if (candidate === undefined) return undefined;
      const [claimed] = await tx.update(notificationDeliveries).set({
        status: 'SENDING',
        attemptCount: candidate.attemptCount + 1,
        lockedAt: now,
        nextAttemptAt: null,
        lastErrorCode: null,
        failureClassification: null,
        updatedAt: now,
      }).where(eq(notificationDeliveries.id, candidate.id)).returning();
      if (claimed === undefined) return undefined;
      return {
        id: claimed.id,
        organizationId: claimed.organizationId,
        notificationId: claimed.notificationId,
        destination: claimed.destination,
        recipientUserId: claimed.recipientUserId,
        recipientMembershipId: claimed.recipientMembershipId,
        attemptCount: claimed.attemptCount,
      };
    });
  }

  async revalidateDelivery(delivery: ClaimedNotificationDelivery): Promise<DeliveryAuthorization> {
    const [row] = await this.db.select({
      organizationId: notificationDeliveries.organizationId,
      destination: notificationDeliveries.destination,
      recipientUserId: notificationDeliveries.recipientUserId,
      recipientMembershipId: notificationDeliveries.recipientMembershipId,
      notificationRecipientUserId: notifications.recipientUserId,
      notificationRecipientMembershipId: notifications.recipientMembershipId,
      notificationTeamId: notifications.teamId,
      resourceId: notifications.resourceId,
      conversationId: conversations.id,
      assignmentId: handoverAssignments.id,
      assignmentStatus: handoverAssignments.status,
      handoverContext: handoverAssignments.context,
      assignmentConversationId: handoverAssignments.conversationId,
      assignmentTeamId: handoverAssignments.teamId,
      assignmentAssigneeMembershipId: handoverAssignments.assigneeMembershipId,
      businessName: organizations.name,
      fallbackEmailAddresses: organizationNotificationSettings.fallbackEmailAddresses,
      organizationEmailEnabled: organizationNotificationSettings.emailNotificationsEnabled,
      customerDisplayName: conversations.customerDisplayName,
    }).from(notificationDeliveries)
      .innerJoin(notifications, and(
        eq(notificationDeliveries.organizationId, notifications.organizationId),
        eq(notificationDeliveries.notificationId, notifications.id),
      ))
      .innerJoin(organizations, eq(notificationDeliveries.organizationId, organizations.id))
      .leftJoin(organizationNotificationSettings, eq(organizationNotificationSettings.organizationId, notificationDeliveries.organizationId))
      .leftJoin(conversations, and(
        eq(conversations.organizationId, notifications.organizationId),
        eq(conversations.id, notifications.resourceId),
      ))
      .leftJoin(handoverAssignments, and(
        eq(handoverAssignments.organizationId, notifications.organizationId),
        eq(handoverAssignments.id, notifications.handoverAssignmentId),
      ))
      .where(and(
        eq(notificationDeliveries.id, delivery.id),
        eq(notificationDeliveries.organizationId, delivery.organizationId),
        eq(notificationDeliveries.notificationId, delivery.notificationId),
        eq(notificationDeliveries.status, 'SENDING'),
        eq(notificationDeliveries.attemptCount, delivery.attemptCount),
      ));
    if (row === undefined || row.conversationId === null) {
      return { allowed: false, organizationId: delivery.organizationId, reason: 'RESOURCE_UNAVAILABLE' };
    }
    if (
      row.assignmentId === null
      || row.assignmentConversationId !== row.resourceId
      || row.assignmentTeamId !== row.notificationTeamId
    ) {
      return { allowed: false, organizationId: row.organizationId, reason: 'INVALID_ASSIGNMENT' };
    }
    if (
      row.notificationRecipientUserId !== row.recipientUserId
      || row.notificationRecipientMembershipId !== row.recipientMembershipId
    ) {
      return { allowed: false, organizationId: row.organizationId, reason: 'INVALID_NOTIFICATION_RECIPIENT' };
    }
    if (row.organizationEmailEnabled === false) {
      return { allowed: false, organizationId: row.organizationId, reason: 'EMAIL_DISABLED' };
    }
    if (row.recipientUserId === null || row.recipientMembershipId === null) {
      if (row.assignmentStatus !== 'WAITING') {
        return { allowed: false, organizationId: row.organizationId, reason: 'INVALID_ASSIGNMENT' };
      }
      if (!(row.fallbackEmailAddresses ?? []).includes(row.destination)) {
        return { allowed: false, organizationId: row.organizationId, reason: 'FALLBACK_CONFIGURATION_CHANGED' };
      }
      return {
        allowed: true,
        organizationId: row.organizationId,
        destination: row.destination,
        businessName: row.businessName,
        customerDisplayName: row.customerDisplayName?.trim() || 'a customer',
        conversationId: row.resourceId,
        handoverContext: row.handoverContext,
      };
    }

    const [recipient] = await this.db.select({
      membershipId: organizationMembers.id,
      userId: users.id,
      role: organizationMembers.role,
      accountEmail: users.emailNormalized,
      emailVerifiedAt: users.emailVerifiedAt,
      preferredEmail: userNotificationPreferences.preferredEmail,
      userEmailEnabled: userNotificationPreferences.emailNotificationsEnabled,
    }).from(organizationMembers).innerJoin(users, eq(organizationMembers.userId, users.id))
      .leftJoin(userNotificationPreferences, eq(userNotificationPreferences.userId, users.id))
      .where(and(
        eq(organizationMembers.organizationId, row.organizationId),
        eq(organizationMembers.id, row.recipientMembershipId),
        eq(organizationMembers.userId, row.recipientUserId),
        eq(organizationMembers.status, 'active'),
      ));
    if (recipient === undefined) return { allowed: false, organizationId: row.organizationId, reason: 'INVALID_MEMBERSHIP' };
    if (row.assignmentStatus === 'ASSIGNED') {
      if (row.assignmentAssigneeMembershipId !== recipient.membershipId || row.notificationTeamId === null) {
        return { allowed: false, organizationId: row.organizationId, reason: 'INVALID_ASSIGNMENT' };
      }
      const [teamMembership] = await this.db.select({ id: teamMembers.id }).from(teamMembers).where(and(
        eq(teamMembers.organizationId, row.organizationId),
        eq(teamMembers.teamId, row.notificationTeamId),
        eq(teamMembers.organizationMemberId, recipient.membershipId),
      ));
      if (teamMembership === undefined) return { allowed: false, organizationId: row.organizationId, reason: 'INVALID_TEAM_MEMBERSHIP' };
    } else if (row.assignmentStatus !== 'WAITING' || recipient.role !== 'OWNER') {
      return { allowed: false, organizationId: row.organizationId, reason: 'INVALID_ASSIGNMENT' };
    }
    if (recipient.userEmailEnabled === false) return { allowed: false, organizationId: row.organizationId, reason: 'EMAIL_DISABLED' };
    const currentDestination = recipient.preferredEmail ?? (recipient.emailVerifiedAt === null ? undefined : recipient.accountEmail);
    if (currentDestination === undefined || currentDestination !== row.destination) {
      return { allowed: false, organizationId: row.organizationId, reason: 'DESTINATION_CHANGED' };
    }
    return {
      allowed: true,
      organizationId: row.organizationId,
      destination: row.destination,
      businessName: row.businessName,
      customerDisplayName: row.customerDisplayName?.trim() || 'a customer',
      conversationId: row.resourceId,
      handoverContext: row.handoverContext,
    };
  }

  async markDeliverySent(delivery: ClaimedNotificationDelivery, providerMessageId: string | undefined, now: Date): Promise<boolean> {
    const updated = await this.db.update(notificationDeliveries).set({
      status: 'SENT',
      providerMessageId: providerMessageId ?? null,
      lockedAt: null,
      sentAt: now,
      updatedAt: now,
    }).where(and(
      eq(notificationDeliveries.id, delivery.id),
      eq(notificationDeliveries.organizationId, delivery.organizationId),
      eq(notificationDeliveries.notificationId, delivery.notificationId),
      eq(notificationDeliveries.status, 'SENDING'),
      eq(notificationDeliveries.attemptCount, delivery.attemptCount),
    )).returning({ id: notificationDeliveries.id });
    return updated.length === 1;
  }

  async markDeliveryBlocked(delivery: ClaimedNotificationDelivery, reason: string, now: Date): Promise<boolean> {
    const updated = await this.db.update(notificationDeliveries).set({
      status: 'BLOCKED',
      lockedAt: null,
      failureClassification: 'AUTHORIZATION_REVALIDATION_FAILED',
      lastErrorCode: reason,
      updatedAt: now,
    }).where(and(
      eq(notificationDeliveries.id, delivery.id),
      eq(notificationDeliveries.organizationId, delivery.organizationId),
      eq(notificationDeliveries.notificationId, delivery.notificationId),
      eq(notificationDeliveries.status, 'SENDING'),
      eq(notificationDeliveries.attemptCount, delivery.attemptCount),
    )).returning({ id: notificationDeliveries.id });
    return updated.length === 1;
  }

  async markDeliveryOutcomeUncertain(delivery: ClaimedNotificationDelivery, now: Date): Promise<boolean> {
    const updated = await this.db.update(notificationDeliveries).set({
      status: 'FAILED_PERMANENTLY',
      lockedAt: null,
      nextAttemptAt: null,
      failureClassification: 'PROVIDER_ACCEPTED_PERSISTENCE_UNCONFIRMED',
      lastErrorCode: 'PROVIDER_ACCEPTED_PERSISTENCE_UNCONFIRMED',
      updatedAt: now,
    }).where(and(
      eq(notificationDeliveries.id, delivery.id),
      eq(notificationDeliveries.organizationId, delivery.organizationId),
      eq(notificationDeliveries.notificationId, delivery.notificationId),
      eq(notificationDeliveries.status, 'SENDING'),
      eq(notificationDeliveries.attemptCount, delivery.attemptCount),
    )).returning({ id: notificationDeliveries.id });
    return updated.length === 1;
  }

  async markDeliveryFailed(delivery: ClaimedNotificationDelivery, maximumAttempts: number, now: Date): Promise<'FAILED' | 'FAILED_PERMANENTLY' | 'STALE_CLAIM'> {
    const terminal = delivery.attemptCount >= maximumAttempts;
    const updated = await this.db.update(notificationDeliveries).set({
      status: terminal ? 'FAILED_PERMANENTLY' : 'FAILED',
      lockedAt: null,
      failureClassification: terminal ? 'PERMANENT_AFTER_RETRIES' : 'TRANSIENT',
      lastErrorCode: 'EMAIL_PROVIDER_FAILED',
      nextAttemptAt: terminal ? null : new Date(now.getTime() + delivery.attemptCount * 30_000),
      updatedAt: now,
    }).where(and(
      eq(notificationDeliveries.id, delivery.id),
      eq(notificationDeliveries.organizationId, delivery.organizationId),
      eq(notificationDeliveries.notificationId, delivery.notificationId),
      eq(notificationDeliveries.status, 'SENDING'),
      eq(notificationDeliveries.attemptCount, delivery.attemptCount),
    )).returning({ id: notificationDeliveries.id });
    return updated.length === 1 ? (terminal ? 'FAILED_PERMANENTLY' : 'FAILED') : 'STALE_CLAIM';
  }

  /** Resolves every routing decision from a conversation already constrained to its trusted Business. */
  async publishHandoverForConversation(
    organizationId: string,
    conversationId: string,
    actorUserId: string | null,
    options: {
      readonly preserveExistingAssignment?: boolean;
      readonly whatsappConnectionId?: string;
      readonly customerWhatsAppId?: string;
      readonly details?: TrustedAutomationHandoverContext;
    } = {},
  ): Promise<HandoverPublication | undefined> {
    return this.db.transaction(async (tx) => {
      const [conversation] = await tx.select({
        id: conversations.id,
        organizationId: conversations.organizationId,
        customerDisplayName: conversations.customerDisplayName,
        whatsappConnectionId: conversations.whatsappConnectionId,
        customerWhatsAppId: conversations.customerWhatsAppId,
        organizationName: organizations.name,
      }).from(conversations).innerJoin(organizations, eq(conversations.organizationId, organizations.id))
        .where(and(eq(conversations.id, conversationId), eq(conversations.organizationId, organizationId))).for('update');
      if (conversation === undefined) return undefined;
      if (
        (options.whatsappConnectionId !== undefined && conversation.whatsappConnectionId !== options.whatsappConnectionId)
        || (options.customerWhatsAppId !== undefined && conversation.customerWhatsAppId !== options.customerWhatsAppId)
        || (options.details !== undefined && conversation.customerWhatsAppId !== options.details.customerWhatsAppId)
      ) return undefined;
      const [contact] = options.details === undefined ? [] : await tx.select({
        id: contacts.id,
        isSavedContact: contacts.isSavedContact,
      }).from(contacts).where(and(
        eq(contacts.organizationId, organizationId),
        eq(contacts.whatsappConnectionId, conversation.whatsappConnectionId),
        eq(contacts.whatsappId, conversation.customerWhatsAppId),
      ));
      const handoverContext = options.details === undefined ? null : {
        ...options.details,
        answers: { ...options.details.answers },
        savedContact: contact?.isSavedContact ?? null,
        contactId: contact?.id ?? null,
      };

      await tx.insert(organizationNotificationSettings).values({ organizationId }).onConflictDoNothing();
      const [settings] = await tx.select().from(organizationNotificationSettings).where(eq(
        organizationNotificationSettings.organizationId,
        organizationId,
      )).for('update');
      const routing = settings === undefined
        ? { handoverTeamId: null, fallbackEmailAddresses: [] as readonly string[], emailNotificationsEnabled: true, handoverAutoCloseEnabled: true, handoverInactivityMinutes: defaultHandoverInactivityMinutes }
        : settings;

      const [existing] = await tx.select().from(handoverAssignments).where(and(
        eq(handoverAssignments.organizationId, organizationId),
        eq(handoverAssignments.conversationId, conversation.id),
        sql`${handoverAssignments.status} in ('WAITING', 'ASSIGNED')`,
      )).for('update');
      if (existing?.status === 'CLOSED') throw new Error('Active handover query returned a closed assignment.');

      if (existing !== undefined && (existing.status === 'ASSIGNED' || options.preserveExistingAssignment === true)) {
        const assignee = existing.assigneeMembershipId === null
          ? undefined
          : await this.userForMembership(tx, organizationId, existing.assigneeMembershipId);
        return {
          organizationId: conversation.organizationId,
          assignment: {
            id: existing.id,
            status: existing.status,
            conversationId: existing.conversationId,
            teamId: existing.teamId,
            assigneeUserId: assignee?.userId ?? null,
          },
          created: false,
        };
      }

      const now = new Date();
      const autoCloseAt = handoverDeadline(now, routing);
      let assignment = existing;
      let assignee: Awaited<ReturnType<DrizzleNotificationRepository['userForMembership']>> | undefined;
      if (routing.handoverTeamId !== null) {
        const [team] = await tx.select({ id: teams.id }).from(teams).where(and(
          eq(teams.organizationId, organizationId),
          eq(teams.id, routing.handoverTeamId),
        )).for('update');
        if (team !== undefined) {
          const eligible = await tx.select({ membershipId: organizationMembers.id }).from(teamMembers)
            .innerJoin(organizationMembers, and(
              eq(teamMembers.organizationId, organizationMembers.organizationId),
              eq(teamMembers.organizationMemberId, organizationMembers.id),
            ))
            .where(and(
              eq(teamMembers.organizationId, organizationId),
              eq(teamMembers.teamId, team.id),
              eq(organizationMembers.status, 'active'),
            ))
            .orderBy(asc(organizationMembers.createdAt), asc(organizationMembers.id));
          const selected = await this.selectRoundRobinMember(tx, organizationId, team.id, eligible.map((entry) => entry.membershipId));
          if (selected !== undefined) {
            if (assignment === undefined) {
              [assignment] = await tx.insert(handoverAssignments).values({
                organizationId,
                conversationId: conversation.id,
                teamId: team.id,
                assigneeMembershipId: selected,
                status: 'ASSIGNED',
                context: handoverContext,
                lastActivityAt: now,
                autoCloseAt,
                assignedAt: now,
              }).returning();
            } else {
              [assignment] = await tx.update(handoverAssignments).set({
                teamId: team.id,
                assigneeMembershipId: selected,
                status: 'ASSIGNED',
                assignedAt: now,
                updatedAt: now,
              }).where(eq(handoverAssignments.id, assignment.id)).returning();
            }
            assignee = await this.userForMembership(tx, organizationId, selected);
          }
        }
      }

      if (assignment === undefined) {
        [assignment] = await tx.insert(handoverAssignments).values({
          organizationId: conversation.organizationId,
          conversationId: conversation.id,
          teamId: routing.handoverTeamId,
          status: 'WAITING',
          context: handoverContext,
          lastActivityAt: now,
          autoCloseAt,
        }).returning();
      }
      if (assignment === undefined || assignment.status === 'CLOSED') throw new Error('Handover assignment persistence failed.');

      const customer = conversation.customerDisplayName?.trim() || 'a customer';
      const priorityHandover = handoverContext?.requestType === 'damaged_or_incorrect_item';
      if (assignee !== undefined) {
        const notification = await this.ensureNotification(tx, {
          organizationId,
          recipientUserId: assignee.userId,
          recipientMembershipId: assignee.membershipId,
          teamId: assignment.teamId,
          handoverAssignmentId: assignment.id,
          resourceId: conversation.id,
          title: priorityHandover ? 'Priority WhatsApp handover needs attention' : 'New WhatsApp handover assigned to you',
          body: `A conversation with ${customer} has been assigned to you.`,
          deduplicationKey: `HANDOVER_ASSIGNED:${conversation.id}:${assignment.id}:${assignee.userId}`,
        });
        const destination = this.destinationForUser(assignee);
        if (routing.emailNotificationsEnabled && destination !== undefined) {
          await tx.insert(notificationDeliveries).values({
            organizationId,
            notificationId: notification.id,
            recipientUserId: assignee.userId,
            recipientMembershipId: assignee.membershipId,
            destination,
          }).onConflictDoNothing({ target: [notificationDeliveries.notificationId, notificationDeliveries.channel, notificationDeliveries.destination] });
        }
      } else {
        await this.createFallbackNotificationAndDeliveries(tx, {
          organizationId,
          assignment,
          teamId: assignment.teamId,
          conversationId: conversation.id,
          customer,
          routing,
          title: priorityHandover ? 'Priority WhatsApp handover needs attention' : 'A WhatsApp handover needs attention',
        });
      }

      if (existing === undefined || (existing.status === 'WAITING' && assignment.status === 'ASSIGNED')) {
        await tx.insert(auditLogs).values({
          organizationId,
          actorUserId,
          action: assignment.status === 'ASSIGNED' ? 'handover.assigned' : 'handover.waiting',
          targetType: 'conversation',
          targetId: conversation.id,
          metadata: {
            handoverAssignmentId: assignment.id,
            teamId: assignment.teamId,
            assigneeMembershipId: assignment.assigneeMembershipId,
            status: assignment.status,
          },
        });
      }

      return {
        organizationId,
        assignment: {
          id: assignment.id,
          status: assignment.status,
          conversationId: assignment.conversationId,
          teamId: assignment.teamId,
          assigneeUserId: assignee?.userId ?? null,
        },
        created: existing === undefined,
      };
    });
  }

  private async createFallbackNotificationAndDeliveries(
    tx: Parameters<SlotlyFlowDatabase['transaction']>[0] extends (tx: infer Transaction) => unknown ? Transaction : never,
    input: {
      readonly organizationId: string;
      readonly assignment: typeof handoverAssignments.$inferSelect;
      readonly teamId: string | null;
      readonly conversationId: string;
      readonly customer: string;
      readonly routing: { readonly fallbackEmailAddresses: readonly string[]; readonly emailNotificationsEnabled: boolean };
      readonly title: string;
    },
  ): Promise<void> {
    if (input.routing.fallbackEmailAddresses.length > 0) {
      const notification = await this.ensureNotification(tx, {
        organizationId: input.organizationId,
        recipientUserId: null,
        recipientMembershipId: null,
        teamId: input.teamId,
        handoverAssignmentId: input.assignment.id,
        resourceId: input.conversationId,
        title: input.title,
        body: `A conversation with ${input.customer} is waiting for a consultant.`,
        deduplicationKey: `HANDOVER_ASSIGNED:${input.conversationId}:${input.assignment.id}:fallback`,
      });
      if (input.routing.emailNotificationsEnabled) {
        await tx.insert(notificationDeliveries).values(input.routing.fallbackEmailAddresses.map((destination) => ({
          organizationId: input.organizationId,
          notificationId: notification.id,
          destination,
        }))).onConflictDoNothing({ target: [notificationDeliveries.notificationId, notificationDeliveries.channel, notificationDeliveries.destination] });
      }
      return;
    }

    const [owner] = await tx.select({ membershipId: organizationMembers.id }).from(organizationMembers).where(and(
      eq(organizationMembers.organizationId, input.organizationId),
      eq(organizationMembers.role, 'OWNER'),
      eq(organizationMembers.status, 'active'),
    )).orderBy(asc(organizationMembers.createdAt), asc(organizationMembers.id)).limit(1);
    if (owner === undefined) return;
    const recipient = await this.userForMembership(tx, input.organizationId, owner.membershipId);
    if (recipient === undefined) return;
    const notification = await this.ensureNotification(tx, {
      organizationId: input.organizationId,
      recipientUserId: recipient.userId,
      recipientMembershipId: recipient.membershipId,
      teamId: input.teamId,
      handoverAssignmentId: input.assignment.id,
      resourceId: input.conversationId,
      title: input.title,
      body: `A conversation with ${input.customer} is waiting for a consultant.`,
      deduplicationKey: `HANDOVER_ASSIGNED:${input.conversationId}:${input.assignment.id}:${recipient.userId}`,
    });
    const destination = this.destinationForUser(recipient);
    if (input.routing.emailNotificationsEnabled && destination !== undefined) {
      await tx.insert(notificationDeliveries).values({
        organizationId: input.organizationId,
        notificationId: notification.id,
        recipientUserId: recipient.userId,
        recipientMembershipId: recipient.membershipId,
        destination,
      }).onConflictDoNothing({ target: [notificationDeliveries.notificationId, notificationDeliveries.channel, notificationDeliveries.destination] });
    }
  }

  private async selectRoundRobinMember(
    tx: Parameters<SlotlyFlowDatabase['transaction']>[0] extends (tx: infer Transaction) => unknown ? Transaction : never,
    organizationId: string,
    teamId: string,
    eligibleMembershipIds: readonly string[],
  ): Promise<string | undefined> {
    if (eligibleMembershipIds.length === 0) return undefined;
    const [last] = await tx.select({ assigneeMembershipId: handoverAssignments.assigneeMembershipId }).from(handoverAssignments).where(and(
      eq(handoverAssignments.organizationId, organizationId),
      eq(handoverAssignments.teamId, teamId),
      eq(handoverAssignments.status, 'ASSIGNED'),
    )).orderBy(desc(handoverAssignments.assignedAt), desc(handoverAssignments.id)).limit(1);
    const previousIndex = last?.assigneeMembershipId === null || last?.assigneeMembershipId === undefined
      ? -1
      : eligibleMembershipIds.indexOf(last.assigneeMembershipId);
    return eligibleMembershipIds[(previousIndex + 1) % eligibleMembershipIds.length];
  }

  private async userForMembership(
    tx: Parameters<SlotlyFlowDatabase['transaction']>[0] extends (tx: infer Transaction) => unknown ? Transaction : never,
    organizationId: string,
    membershipId: string,
  ): Promise<{ readonly membershipId: string; readonly userId: string; readonly accountEmail: string; readonly emailVerified: boolean; readonly preferredEmail: string | null; readonly emailNotificationsEnabled: boolean } | undefined> {
    const [row] = await tx.select({
      membershipId: organizationMembers.id,
      userId: users.id,
      accountEmail: users.emailNormalized,
      emailVerifiedAt: users.emailVerifiedAt,
      preferredEmail: userNotificationPreferences.preferredEmail,
      emailNotificationsEnabled: userNotificationPreferences.emailNotificationsEnabled,
    }).from(organizationMembers).innerJoin(users, eq(organizationMembers.userId, users.id))
      .leftJoin(userNotificationPreferences, eq(userNotificationPreferences.userId, users.id))
      .where(and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.id, membershipId),
        eq(organizationMembers.status, 'active'),
      ));
    if (row === undefined) return undefined;
    return {
      membershipId: row.membershipId,
      userId: row.userId,
      accountEmail: row.accountEmail,
      emailVerified: row.emailVerifiedAt !== null,
      preferredEmail: row.preferredEmail,
      emailNotificationsEnabled: row.emailNotificationsEnabled ?? true,
    };
  }

  private destinationForUser(recipient: { readonly accountEmail: string; readonly emailVerified: boolean; readonly preferredEmail: string | null; readonly emailNotificationsEnabled: boolean }): string | undefined {
    if (!recipient.emailNotificationsEnabled) return undefined;
    if (recipient.preferredEmail !== null) return recipient.preferredEmail;
    return recipient.emailVerified ? recipient.accountEmail : undefined;
  }

  private async ensureNotification(
    tx: Parameters<SlotlyFlowDatabase['transaction']>[0] extends (tx: infer Transaction) => unknown ? Transaction : never,
    input: {
      readonly organizationId: string;
      readonly recipientUserId: string | null;
      readonly recipientMembershipId: string | null;
      readonly teamId: string | null;
      readonly handoverAssignmentId: string;
      readonly resourceId: string;
      readonly title: string;
      readonly body: string;
      readonly deduplicationKey: string;
    },
  ): Promise<{ readonly id: string }> {
    const inserted = await tx.insert(notifications).values({
      organizationId: input.organizationId,
      type: 'HANDOVER_ASSIGNED',
      recipientUserId: input.recipientUserId,
      recipientMembershipId: input.recipientMembershipId,
      teamId: input.teamId,
      handoverAssignmentId: input.handoverAssignmentId,
      resourceType: 'CONVERSATION',
      resourceId: input.resourceId,
      title: input.title,
      body: input.body,
      deduplicationKey: input.deduplicationKey,
    }).onConflictDoNothing({ target: notifications.deduplicationKey }).returning({ id: notifications.id });
    if (inserted[0] !== undefined) return inserted[0];
    const [existing] = await tx.select({ id: notifications.id }).from(notifications).where(eq(notifications.deduplicationKey, input.deduplicationKey));
    if (existing === undefined) throw new Error('Notification idempotency lookup failed.');
    return existing;
  }
}

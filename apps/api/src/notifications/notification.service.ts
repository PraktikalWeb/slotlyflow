import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  AddTeamMemberRequest,
  CreateTeamRequest,
  HandoverAssignmentResponse,
  NotificationResponse,
  OrganizationNotificationSettingsResponse,
  UpdateOrganizationNotificationSettingsRequest,
  UpdateUserNotificationPreferencesRequest,
  UserNotificationPreferencesResponse,
} from '@slotlyflow/contracts';

import type { TrustedOrganizationContext } from '../organizations/organization.types.js';
import { DrizzleNotificationRepository, type HandoverPublication, type NotificationSettings } from './notification.repository.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const maximumFallbackEmails = 10;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(@Inject(DrizzleNotificationRepository) private readonly repository: DrizzleNotificationRepository) {}

  async listTeams(context: TrustedOrganizationContext) {
    return this.repository.listTeams(context.organizationId);
  }

  async createTeam(context: TrustedOrganizationContext, request: CreateTeamRequest) {
    const name = typeof request?.name === 'string' ? request.name.trim() : '';
    if (name.length === 0 || name.length > 120) throw new BadRequestException({ code: 'TEAM_INPUT_INVALID' });
    try {
      return await this.repository.createTeam(context.organizationId, name);
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException({ code: 'TEAM_NAME_UNAVAILABLE' });
      throw error;
    }
  }

  async addTeamMember(context: TrustedOrganizationContext, teamId: string, request: AddTeamMemberRequest): Promise<void> {
    const membershipId = request?.organizationMemberId;
    if (!uuidPattern.test(teamId) || typeof membershipId !== 'string' || !uuidPattern.test(membershipId)) {
      throw new BadRequestException({ code: 'TEAM_MEMBER_INPUT_INVALID' });
    }
    const added = await this.repository.addActiveMemberToTeam(context.organizationId, teamId, membershipId);
    if (!added) throw new NotFoundException({ code: 'TEAM_OR_MEMBERSHIP_ACCESS_NOT_FOUND' });
  }

  notificationSettings(context: TrustedOrganizationContext): Promise<OrganizationNotificationSettingsResponse> {
    return this.repository.notificationSettings(context.organizationId);
  }

  async updateNotificationSettings(
    context: TrustedOrganizationContext,
    request: UpdateOrganizationNotificationSettingsRequest,
  ): Promise<OrganizationNotificationSettingsResponse> {
    const normalized = this.normalizeNotificationSettings(request);
    if (normalized.handoverTeamId !== null) {
      const teams = await this.repository.listTeams(context.organizationId);
      if (!teams.some((team) => team.id === normalized.handoverTeamId)) {
        throw new NotFoundException({ code: 'HANDOVER_TEAM_ACCESS_NOT_FOUND' });
      }
    }
    return this.repository.saveNotificationSettings(context.organizationId, normalized);
  }

  userPreferences(userId: string): Promise<UserNotificationPreferencesResponse> {
    return this.repository.userPreferences(userId);
  }

  async updateUserPreferences(userId: string, request: UpdateUserNotificationPreferencesRequest): Promise<UserNotificationPreferencesResponse> {
    if (typeof request !== 'object' || request === null || typeof request.emailNotificationsEnabled !== 'boolean') {
      throw new BadRequestException({ code: 'NOTIFICATION_PREFERENCES_INPUT_INVALID' });
    }
    const preferredEmail = request.preferredEmail === null
      ? null
      : typeof request.preferredEmail === 'string'
        ? request.preferredEmail.trim().toLowerCase()
        : undefined;
    if (preferredEmail === undefined || (preferredEmail !== null && (preferredEmail.length > 320 || !emailPattern.test(preferredEmail)))) {
      throw new BadRequestException({ code: 'NOTIFICATION_PREFERENCES_INPUT_INVALID' });
    }
    return this.repository.saveUserPreferences(userId, {
      preferredEmail: preferredEmail === '' ? null : preferredEmail,
      emailNotificationsEnabled: request.emailNotificationsEnabled,
    });
  }

  async publishHandover(context: TrustedOrganizationContext, conversationId: string): Promise<HandoverAssignmentResponse> {
    if (!uuidPattern.test(conversationId)) this.notFound();
    const publication = await this.repository.publishHandoverForConversation(
      context.organizationId,
      conversationId,
      context.userId,
    );
    if (publication === undefined) this.notFound();
    this.logger.log({
      event: publication.created ? 'handover_assigned' : 'handover_assignment_reused',
      organization_id: publication.organizationId,
      conversation_id: conversationId,
      team_id: publication.assignment.teamId,
      user_id: publication.assignment.assigneeUserId,
      handover_assignment_id: publication.assignment.id,
    });
    return publication.assignment;
  }

  /**
   * Narrow server-only entry point for deterministic inbound automation. It
   * retains the established handover, routing, notification and delivery path,
   * while treating every persisted assignment, including WAITING, as ownership.
   */
  async publishHandoverForTrustedAutomation(input: {
    readonly organizationId: string;
    readonly conversationId: string;
  }): Promise<HandoverPublication | undefined> {
    const publication = await this.repository.publishHandoverForConversation(
      input.organizationId,
      input.conversationId,
      null,
      { preserveExistingAssignment: true },
    );
    if (publication !== undefined) {
      this.logger.log({
        event: publication.created ? 'automation_handover_created' : 'automation_handover_reused',
        organization_id: publication.organizationId,
        conversation_id: input.conversationId,
        handover_assignment_id: publication.assignment.id,
        status: publication.assignment.status,
      });
    }
    return publication;
  }

  hasHandoverForTrustedAutomation(input: {
    readonly organizationId: string;
    readonly conversationId: string;
  }): Promise<boolean> {
    return this.repository.hasHandoverForConversation(input.organizationId, input.conversationId);
  }

  async notificationsForRecipient(context: TrustedOrganizationContext): Promise<readonly NotificationResponse[]> {
    const rows = await this.repository.listForRecipient(context.organizationId, context.userId);
    return rows.map((notification) => ({
      id: notification.id,
      type: notification.type,
      resourceType: notification.resourceType,
      resourceId: notification.resourceId,
      title: notification.title,
      body: notification.body,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
    }));
  }

  unreadCountForRecipient(context: TrustedOrganizationContext): Promise<number> {
    return this.repository.unreadCountForRecipient(context.organizationId, context.userId);
  }

  async markRead(context: TrustedOrganizationContext, notificationId: string): Promise<void> {
    if (!uuidPattern.test(notificationId)) this.notFound();
    const marked = await this.repository.markReadForRecipient(context.organizationId, context.userId, notificationId);
    if (!marked) this.notFound();
  }

  private normalizeNotificationSettings(request: UpdateOrganizationNotificationSettingsRequest): NotificationSettings {
    if (typeof request !== 'object' || request === null || typeof request.emailNotificationsEnabled !== 'boolean' || !Array.isArray(request.fallbackEmailAddresses)) {
      throw new BadRequestException({ code: 'NOTIFICATION_SETTINGS_INPUT_INVALID' });
    }
    if (request.handoverTeamId !== null && !uuidPattern.test(request.handoverTeamId)) {
      throw new BadRequestException({ code: 'NOTIFICATION_SETTINGS_INPUT_INVALID' });
    }
    if (request.fallbackEmailAddresses.length > maximumFallbackEmails) {
      throw new BadRequestException({ code: 'NOTIFICATION_SETTINGS_INPUT_INVALID' });
    }
    const fallbackEmailAddresses = [...new Set(request.fallbackEmailAddresses.map((value) => (
      typeof value === 'string' ? value.trim().toLowerCase() : ''
    )))];
    if (fallbackEmailAddresses.some((email) => email === '' || email.length > 320 || !emailPattern.test(email))) {
      throw new BadRequestException({ code: 'NOTIFICATION_SETTINGS_INPUT_INVALID' });
    }
    return {
      handoverTeamId: request.handoverTeamId,
      fallbackEmailAddresses,
      emailNotificationsEnabled: request.emailNotificationsEnabled,
    };
  }

  private notFound(): never {
    throw new NotFoundException({ code: 'NOTIFICATION_RESOURCE_ACCESS_NOT_FOUND' });
  }

  private isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    if ('code' in error && error.code === '23505') return true;
    return 'cause' in error && this.isUniqueViolation(error.cause);
  }
}

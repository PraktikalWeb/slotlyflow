import { Body, Controller, Get, Inject, Param, Patch, Post, Req } from '@nestjs/common';
import type { AuthenticationConfig } from '@slotlyflow/config';
import type {
  AddTeamMemberRequest,
  CreateTeamRequest,
  HandoverAssignmentResponse,
  NotificationUnreadCountResponse,
  OrganizationNotificationSettingsResponse,
  OrganizationNotificationsResponse,
  TeamListResponse,
  TeamResponse,
  UpdateOrganizationNotificationSettingsRequest,
} from '@slotlyflow/contracts';
import type { FastifyRequest } from 'fastify';

import { AuthService } from '../auth/auth.service.js';
import { AUTH_CONFIG } from '../auth/auth.tokens.js';
import { CsrfService } from '../auth/csrf.service.js';
import { OrganizationContextService } from '../organizations/organization-context.service.js';
import { NotificationService } from './notification.service.js';

@Controller('organizations')
export class NotificationController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthenticationConfig,
    @Inject(CsrfService) private readonly csrf: CsrfService,
    @Inject(OrganizationContextService) private readonly contexts: OrganizationContextService,
    @Inject(NotificationService) private readonly notifications: NotificationService,
  ) {}

  @Get(':organizationId/teams')
  async listTeams(@Param('organizationId') organizationId: string, @Req() request: FastifyRequest): Promise<TeamListResponse> {
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'organization.read');
    return { teams: await this.notifications.listTeams(context) };
  }

  @Post(':organizationId/teams')
  async createTeam(@Param('organizationId') organizationId: string, @Body() body: CreateTeamRequest, @Req() request: FastifyRequest): Promise<TeamResponse> {
    this.csrf.assert(request);
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'organization.update');
    return this.notifications.createTeam(context, body);
  }

  @Post(':organizationId/teams/:teamId/members')
  async addTeamMember(
    @Param('organizationId') organizationId: string,
    @Param('teamId') teamId: string,
    @Body() body: AddTeamMemberRequest,
    @Req() request: FastifyRequest,
  ): Promise<void> {
    this.csrf.assert(request);
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'organization.update');
    await this.notifications.addTeamMember(context, teamId, body);
  }

  @Get(':organizationId/notification-settings')
  async notificationSettings(@Param('organizationId') organizationId: string, @Req() request: FastifyRequest): Promise<OrganizationNotificationSettingsResponse> {
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'organization.read');
    return this.notifications.notificationSettings(context);
  }

  @Patch(':organizationId/notification-settings')
  async updateNotificationSettings(
    @Param('organizationId') organizationId: string,
    @Body() body: UpdateOrganizationNotificationSettingsRequest,
    @Req() request: FastifyRequest,
  ): Promise<OrganizationNotificationSettingsResponse> {
    this.csrf.assert(request);
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'organization.update');
    return this.notifications.updateNotificationSettings(context, body);
  }

  @Post(':organizationId/conversations/:conversationId/handover')
  async requestHandover(
    @Param('organizationId') organizationId: string,
    @Param('conversationId') conversationId: string,
    @Req() request: FastifyRequest,
  ): Promise<HandoverAssignmentResponse> {
    this.csrf.assert(request);
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'handoff.accept');
    return this.notifications.publishHandover(context, conversationId);
  }

  @Get(':organizationId/notifications/unread-count')
  async unreadCount(@Param('organizationId') organizationId: string, @Req() request: FastifyRequest): Promise<NotificationUnreadCountResponse> {
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'conversation.read');
    return { count: await this.notifications.unreadCountForRecipient(context) };
  }

  @Get(':organizationId/notifications')
  async listNotifications(@Param('organizationId') organizationId: string, @Req() request: FastifyRequest): Promise<OrganizationNotificationsResponse> {
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'conversation.read');
    return { notifications: await this.notifications.notificationsForRecipient(context) };
  }

  @Post(':organizationId/notifications/:notificationId/read')
  async markRead(
    @Param('organizationId') organizationId: string,
    @Param('notificationId') notificationId: string,
    @Req() request: FastifyRequest,
  ): Promise<void> {
    this.csrf.assert(request);
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'conversation.read');
    await this.notifications.markRead(context, notificationId);
  }
}

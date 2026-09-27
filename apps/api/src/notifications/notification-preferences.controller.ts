import { Body, Controller, Get, Inject, Patch, Req } from '@nestjs/common';
import type { AuthenticationConfig } from '@slotlyflow/config';
import type { UpdateUserNotificationPreferencesRequest, UserNotificationPreferencesResponse } from '@slotlyflow/contracts';
import type { FastifyRequest } from 'fastify';

import { AuthService } from '../auth/auth.service.js';
import { AUTH_CONFIG } from '../auth/auth.tokens.js';
import { CsrfService } from '../auth/csrf.service.js';
import { NotificationService } from './notification.service.js';

@Controller('auth/notification-preferences')
export class NotificationPreferencesController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthenticationConfig,
    @Inject(CsrfService) private readonly csrf: CsrfService,
    @Inject(NotificationService) private readonly notifications: NotificationService,
  ) {}

  @Get()
  async get(@Req() request: FastifyRequest): Promise<UserNotificationPreferencesResponse> {
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    return this.notifications.userPreferences(actor.id);
  }

  @Patch()
  async update(@Body() body: UpdateUserNotificationPreferencesRequest, @Req() request: FastifyRequest): Promise<UserNotificationPreferencesResponse> {
    this.csrf.assert(request);
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    return this.notifications.updateUserPreferences(actor.id, body);
  }
}

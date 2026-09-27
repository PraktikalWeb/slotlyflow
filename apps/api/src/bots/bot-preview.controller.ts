import { Body, Controller, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import type { AuthenticationConfig } from '@slotlyflow/config';
import type { BotPreviewRequest, BotPreviewResetRequest, BotPreviewResetResponse, BotPreviewResponse } from '@slotlyflow/contracts';
import type { FastifyRequest } from 'fastify';

import { AuthService } from '../auth/auth.service.js';
import { AUTH_CONFIG } from '../auth/auth.tokens.js';
import { CsrfService } from '../auth/csrf.service.js';
import { OrganizationContextService } from '../organizations/organization-context.service.js';
import { BotPreviewService } from './bot-preview.service.js';

@Controller('organizations')
export class BotPreviewController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthenticationConfig,
    @Inject(CsrfService) private readonly csrf: CsrfService,
    @Inject(OrganizationContextService) private readonly contexts: OrganizationContextService,
    @Inject(BotPreviewService) private readonly previews: BotPreviewService,
  ) {}

  @Post(':organizationId/automation/preview')
  @HttpCode(200)
  async execute(
    @Param('organizationId') organizationId: string,
    @Body() body: BotPreviewRequest,
    @Req() request: FastifyRequest,
  ): Promise<BotPreviewResponse> {
    this.csrf.assert(request);
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'automation.read');
    return this.previews.execute(context, body);
  }

  @Post(':organizationId/automation/preview/reset')
  @HttpCode(200)
  async reset(
    @Param('organizationId') organizationId: string,
    @Body() body: BotPreviewResetRequest,
    @Req() request: FastifyRequest,
  ): Promise<BotPreviewResetResponse> {
    this.csrf.assert(request);
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'automation.read');
    return this.previews.reset(context, body);
  }
}

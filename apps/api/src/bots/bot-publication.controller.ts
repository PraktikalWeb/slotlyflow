import { Body, Controller, Get, Inject, Param, Patch, Req } from '@nestjs/common';
import type { AuthenticationConfig } from '@slotlyflow/config';
import type { BotPublicationResponse, UpdateBotPublicationRequest } from '@slotlyflow/contracts';
import type { FastifyRequest } from 'fastify';

import { AuthService } from '../auth/auth.service.js';
import { AUTH_CONFIG } from '../auth/auth.tokens.js';
import { CsrfService } from '../auth/csrf.service.js';
import { OrganizationContextService } from '../organizations/organization-context.service.js';
import { BotPublicationService } from './bot-publication.service.js';

/** Customer Business boundary: deployment identity remains server-derived. */
@Controller('organizations')
export class BotPublicationController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthenticationConfig,
    @Inject(CsrfService) private readonly csrf: CsrfService,
    @Inject(OrganizationContextService) private readonly contexts: OrganizationContextService,
    @Inject(BotPublicationService) private readonly publications: BotPublicationService,
  ) {}

  @Get(':organizationId/automation/publication')
  async getPublication(
    @Param('organizationId') organizationId: string,
    @Req() request: FastifyRequest,
  ): Promise<BotPublicationResponse> {
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'automation.read');
    return this.publications.publicationForBusiness(context);
  }

  @Patch(':organizationId/automation/publication')
  async setPublication(
    @Param('organizationId') organizationId: string,
    @Body() body: UpdateBotPublicationRequest,
    @Req() request: FastifyRequest,
  ): Promise<BotPublicationResponse> {
    this.csrf.assert(request);
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'automation.publish');
    return this.publications.setPublicationForBusiness(context, body);
  }
}

import { Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import type { AuthenticationConfig } from '@slotlyflow/config';
import type { WhatsAppConnectionResponse } from '@slotlyflow/contracts';
import type { FastifyRequest } from 'fastify';

import { AUTH_CONFIG } from '../auth/auth.tokens.js';
import { AuthService } from '../auth/auth.service.js';
import { CsrfService } from '../auth/csrf.service.js';
import { OrganizationContextService } from '../organizations/organization-context.service.js';
import { WhatsAppConnectionService } from './whatsapp-connection.service.js';

@Controller('organizations')
export class WhatsAppConnectionController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthenticationConfig,
    @Inject(OrganizationContextService) private readonly contexts: OrganizationContextService,
    @Inject(WhatsAppConnectionService) private readonly connections: WhatsAppConnectionService,
    @Inject(CsrfService) private readonly csrf: CsrfService,
  ) {}

  @Get(':organizationId/whatsapp-connection')
  async getConnection(
    @Param('organizationId') organizationId: string,
    @Req() request: FastifyRequest,
  ): Promise<WhatsAppConnectionResponse> {
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'whatsapp.read');
    return this.connections.getForContext(context);
  }

  @Post(':organizationId/whatsapp-connection/validate')
  async validateConnection(
    @Param('organizationId') organizationId: string,
    @Req() request: FastifyRequest,
  ): Promise<WhatsAppConnectionResponse> {
    this.csrf.assert(request);
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'whatsapp.manage');
    return this.connections.validateForContext(context);
  }
}

import { Body, Controller, Inject, Param, Post, Req } from '@nestjs/common';
import type { AuthenticationConfig } from '@slotlyflow/config';
import type { CompleteWhatsAppOnboardingRequest, CompleteWhatsAppOnboardingResponse, StartWhatsAppOnboardingRequest, StartWhatsAppOnboardingResponse } from '@slotlyflow/contracts';
import type { FastifyRequest } from 'fastify';

import { AuthService } from '../auth/auth.service.js';
import { AUTH_CONFIG } from '../auth/auth.tokens.js';
import { CsrfService } from '../auth/csrf.service.js';
import { OrganizationContextService } from '../organizations/organization-context.service.js';
import { createWabaSubscriptionDiagnosticReporter } from './waba-subscription-diagnostics.js';
import { createCoexistenceContactSyncDiagnosticReporter } from './coexistence-contact-sync-diagnostics.js';
import { createCoexistenceHistorySyncDiagnosticReporter } from './coexistence-history-sync-diagnostics.js';
import { WhatsAppOnboardingService } from './whatsapp-onboarding.service.js';

@Controller('organizations')
export class WhatsAppOnboardingController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthenticationConfig,
    @Inject(CsrfService) private readonly csrf: CsrfService,
    @Inject(OrganizationContextService) private readonly contexts: OrganizationContextService,
    @Inject(WhatsAppOnboardingService) private readonly onboarding: WhatsAppOnboardingService,
  ) {}

  @Post(':organizationId/whatsapp-connection/onboarding')
  async start(
    @Param('organizationId') organizationId: string,
    @Body() body: StartWhatsAppOnboardingRequest,
    @Req() request: FastifyRequest,
  ): Promise<StartWhatsAppOnboardingResponse> {
    this.csrf.assert(request);
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'whatsapp.manage');
    return this.onboarding.startConnectionOnboarding(context, body?.source);
  }

  @Post(':organizationId/whatsapp-connection/onboarding/:transactionId/complete')
  async complete(
    @Param('organizationId') organizationId: string,
    @Param('transactionId') transactionId: string,
    @Body() body: CompleteWhatsAppOnboardingRequest,
    @Req() request: FastifyRequest,
  ): Promise<CompleteWhatsAppOnboardingResponse> {
    this.csrf.assert(request);
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'whatsapp.manage');
    return this.onboarding.completeConnectionOnboarding(
      context,
      transactionId,
      body,
      createWabaSubscriptionDiagnosticReporter(request.id, request.log),
      createCoexistenceContactSyncDiagnosticReporter(request.id, request.log),
      createCoexistenceHistorySyncDiagnosticReporter(request.id, request.log),
    );
  }
}

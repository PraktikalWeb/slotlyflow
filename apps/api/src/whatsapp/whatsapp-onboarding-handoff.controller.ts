import { Body, Controller, Header, Inject, Post, Req } from '@nestjs/common';
import type {
  CompleteWhatsAppOnboardingHandoffRequest,
  CompleteWhatsAppOnboardingResponse,
  ResolveWhatsAppOnboardingHandoffRequest,
  ResolveWhatsAppOnboardingHandoffResponse,
} from '@slotlyflow/contracts';
import type { FastifyRequest } from 'fastify';

import { createWabaSubscriptionDiagnosticReporter } from './waba-subscription-diagnostics.js';
import { createCoexistenceContactSyncDiagnosticReporter } from './coexistence-contact-sync-diagnostics.js';
import { createCoexistenceHistorySyncDiagnosticReporter } from './coexistence-history-sync-diagnostics.js';
import { WhatsAppOnboardingService } from './whatsapp-onboarding.service.js';

/**
 * Capability-authenticated bridge for the separate HTTPS Meta popup.
 * It has no ambient session cookie, so the sealed, expiring transaction
 * handoff is the only authority and the service revalidates RBAC and state.
 */
@Controller('whatsapp-onboarding/handoff')
export class WhatsAppOnboardingHandoffController {
  constructor(
    @Inject(WhatsAppOnboardingService)
    private readonly onboarding: WhatsAppOnboardingService,
  ) {}

  @Post('resolve')
  @Header('cache-control', 'no-store')
  resolve(
    @Body() body: ResolveWhatsAppOnboardingHandoffRequest,
  ): Promise<ResolveWhatsAppOnboardingHandoffResponse> {
    return this.onboarding.resolveConnectionOnboardingHandoff(body?.handoffToken);
  }

  @Post('complete')
  @Header('cache-control', 'no-store')
  complete(
    @Body() body: CompleteWhatsAppOnboardingHandoffRequest,
    @Req() request: FastifyRequest,
  ): Promise<CompleteWhatsAppOnboardingResponse> {
    return this.onboarding.completeConnectionOnboardingHandoff(
      body,
      createWabaSubscriptionDiagnosticReporter(request.id, request.log),
      createCoexistenceContactSyncDiagnosticReporter(request.id, request.log),
      createCoexistenceHistorySyncDiagnosticReporter(request.id, request.log),
    );
  }
}

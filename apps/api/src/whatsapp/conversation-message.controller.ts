import { Body, Controller, Headers, Inject, Param, Post, Req } from '@nestjs/common';
import type { SendConversationTextResponse } from '@slotlyflow/contracts';
import type { AuthenticationConfig } from '@slotlyflow/config';
import type { FastifyRequest } from 'fastify';

import { AuthService } from '../auth/auth.service.js';
import { AUTH_CONFIG } from '../auth/auth.tokens.js';
import { CsrfService } from '../auth/csrf.service.js';
import { OrganizationContextService } from '../organizations/organization-context.service.js';
import { OutboundWhatsAppMessageService } from './outbound-whatsapp-message.service.js';

/** Minimal authenticated M3.2 harness; it accepts no provider routing identifiers. */
@Controller('organizations/:organizationId/conversations')
export class ConversationMessageController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthenticationConfig,
    @Inject(CsrfService) private readonly csrf: CsrfService,
    @Inject(OrganizationContextService) private readonly contexts: OrganizationContextService,
    @Inject(OutboundWhatsAppMessageService) private readonly outbound: OutboundWhatsAppMessageService,
  ) {}

  @Post(':conversationId/messages')
  async sendText(
    @Param('organizationId') organizationId: string,
    @Param('conversationId') conversationId: string,
    @Headers('idempotency-key') idempotencyKey: string | string[] | undefined,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ): Promise<SendConversationTextResponse> {
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    this.csrf.assert(request);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'conversation.reply');
    return this.outbound.sendConversationText(context, conversationId, body, Array.isArray(idempotencyKey) ? idempotencyKey[0] : idempotencyKey);
  }
}

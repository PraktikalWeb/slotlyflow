import { Inject, Injectable, Logger } from '@nestjs/common';

import type { InboundWhatsAppMessageRepository } from '../whatsapp/inbound-whatsapp-message.repository.js';
import { WHATSAPP_INBOUND_MESSAGE_REPOSITORY } from '../whatsapp/whatsapp-inbound-message.tokens.js';
import { NotificationService } from '../notifications/notification.service.js';
import { OutboundWhatsAppMessageService } from '../whatsapp/outbound-whatsapp-message.service.js';
import { createBuiltInBotRegistry } from './built-in-bot-registry.js';
import { isTrustedBotImplementationKey, type TrustedBotImplementationKey } from './trusted-bot-implementations.js';
import type { BuiltInBotRuntimeOutcome, StructuredBotOutput, TrustedBuiltInBotHandler, TrustedInboundBotRuntimeContext } from './built-in-bot-runtime.types.js';
import type { BotConversationStateRepository } from './bot-conversation-state.repository.js';
import { BOT_CONVERSATION_STATE_REPOSITORY } from './bot-conversation-state.tokens.js';
import type { OrganizationRepository } from '../organizations/organization.repository.js';
import { ORGANIZATION_REPOSITORY } from '../organizations/organization.tokens.js';

/**
 * Trusted dispatch for compiled, allow-listed implementations. There is no
 * dynamic import, tenant-provided code, or provider-facing execution surface.
 */
@Injectable()
export class BuiltInBotRuntime {
  private readonly logger = new Logger(BuiltInBotRuntime.name);
  private readonly handlers: Readonly<Record<TrustedBotImplementationKey, TrustedBuiltInBotHandler>>;

  constructor(
    @Inject(WHATSAPP_INBOUND_MESSAGE_REPOSITORY)
    private readonly inboundMessages: InboundWhatsAppMessageRepository,
    @Inject(NotificationService)
    private readonly handovers: NotificationService,
    @Inject(OutboundWhatsAppMessageService)
    private readonly outboundMessages: OutboundWhatsAppMessageService,
    @Inject(BOT_CONVERSATION_STATE_REPOSITORY)
    private readonly states: BotConversationStateRepository,
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizations: OrganizationRepository,
  ) {
    // This is an explicit allow-listed mapping to reviewed compiled code.
    // Deployment metadata can select only an existing key; it never supplies
    // a module path, script, URL, or arbitrary executable content.
    const reply = async (context: TrustedInboundBotRuntimeContext, output: StructuredBotOutput, idempotencyKey: string) => {
      await this.outboundMessages.sendTrustedAutomationMessage({
        organizationId: context.organizationId,
        whatsappConnectionId: context.whatsappConnectionId,
        conversationId: context.conversationId,
        output,
        idempotencyKey,
      });
    };
    this.handlers = createBuiltInBotRegistry({
      hasHandover: (context) => this.handovers.hasHandoverForTrustedAutomation(context),
      establishHandover: async (context) => {
        const result = await this.handovers.publishHandoverForTrustedAutomation(context);
        return result === undefined
          ? undefined
          : { created: result.created, assignmentId: result.assignment.id };
      },
      transition: (context, decide) => this.states.transition(context, decide),
      markHandover: (context) => this.states.markHandover(context),
      reply,
    }, {
      hasHandover: (context) => this.handovers.hasHandoverForTrustedAutomation(context),
      establishHandover: async (context, details) => {
        const result = await this.handovers.publishHandoverForTrustedAutomation({
          organizationId: context.organizationId,
          conversationId: context.conversationId,
          whatsappConnectionId: context.whatsappConnectionId,
          customerWhatsAppId: context.customerWhatsAppId,
          details,
        });
        return result === undefined ? undefined : { created: result.created, assignmentId: result.assignment.id };
      },
      transition: (context, decide) => this.states.transitionWansati(context, decide),
      getSettings: (context) => this.organizations.findSettingsForOrganization === undefined
        ? Promise.resolve(undefined)
        : this.organizations.findSettingsForOrganization(context.organizationId),
      reply,
    });
  }

  async execute(context: TrustedInboundBotRuntimeContext): Promise<BuiltInBotRuntimeOutcome> {
    // The inbound pipeline checks this before calling the runtime. Retain this
    // guard so a future server-side caller cannot bypass Business publication.
    if (!context.deployment.isPublished) return this.outcome(context, 'SKIPPED_UNPUBLISHED');
    if (!(await this.matchesTrustedRelationships(context))) return this.outcome(context, 'FAILED');
    if (context.messageType !== 'TEXT' && context.messageType !== 'INTERACTIVE_REPLY') {
      return this.outcome(context, 'SKIPPED_UNSUPPORTED_MESSAGE');
    }
    if (!isTrustedBotImplementationKey(context.deployment.implementationKey)) {
      return this.outcome(context, 'UNKNOWN_IMPLEMENTATION');
    }

    this.logger.log({
      event: 'bot_runtime_handler_resolved',
      organization_id: context.organizationId,
      whatsapp_connection_id: context.whatsappConnectionId,
      conversation_id: context.conversationId,
      bot_deployment_id: context.deployment.deploymentId,
      bot_version_id: context.deployment.botVersionId,
      implementation_key: context.deployment.implementationKey,
    });

    return this.outcome(context, await this.handlers[context.deployment.implementationKey].execute(context));
  }

  private async matchesTrustedRelationships(context: TrustedInboundBotRuntimeContext): Promise<boolean> {
    if (
      context.deployment.organizationId !== context.organizationId
      || context.deployment.whatsappConnectionId !== context.whatsappConnectionId
    ) return false;
    return this.inboundMessages.hasConversationForTrustedConnection({
      organizationId: context.organizationId,
      whatsappConnectionId: context.whatsappConnectionId,
      conversationId: context.conversationId,
    });
  }

  private outcome(
    context: TrustedInboundBotRuntimeContext,
    outcome: BuiltInBotRuntimeOutcome,
  ): BuiltInBotRuntimeOutcome {
    this.logger.log({
      event: 'built_in_bot_runtime_outcome',
      outcome,
      organization_id: context.organizationId,
      whatsapp_connection_id: context.whatsappConnectionId,
      conversation_id: context.conversationId,
      inbound_message_id: context.inboundMessageId,
      bot_deployment_id: context.deployment.deploymentId,
      bot_version_id: context.deployment.botVersionId,
      implementation_key: context.deployment.implementationKey,
    });
    return outcome;
  }
}

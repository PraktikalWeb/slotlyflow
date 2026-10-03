import { Inject, Injectable, Logger } from '@nestjs/common';

import type { InboundWhatsAppMessage } from './inbound-whatsapp-message.types.js';
import type { HumanBusinessAppMessage } from './human-business-app-message.types.js';
import { WHATSAPP_INBOUND_MESSAGE_REPOSITORY, WHATSAPP_OUTBOUND_MESSAGE_REPOSITORY } from './whatsapp-inbound-message.tokens.js';
import type { InboundWhatsAppMessageRepository } from './inbound-whatsapp-message.repository.js';
import type { OutboundWhatsAppMessageRepository, ProviderMessageStatusUpdate } from './outbound-whatsapp-message.repository.js';
import { WhatsAppConnectionTestService } from './whatsapp-connection-test.service.js';
import {
  noConnectionTestDiagnostics,
  type ConnectionTestDiagnosticReporter,
} from './connection-test-diagnostics.js';
import { ContactService } from '../contacts/contact.service.js';
import {
  noContactDiagnostics,
  type ContactDiagnosticReporter,
} from '../contacts/contact-diagnostics.js';
import { BotDeploymentResolver } from '../bots/bot-deployment-resolver.service.js';
import { BuiltInBotRuntime } from '../bots/built-in-bot-runtime.service.js';

@Injectable()
export class InboundWhatsAppMessageService {
  private readonly logger = new Logger(InboundWhatsAppMessageService.name);

  constructor(
    @Inject(WHATSAPP_INBOUND_MESSAGE_REPOSITORY)
    private readonly repository: InboundWhatsAppMessageRepository,
    @Inject(WHATSAPP_OUTBOUND_MESSAGE_REPOSITORY)
    private readonly outboundRepository: OutboundWhatsAppMessageRepository,
    @Inject(WhatsAppConnectionTestService)
    private readonly connectionTests: WhatsAppConnectionTestService,
    @Inject(ContactService)
    private readonly contacts: ContactService,
    @Inject(BotDeploymentResolver)
    private readonly botDeployments: BotDeploymentResolver,
    @Inject(BuiltInBotRuntime)
    private readonly botRuntime: BuiltInBotRuntime,
  ) {}

  async persistAll(
    messages: readonly InboundWhatsAppMessage[],
    connectionTestDiagnostics: ConnectionTestDiagnosticReporter = noConnectionTestDiagnostics,
    contactDiagnostics: ContactDiagnosticReporter = noContactDiagnostics,
  ): Promise<{ readonly stored: number; readonly duplicates: number; readonly unknownConnections: number; readonly connectionTestsIntercepted: number; readonly botDeploymentsResolved: number }> {
    let stored = 0;
    let duplicates = 0;
    let unknownConnections = 0;
    let connectionTestsIntercepted = 0;
    let botDeploymentsResolved = 0;
    for (const message of messages) {
      if (await this.connectionTests.interceptInbound(message, connectionTestDiagnostics)) {
        connectionTestsIntercepted += 1;
        continue;
      }
      await this.contacts.ingestInboundSender(message, contactDiagnostics);
      const result = await this.repository.persistVerifiedInboundMessage(message);
      if (result.outcome === 'stored') {
        stored += 1;
        if (result.handoverActive) {
          this.logger.log({ event: 'handover_activity_deadline_extended', organization_id: result.organizationId, conversation_id: result.conversationId });
          continue;
        }
        this.logger.log({
          event: 'bot_runtime_inbound_candidate',
          organization_id: result.organizationId,
          whatsapp_connection_id: result.connectionId,
          conversation_id: result.conversationId,
          inbound_message_id: result.inboundMessageId,
          message_type: message.messageType,
        });
        const deployment = await this.botDeployments.resolveActiveBotForInbound({
          organizationId: result.organizationId,
          whatsappConnectionId: result.connectionId,
        });
        if (deployment !== undefined) {
          botDeploymentsResolved += 1;
          this.logger.log({
            event: 'bot_runtime_deployment_resolved',
            organization_id: result.organizationId,
            whatsapp_connection_id: result.connectionId,
            conversation_id: result.conversationId,
            bot_deployment_id: deployment.deploymentId,
            bot_version_id: deployment.botVersionId,
            implementation_key: deployment.implementationKey,
          });
          if (!deployment.isPublished) {
            this.logger.log({
              event: 'bot_runtime_suppressed_unpublished',
              organization_id: result.organizationId,
              whatsapp_connection_id: result.connectionId,
              conversation_id: result.conversationId,
              bot_deployment_id: deployment.deploymentId,
            });
            continue;
          }
          this.logger.log({
            event: 'bot_runtime_publication_passed',
            organization_id: result.organizationId,
            whatsapp_connection_id: result.connectionId,
            conversation_id: result.conversationId,
            bot_deployment_id: deployment.deploymentId,
          });
          await this.botRuntime.execute({
            organizationId: result.organizationId,
            whatsappConnectionId: result.connectionId,
            conversationId: result.conversationId,
            inboundMessageId: result.inboundMessageId,
            providerMessageId: message.providerMessageId,
            receivedAt: message.occurredAt,
            customerWhatsAppId: result.customerWhatsAppId,
            messageType: message.messageType,
            input: message.messageType === 'INTERACTIVE_REPLY' && typeof message.interactiveOptionId === 'string'
              ? { type: 'interactive_reply', optionId: message.interactiveOptionId }
              : { type: 'text', text: message.textBody ?? '' },
            deployment,
          });
        }
      }
      else if (result.outcome === 'duplicate') duplicates += 1;
      else unknownConnections += 1;
    }
    return { stored, duplicates, unknownConnections, connectionTestsIntercepted, botDeploymentsResolved };
  }

  async applyAllStatuses(statuses: readonly ProviderMessageStatusUpdate[]): Promise<{
    readonly updated: number;
    readonly ignored: number;
    readonly unknownMessages: number;
    readonly unknownConnections: number;
  }> {
    let updated = 0;
    let ignored = 0;
    let unknownMessages = 0;
    let unknownConnections = 0;
    for (const status of statuses) {
      const outcome = await this.outboundRepository.applyProviderStatus(status);
      if (outcome === 'updated') updated += 1;
      else if (outcome === 'ignored') ignored += 1;
      else if (outcome === 'unknown_message') unknownMessages += 1;
      else unknownConnections += 1;
    }
    return { updated, ignored, unknownMessages, unknownConnections };
  }

  async persistAllHumanBusinessAppMessages(messages: readonly HumanBusinessAppMessage[]): Promise<{
    readonly stored: number;
    readonly duplicates: number;
    readonly unknownConnections: number;
    readonly unknownConversations: number;
    readonly activeHandovers: number;
  }> {
    let stored = 0;
    let duplicates = 0;
    let unknownConnections = 0;
    let unknownConversations = 0;
    let activeHandovers = 0;
    for (const message of messages) {
      const result = await this.repository.persistVerifiedHumanBusinessAppMessage(message);
      if (result.outcome === 'stored') {
        stored += 1;
        if (result.handoverActive) activeHandovers += 1;
      } else if (result.outcome === 'duplicate') duplicates += 1;
      else if (result.outcome === 'unknown_connection') unknownConnections += 1;
      else unknownConversations += 1;
    }
    return { stored, duplicates, unknownConnections, unknownConversations, activeHandovers };
  }
}

import { randomUUID } from 'node:crypto';

import { BadRequestException, ConflictException, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type {
  BotPreviewRequest,
  BotPreviewResetRequest,
  BotPreviewResetResponse,
  BotPreviewResponse,
} from '@slotlyflow/contracts';

import type { TrustedOrganizationContext } from '../organizations/organization.types.js';
import type { WhatsAppConnectionRepository } from '../whatsapp/whatsapp-connection.repository.js';
import { WHATSAPP_CONNECTION_REPOSITORY } from '../whatsapp/whatsapp-connection.tokens.js';
import { createBuiltInBotRegistry } from './built-in-bot-registry.js';
import { BotDeploymentResolver } from './bot-deployment-resolver.service.js';
import type { StructuredBotOutput, TrustedInboundBotRuntimeContext } from './built-in-bot-runtime.types.js';
import { BotPreviewSessionStore } from './bot-preview-session.store.js';
import { isTrustedBotImplementationKey } from './trusted-bot-implementations.js';

const maximumPreviewMessageLength = 4_096;
const optionIdPattern = /^[0-9A-Za-z._:=-]{1,255}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class BotPreviewService {
  private readonly logger = new Logger(BotPreviewService.name);

  constructor(
    @Inject(WHATSAPP_CONNECTION_REPOSITORY)
    private readonly connections: WhatsAppConnectionRepository,
    @Inject(BotDeploymentResolver)
    private readonly deployments: BotDeploymentResolver,
    @Inject(BotPreviewSessionStore)
    private readonly sessions: BotPreviewSessionStore,
  ) {}

  async execute(
    organization: TrustedOrganizationContext,
    request: BotPreviewRequest,
  ): Promise<BotPreviewResponse> {
    this.logger.log({
      event: 'bot_preview_request_received',
      organization_id: organization.organizationId,
      actor_user_id: organization.userId,
    });

    try {
      this.assertRequest(request);
      const connection = await this.connections.findForOrganization(organization.organizationId);
      if (connection === undefined || connection.connectionStatus !== 'CONNECTED') {
        throw new ConflictException({ code: 'BOT_PREVIEW_CONNECTION_UNAVAILABLE' });
      }

      const deployment = await this.deployments.resolveActiveBotForInbound({
        organizationId: organization.organizationId,
        whatsappConnectionId: connection.id,
      });
      if (deployment === undefined) throw new ConflictException({ code: 'BOT_PREVIEW_NOT_CONFIGURED' });
      if (!isTrustedBotImplementationKey(deployment.implementationKey)) {
        throw new ConflictException({ code: 'BOT_PREVIEW_IMPLEMENTATION_UNAVAILABLE' });
      }

      const execution = await this.sessions.run({
        previewSessionId: request.previewSessionId,
        organizationId: organization.organizationId,
        userId: organization.userId,
        botDeploymentId: deployment.deploymentId,
        botVersionId: deployment.botVersionId,
      }, async (session) => {
        const replies: StructuredBotOutput[] = [];
        const registry = createBuiltInBotRegistry({
          hasHandover: async () => session.handover || session.state === 'HANDOVER',
          establishHandover: async () => ({ created: true, assignmentId: 'preview' }),
          transition: async (_context, decide) => {
            const stateBefore = session.state;
            const decision = decide(stateBefore);
            session.state = decision.stateAfter;
            return { stateBefore, ...decision };
          },
          markHandover: async () => {
            session.state = 'HANDOVER';
            session.handover = true;
          },
          reply: async (_context, output) => { replies.push(output); },
        });

        const executionId = randomUUID();
        const runtimeContext: TrustedInboundBotRuntimeContext = {
          organizationId: organization.organizationId,
          whatsappConnectionId: connection.id,
          conversationId: session.id,
          inboundMessageId: executionId,
          providerMessageId: `preview:${executionId}`,
          customerWhatsAppId: 'preview',
          messageType: request.input.type === 'text' ? 'TEXT' : 'INTERACTIVE_REPLY',
          input: request.input,
          deployment,
        };
        const outcome = await registry[deployment.implementationKey].execute(runtimeContext);
        if (outcome !== 'EXECUTED' && outcome !== 'SKIPPED_HUMAN_HANDOVER') {
          throw new ServiceUnavailableException({ code: 'BOT_PREVIEW_EXECUTION_FAILED' });
        }
        return { replies, handover: session.handover || session.state === 'HANDOVER' };
      });

      this.logger.log({
        event: 'bot_preview_completed',
        organization_id: organization.organizationId,
        bot_deployment_id: deployment.deploymentId,
        implementation_key: deployment.implementationKey,
        normalized_input_type: request.input.type,
        handover: execution.result.handover,
      });
      return {
        previewSessionId: execution.previewSessionId,
        messages: execution.result.replies,
        handover: execution.result.handover,
      };
    } catch (error) {
      this.logger.warn({
        event: 'bot_preview_failed',
        organization_id: organization.organizationId,
        exception_type: exceptionType(error),
      });
      throw error;
    }
  }

  reset(organization: TrustedOrganizationContext, request: BotPreviewResetRequest): BotPreviewResetResponse {
    if (
      typeof request !== 'object'
      || request === null
      || typeof request.previewSessionId !== 'string'
      || !uuidPattern.test(request.previewSessionId)
      || Object.keys(request).some((key) => key !== 'previewSessionId')
    ) {
      throw new BadRequestException({ code: 'BOT_PREVIEW_RESET_REQUEST_INVALID' });
    }
    this.sessions.reset({
      previewSessionId: request.previewSessionId,
      organizationId: organization.organizationId,
      userId: organization.userId,
    });
    return { reset: true };
  }

  private assertRequest(request: BotPreviewRequest): void {
    if (
      typeof request !== 'object'
      || request === null
      || (request.previewSessionId !== null && (typeof request.previewSessionId !== 'string' || !uuidPattern.test(request.previewSessionId)))
      || typeof request.input !== 'object'
      || request.input === null
      || Object.keys(request).some((key) => key !== 'previewSessionId' && key !== 'input')
    ) {
      throw new BadRequestException({ code: 'BOT_PREVIEW_REQUEST_INVALID' });
    }
    if (request.input.type === 'text') {
      if (
        typeof request.input.text !== 'string'
        || request.input.text.trim().length === 0
        || request.input.text.trim().length > maximumPreviewMessageLength
        || Object.keys(request.input).some((key) => key !== 'type' && key !== 'text')
      ) throw new BadRequestException({ code: 'BOT_PREVIEW_REQUEST_INVALID' });
      return;
    }
    if (
      request.input.type !== 'interactive_reply'
      || typeof request.input.optionId !== 'string'
      || !optionIdPattern.test(request.input.optionId)
      || Object.keys(request.input).some((key) => key !== 'type' && key !== 'optionId')
    ) throw new BadRequestException({ code: 'BOT_PREVIEW_REQUEST_INVALID' });
  }
}

function exceptionType(error: unknown): string {
  return typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string'
    ? error.name
    : 'UnknownError';
}

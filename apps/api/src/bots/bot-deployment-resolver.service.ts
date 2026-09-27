import { Inject, Injectable, Logger } from '@nestjs/common';

import { BOT_DEPLOYMENT_REPOSITORY } from './bot-deployment.tokens.js';
import type { BotDeploymentRepository } from './bot-deployment.repository.js';
import type { ResolvedBotRuntimeMetadata } from './bot-deployment.types.js';

/**
 * Resolves only from a trusted, persisted Organization/connection pair. The
 * caller enforces the Business publication gate before runtime execution.
 */
@Injectable()
export class BotDeploymentResolver {
  private readonly logger = new Logger(BotDeploymentResolver.name);

  constructor(@Inject(BOT_DEPLOYMENT_REPOSITORY) private readonly repository: BotDeploymentRepository) {}

  async resolveActiveBotForInbound(input: {
    readonly organizationId: string;
    readonly whatsappConnectionId: string;
  }): Promise<ResolvedBotRuntimeMetadata | undefined> {
    try {
      return await this.repository.resolveActiveForTrustedConnection(input);
    } catch {
      // Resolution is optional until an engine exists; a read failure must not
      // block the already-verified inbound persistence path.
      this.logger.warn({ event: 'bot_deployment_resolution_failed', organizationId: input.organizationId, connectionId: input.whatsappConnectionId });
      return undefined;
    }
  }
}

import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import type { BotPublicationResponse, UpdateBotPublicationRequest } from '@slotlyflow/contracts';

import { BOT_DEPLOYMENT_REPOSITORY } from './bot-deployment.tokens.js';
import type { BotDeploymentRepository } from './bot-deployment.repository.js';
import type { TrustedOrganizationContext } from '../organizations/organization.types.js';

@Injectable()
export class BotPublicationService {
  constructor(@Inject(BOT_DEPLOYMENT_REPOSITORY) private readonly deployments: BotDeploymentRepository) {}

  async publicationForBusiness(context: TrustedOrganizationContext): Promise<BotPublicationResponse> {
    const publication = await this.deployments.publicationForTrustedOrganization({
      organizationId: context.organizationId,
    });
    return publication === undefined
      ? { status: 'NOT_CONFIGURED' }
      : { status: publication.isPublished ? 'PUBLISHED' : 'UNPUBLISHED' };
  }

  async setPublicationForBusiness(
    context: TrustedOrganizationContext,
    request: UpdateBotPublicationRequest,
  ): Promise<BotPublicationResponse> {
    if (
      typeof request !== 'object'
      || request === null
      || typeof request.published !== 'boolean'
      || Object.keys(request).some((key) => key !== 'published')
    ) {
      throw new BadRequestException({ code: 'BOT_PUBLICATION_REQUEST_INVALID' });
    }
    const publication = await this.setPublication(context.organizationId, context.userId, request.published);
    if (publication === undefined) throw new ConflictException({ code: 'BOT_PUBLICATION_NOT_CONFIGURED' });
    return { status: publication.isPublished ? 'PUBLISHED' : 'UNPUBLISHED' };
  }

  /** Internal development bridge; normal customer publication remains unchanged. */
  async publishForDevelopmentProvisioning(organizationId: string): Promise<BotPublicationResponse> {
    const publication = await this.setPublication(organizationId, null, true);
    if (publication === undefined) throw new ConflictException({ code: 'BOT_PUBLICATION_NOT_CONFIGURED' });
    return { status: publication.isPublished ? 'PUBLISHED' : 'UNPUBLISHED' };
  }

  private setPublication(organizationId: string, actorUserId: string | null, isPublished: boolean) {
    return this.deployments.setPublicationForTrustedOrganization({ organizationId, actorUserId, isPublished });
  }
}

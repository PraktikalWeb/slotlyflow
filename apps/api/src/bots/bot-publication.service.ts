import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { BotPublicationResponse, UpdateBotPublicationRequest } from '@slotlyflow/contracts';

import { BOT_DEPLOYMENT_REPOSITORY } from './bot-deployment.tokens.js';
import type { BotDeploymentRepository } from './bot-deployment.repository.js';
import type { TrustedOrganizationContext } from '../organizations/organization.types.js';
import type { PlatformAuthorizationContext } from '../platform-admin/platform-admin.types.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  publishForPlatformAdmin(
    actor: PlatformAuthorizationContext,
    deploymentId: string,
  ): Promise<BotPublicationResponse> {
    return this.setPublicationForPlatformAdmin(actor, deploymentId, true);
  }

  unpublishForPlatformAdmin(
    actor: PlatformAuthorizationContext,
    deploymentId: string,
  ): Promise<BotPublicationResponse> {
    return this.setPublicationForPlatformAdmin(actor, deploymentId, false);
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

  private async setPublicationForPlatformAdmin(
    actor: PlatformAuthorizationContext,
    deploymentId: string,
    isPublished: boolean,
  ): Promise<BotPublicationResponse> {
    if (!uuidPattern.test(deploymentId)) throw new NotFoundException({ code: 'BOT_DEPLOYMENT_NOT_FOUND' });
    const result = await this.deployments.setPublicationForPlatformDeployment({
      deploymentId,
      actorUserId: actor.user.id,
      actorPlatformRole: actor.staff.role,
      isPublished,
    });
    if (result.outcome === 'not_found') throw new NotFoundException({ code: 'BOT_DEPLOYMENT_NOT_FOUND' });
    if (result.outcome === 'deployment_inactive') {
      throw new ConflictException({ code: 'BOT_PUBLICATION_DEPLOYMENT_INACTIVE' });
    }
    return { status: result.publication.isPublished ? 'PUBLISHED' : 'UNPUBLISHED' };
  }
}

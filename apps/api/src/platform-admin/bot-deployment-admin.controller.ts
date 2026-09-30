import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { CsrfService } from '../auth/csrf.service.js';
import { BotDeploymentService } from '../bots/bot-deployment.service.js';
import { BotPublicationService } from '../bots/bot-publication.service.js';
import { PlatformAuthorizationGuard, requirePlatformRequestContext, type PlatformAuthorizedRequest } from './platform-authorization.guard.js';
import { RequirePlatformPermission } from './require-platform-permission.decorator.js';

/** Platform-only deployment administration. Business sessions never receive these routes. */
@Controller('admin/bots')
@UseGuards(PlatformAuthorizationGuard)
export class BotDeploymentAdminController {
  constructor(
    @Inject(CsrfService) private readonly csrf: CsrfService,
    @Inject(BotDeploymentService) private readonly bots: BotDeploymentService,
    @Inject(BotPublicationService) private readonly publications: BotPublicationService,
  ) {}

  @Get('catalogue')
  @RequirePlatformPermission('platform.operations.read')
  listCatalogue(): Promise<unknown> {
    return this.bots.listCatalogue();
  }

  @Get('deployments')
  @RequirePlatformPermission('platform.operations.read')
  listDeployments(
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Query('organizationId') organizationId: string | undefined,
    @Query('botDefinitionId') botDefinitionId: string | undefined,
    @Query('whatsappConnectionId') whatsappConnectionId: string | undefined,
  ): Promise<unknown> {
    return this.bots.listDeployments(
      page,
      pageSize,
      organizationId,
      botDefinitionId,
      whatsappConnectionId,
    );
  }

  @Post('definitions')
  @RequirePlatformPermission('platform.operations.manage')
  async createDefinition(@Body() body: unknown, @Req() request: PlatformAuthorizedRequest): Promise<unknown> {
    this.csrf.assert(request as FastifyRequest);
    return { definition: await this.bots.createDefinition(requirePlatformRequestContext(request), body) };
  }

  @Post('definitions/:botDefinitionId/versions')
  @RequirePlatformPermission('platform.operations.manage')
  async createVersion(@Param('botDefinitionId') botDefinitionId: string, @Body() body: unknown, @Req() request: PlatformAuthorizedRequest): Promise<unknown> {
    this.csrf.assert(request as FastifyRequest);
    return { version: await this.bots.createPublishedVersion(requirePlatformRequestContext(request), botDefinitionId, body) };
  }

  @Post('deployments')
  @RequirePlatformPermission('platform.operations.manage')
  async createDeployment(@Body() body: unknown, @Req() request: PlatformAuthorizedRequest): Promise<unknown> {
    this.csrf.assert(request as FastifyRequest);
    return { deployment: await this.bots.createDeployment(requirePlatformRequestContext(request), body) };
  }

  @Post('deployments/:deploymentId/activate')
  @RequirePlatformPermission('platform.operations.manage')
  async activate(@Param('deploymentId') deploymentId: string, @Req() request: PlatformAuthorizedRequest): Promise<unknown> {
    this.csrf.assert(request as FastifyRequest);
    return { deployment: await this.bots.activateDeployment(requirePlatformRequestContext(request), deploymentId) };
  }

  @Post('deployments/:deploymentId/deactivate')
  @RequirePlatformPermission('platform.operations.manage')
  async deactivate(@Param('deploymentId') deploymentId: string, @Req() request: PlatformAuthorizedRequest): Promise<unknown> {
    this.csrf.assert(request as FastifyRequest);
    return { deployment: await this.bots.deactivateDeployment(requirePlatformRequestContext(request), deploymentId) };
  }

  @Post('deployments/:deploymentId/publish')
  @RequirePlatformPermission('platform.operations.manage')
  async publish(@Param('deploymentId') deploymentId: string, @Req() request: PlatformAuthorizedRequest): Promise<unknown> {
    this.csrf.assert(request as FastifyRequest);
    return {
      publication: await this.publications.publishForPlatformAdmin(
        requirePlatformRequestContext(request),
        deploymentId,
      ),
    };
  }

  @Post('deployments/:deploymentId/unpublish')
  @RequirePlatformPermission('platform.operations.manage')
  async unpublish(@Param('deploymentId') deploymentId: string, @Req() request: PlatformAuthorizedRequest): Promise<unknown> {
    this.csrf.assert(request as FastifyRequest);
    return {
      publication: await this.publications.unpublishForPlatformAdmin(
        requirePlatformRequestContext(request),
        deploymentId,
      ),
    };
  }

  @Post('deployments/:deploymentId/version')
  @RequirePlatformPermission('platform.operations.manage')
  async changeVersion(@Param('deploymentId') deploymentId: string, @Body() body: unknown, @Req() request: PlatformAuthorizedRequest): Promise<unknown> {
    this.csrf.assert(request as FastifyRequest);
    return { deployment: await this.bots.changeDeploymentVersion(requirePlatformRequestContext(request), deploymentId, body) };
  }
}

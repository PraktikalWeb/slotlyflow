import { Body, Controller, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { CsrfService } from '../auth/csrf.service.js';
import { BotDeploymentService } from '../bots/bot-deployment.service.js';
import { PlatformAuthorizationGuard, requirePlatformRequestContext, type PlatformAuthorizedRequest } from './platform-authorization.guard.js';
import { RequirePlatformPermission } from './require-platform-permission.decorator.js';

/** Platform-only deployment administration. Business sessions never receive these routes. */
@Controller('admin/bots')
@UseGuards(PlatformAuthorizationGuard)
export class BotDeploymentAdminController {
  constructor(
    @Inject(CsrfService) private readonly csrf: CsrfService,
    @Inject(BotDeploymentService) private readonly bots: BotDeploymentService,
  ) {}

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

  @Post('deployments/:deploymentId/version')
  @RequirePlatformPermission('platform.operations.manage')
  async changeVersion(@Param('deploymentId') deploymentId: string, @Body() body: unknown, @Req() request: PlatformAuthorizedRequest): Promise<unknown> {
    this.csrf.assert(request as FastifyRequest);
    return { deployment: await this.bots.changeDeploymentVersion(requirePlatformRequestContext(request), deploymentId, body) };
  }
}

import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import { PlatformAuthorizationService } from './platform-authorization.service.js';
import { REQUIRED_PLATFORM_PERMISSIONS } from './require-platform-permission.decorator.js';
import { PlatformSessionService } from './platform-session.service.js';
import type { PlatformAuthorizationContext, PlatformPermission } from './platform-admin.types.js';

export interface PlatformAuthorizedRequest extends FastifyRequest {
  platformAuthorization?: PlatformAuthorizationContext;
}

@Injectable()
export class PlatformAuthorizationGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PlatformSessionService) private readonly sessions: PlatformSessionService,
    @Inject(PlatformAuthorizationService) private readonly authorization: PlatformAuthorizationService,
  ) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const request = executionContext.switchToHttp().getRequest<PlatformAuthorizedRequest>();
    const user = await this.sessions.requireAuthenticated(request);
    const context = await this.authorization.resolve(user);
    const required = this.reflector.getAllAndOverride<readonly PlatformPermission[]>(
      REQUIRED_PLATFORM_PERMISSIONS,
      [executionContext.getHandler(), executionContext.getClass()],
    ) ?? [];
    for (const permission of required) this.authorization.requirePermission(context, permission);
    request.platformAuthorization = context;
    return true;
  }
}

export function requirePlatformRequestContext(request: PlatformAuthorizedRequest): PlatformAuthorizationContext {
  if (request.platformAuthorization === undefined) {
    throw new Error('Platform authorization context is unavailable.');
  }
  return request.platformAuthorization;
}

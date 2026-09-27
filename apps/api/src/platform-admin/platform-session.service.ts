import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthenticationConfig } from '@slotlyflow/config';
import type { SlotlyFlowDatabase } from '@slotlyflow/database';
import type { FastifyRequest } from 'fastify';

import { AUTH_CONFIG, AUTH_DATABASE } from '../auth/auth.tokens.js';
import { resolveAuthenticatedSession, type AuthenticatedSessionUser } from '../auth/session-authentication.js';

@Injectable()
export class PlatformSessionService {
  constructor(
    @Inject(AUTH_DATABASE) private readonly db: SlotlyFlowDatabase,
    @Inject(AUTH_CONFIG) private readonly config: AuthenticationConfig,
  ) {}

  async requireAuthenticated(request: FastifyRequest): Promise<AuthenticatedSessionUser> {
    const user = await resolveAuthenticatedSession(this.db, request.cookies[this.config.session.cookieName]);
    if (user === undefined) throw new UnauthorizedException();
    return user;
  }
}

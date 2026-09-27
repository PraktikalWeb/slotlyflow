import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import type { AuthenticationConfig } from '@slotlyflow/config';
import type { StartWhatsAppConnectionTestRequest, WhatsAppConnectionTestResponse } from '@slotlyflow/contracts';
import type { FastifyRequest } from 'fastify';

import { AUTH_CONFIG } from '../auth/auth.tokens.js';
import { AuthService } from '../auth/auth.service.js';
import { CsrfService } from '../auth/csrf.service.js';
import { OrganizationContextService } from '../organizations/organization-context.service.js';
import { WhatsAppConnectionTestService } from './whatsapp-connection-test.service.js';
import { createWabaSubscriptionDiagnosticReporter } from './waba-subscription-diagnostics.js';

@Controller('organizations')
export class WhatsAppConnectionTestController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthenticationConfig,
    @Inject(OrganizationContextService) private readonly contexts: OrganizationContextService,
    @Inject(CsrfService) private readonly csrf: CsrfService,
    @Inject(WhatsAppConnectionTestService) private readonly tests: WhatsAppConnectionTestService,
  ) {}

  @Get(':organizationId/whatsapp-connection/test')
  async status(@Param('organizationId') organizationId: string, @Req() request: FastifyRequest): Promise<WhatsAppConnectionTestResponse> {
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'whatsapp.read');
    return this.tests.status(context);
  }

  @Post(':organizationId/whatsapp-connection/test')
  async start(
    @Param('organizationId') organizationId: string,
    @Body() body: StartWhatsAppConnectionTestRequest,
    @Req() request: FastifyRequest,
  ): Promise<WhatsAppConnectionTestResponse> {
    this.csrf.assert(request);
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'whatsapp.manage');
    let result: WhatsAppConnectionTestResponse;
    try {
      result = await this.tests.start(
        context,
        body,
        createWabaSubscriptionDiagnosticReporter(request.id, request.log),
      );
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        request.log.error(
          { connection_test_stage: 'start', ...safeConnectionTestDiagnostic(error) },
          'WhatsApp Connection Test start failed',
        );
      }
      throw error;
    }
    request.log.info({ connection_test_started: true }, 'WhatsApp Connection Test started');
    return result;
  }
}

/** Development diagnostics deliberately exclude request bodies, numbers, tokens, and error messages. */
function safeConnectionTestDiagnostic(error: unknown): {
  readonly exception_type: string;
  readonly cause_type?: string;
  readonly database_code?: string;
} {
  const exceptionType = error instanceof Error ? error.name : typeof error;
  const cause = nestedCause(error);
  const candidate = safeErrorCode(error) ?? safeErrorCode(cause);

  return {
    exception_type: exceptionType,
    ...(cause === undefined ? {} : { cause_type: cause instanceof Error ? cause.name : typeof cause }),
    ...(typeof candidate === 'string' && /^[0-9A-Z_]{1,16}$/.test(candidate) ? { database_code: candidate } : {}),
  };
}

/** Drizzle attaches the PostgreSQL error as `cause`; cap traversal to avoid untrusted cyclic structures. */
function nestedCause(error: unknown): unknown {
  let current = error;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current !== 'object' || current === null || !('cause' in current)) {
      return current === error ? undefined : current;
    }
    const cause = (current as { readonly cause?: unknown }).cause;
    if (cause === undefined || cause === current) return current === error ? undefined : current;
    current = cause;
  }
  return current;
}

function safeErrorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error
    ? (error as { readonly code?: unknown }).code
    : undefined;
}

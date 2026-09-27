import 'reflect-metadata';

import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { LogController } from 'fastify';
import { loadApiConfig, loadAuthenticationConfig, loadMetaWhatsAppConfig, type ApiConfig, type MetaWhatsAppConfig } from '@slotlyflow/config';
import type { DatabaseConnection } from '@slotlyflow/database';
import { isSafeRequestId } from '@slotlyflow/security';

import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './http-exception.filter.js';
import { ReadinessService } from './readiness.service.js';
import type { OidcIdentityProvider } from './auth/oidc/oidc-identity-provider.js';
import type { EmailProvider } from './email/email-provider.js';
import type { WhatsAppConnectionProvider } from './whatsapp/whatsapp-provider.js';
import type { WhatsAppMessagingProvider } from './whatsapp/whatsapp-messaging-provider.js';
import type { CredentialStore } from './whatsapp/credential-store.js';

export async function createApplication(
  config: ApiConfig = loadApiConfig(),
  database: DatabaseConnection,
  oidcProvider?: OidcIdentityProvider,
  authenticationConfig = loadAuthenticationConfig(),
  emailProvider?: EmailProvider,
  metaWhatsAppConfig: MetaWhatsAppConfig | undefined = loadMetaWhatsAppConfig(),
  whatsappConnectionProvider?: WhatsAppConnectionProvider,
  whatsappMessagingProvider?: WhatsAppMessagingProvider,
  credentialStore?: CredentialStore,
): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    bodyLimit: config.requestBodyLimitBytes,
    // SlotlyFlow emits a correlation-only request event below; Fastify's default request log includes callback URLs.
    logController: new LogController({ disableRequestLogging: true }),
    logger: {
      level: config.environment === 'production' ? 'info' : 'debug',
      base: { service: 'api', environment: config.environment },
    },
    requestIdHeader: 'x-request-id',
    genReqId: (request: IncomingMessage) => {
      const incomingRequestId = request.headers['x-request-id'];
      const requestId = Array.isArray(incomingRequestId) ? incomingRequestId[0] : incomingRequestId;
      return isSafeRequestId(requestId) ? requestId : randomUUID();
    },
  });
  const application = await NestFactory.create<NestFastifyApplication>(AppModule.register(database, authenticationConfig, oidcProvider, emailProvider, metaWhatsAppConfig, whatsappConnectionProvider, whatsappMessagingProvider, credentialStore), adapter, {
    logger: false,
    // Nest retains raw bytes only for handlers that request them. The Meta
    // webhook controller is the sole application route that reads rawBody.
    rawBody: true,
  });
  application.get(ReadinessService).setDatabase(database);

  await application.register(cookie);
  await application.register(helmet, { contentSecurityPolicy: false });
  if (config.cors.enabled) {
    await application.register(cors, {
      origin: [...config.cors.origins],
      credentials: true,
      methods: ['GET', 'HEAD', 'POST', 'PATCH'],
    });
  }

  application.useGlobalFilters(new HttpExceptionFilter());

  const server = application.getHttpAdapter().getInstance();
  server.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
    request.log.info(
      { correlation_id: request.id, request_id: request.id },
      'request started',
    );
  });
  server.addHook('onResponse', async (request, reply) => {
    if (request.method !== 'POST' || request.routeOptions.url !== '/auth/register') return;
    request.log.info(
      {
        correlation_id: request.id,
        workflow: 'registration',
        registration_stage: 'http_response_sent',
        registration_outcome: reply.statusCode < 400 ? 'success' : 'failure',
        ...(reply.statusCode < 400 ? {} : { http_status: reply.statusCode }),
      },
      'Registration stage completed',
    );
  });

  return application;
}

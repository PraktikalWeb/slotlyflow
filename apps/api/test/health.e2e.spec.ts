import { afterEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { DatabaseConnection } from '@slotlyflow/database';

import { createApplication } from '../src/application.js';

describe('health endpoints', () => {
  let application: NestFastifyApplication | undefined;

  afterEach(async () => {
    await application?.close();
  });

  it('reports liveness and startup readiness with a correlation identifier', async () => {
    application = await createApplication({
      environment: 'test',
      host: '127.0.0.1',
      port: 3001,
      requestBodyLimitBytes: 1_048_576,
      cors: { enabled: false, origins: [] },
    }, {
      db: {} as DatabaseConnection['db'],
      check: async () => true,
      close: async () => undefined,
    });
    await application.init();

    const server = application.getHttpAdapter().getInstance();
    const health = await server.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'health-test' },
    });
    const ready = await server.inject({ method: 'GET', url: '/ready' });

    expect(health.statusCode).toBe(200);
    expect(health.headers['x-request-id']).toBe('health-test');
    expect(health.json()).toEqual({ status: 'ok', service: 'api' });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toEqual({ status: 'ok', service: 'api' });
  });

  it('keeps liveness available while reporting an unavailable database dependency as not ready', async () => {
    application = await createApplication({
      environment: 'test',
      host: '127.0.0.1',
      port: 3001,
      requestBodyLimitBytes: 1_048_576,
      cors: { enabled: false, origins: [] },
    }, {
      db: {} as DatabaseConnection['db'],
      check: async () => false,
      close: async () => undefined,
    });
    await application.init();

    const server = application.getHttpAdapter().getInstance();
    const health = await server.inject({ method: 'GET', url: '/health' });
    const ready = await server.inject({ method: 'GET', url: '/ready' });

    expect(health.statusCode).toBe(200);
    expect(ready.statusCode).toBe(503);
    expect(ready.json()).toMatchObject({ error: { code: 'DEPENDENCY_UNAVAILABLE' } });
  });

  it('permits credentialed browser requests only for explicitly configured CORS origins', async () => {
    application = await createApplication({
      environment: 'test',
      host: '127.0.0.1',
      port: 3001,
      requestBodyLimitBytes: 1_048_576,
      cors: { enabled: true, origins: ['https://web.example.test'] },
    }, {
      db: {} as DatabaseConnection['db'],
      check: async () => true,
      close: async () => undefined,
    });
    await application.init();

    const response = await application.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/auth/csrf',
      headers: { origin: 'https://web.example.test' },
    });

    expect(response.headers['access-control-allow-origin']).toBe('https://web.example.test');
    expect(response.headers['access-control-allow-credentials']).toBe('true');

    const profileUpdatePreflight = await application.getHttpAdapter().getInstance().inject({
      method: 'OPTIONS',
      url: '/auth/me',
      headers: {
        origin: 'https://web.example.test',
        'access-control-request-method': 'PATCH',
        'access-control-request-headers': 'content-type,x-csrf-token',
      },
    });

    expect(profileUpdatePreflight.statusCode).toBe(204);
    expect(profileUpdatePreflight.headers['access-control-allow-origin']).toBe('https://web.example.test');
    expect(profileUpdatePreflight.headers['access-control-allow-credentials']).toBe('true');
    expect(profileUpdatePreflight.headers['access-control-allow-methods']).toContain('PATCH');
  });
});

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { DatabaseConnection } from '@slotlyflow/database';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '../src/application.js';

describe('authentication bootstrap', () => {
  let application: NestFastifyApplication | undefined;

  afterEach(async () => {
    await application?.close();
  });

  it('resolves authentication dependencies and registers the CSRF cookie plugin', async () => {
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

    const response = await application.getHttpAdapter().getInstance().inject({ method: 'GET', url: '/auth/csrf' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ csrfToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) });
    expect(response.headers['set-cookie']).toContain('slotlyflow_csrf=');
    expect(response.headers['set-cookie']).not.toContain('HttpOnly');
  });
});

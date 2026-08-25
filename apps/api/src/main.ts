import 'reflect-metadata';

import { loadApiConfig, loadDatabaseConfig } from '@slotlyflow/config';
import { createDatabaseConnection } from '@slotlyflow/database';

import { createApplication } from './application.js';

async function bootstrap(): Promise<void> {
  const config = loadApiConfig();
  const database = createDatabaseConnection(loadDatabaseConfig());
  const application = await createApplication(config, database);
  await application.listen({ host: config.host, port: config.port });
}

void bootstrap().catch(() => {
  process.stderr.write(
    `${JSON.stringify({
      level: 'error',
      service: 'api',
      error_code: 'DATABASE_STARTUP_FAILED',
      message: 'API startup failed because a required dependency is unavailable.',
    })}\n`,
  );
  process.exitCode = 1;
});

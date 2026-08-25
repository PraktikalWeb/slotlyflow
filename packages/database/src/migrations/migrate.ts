import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { loadDatabaseConfig } from '@slotlyflow/config';

import { createDatabaseConnection } from '../client/connection.js';

async function runMigrations(): Promise<void> {
  const connection = createDatabaseConnection(loadDatabaseConfig());
  try {
    await migrate(connection.db, {
      migrationsFolder: fileURLToPath(new URL('.', import.meta.url)),
    });
  } finally {
    await connection.close();
  }
}

void runMigrations().catch(() => {
  const failureCode = process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.trim() === ''
    ? 'DATABASE_URL_REQUIRED'
    : 'DATABASE_MIGRATION_FAILED';

  console.error(JSON.stringify({
    level: 'error',
    code: failureCode,
    message: failureCode === 'DATABASE_URL_REQUIRED'
      ? 'DATABASE_URL is required to run database migrations.'
      : 'Database migration failed. Review the database configuration and migration state without exposing credentials.',
  }));
  process.exitCode = 1;
});

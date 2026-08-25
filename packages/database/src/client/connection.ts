import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { DatabaseConfig } from '@slotlyflow/config';

import type { DatabaseConnection } from '../types/database.js';

export function createDatabaseConnection(config: DatabaseConfig): DatabaseConnection {
  const client = postgres(config.url, {
    max: config.pool.maxConnections,
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  });
  const db = drizzle({ client });

  return {
    db,
    async check(): Promise<boolean> {
      try {
        await client`select 1`;
        return true;
      } catch {
        return false;
      }
    },
    async close(): Promise<void> {
      await client.end({ timeout: 5 });
    },
  };
}

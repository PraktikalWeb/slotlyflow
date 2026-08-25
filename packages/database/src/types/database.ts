import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export type SlotlyFlowDatabase = PostgresJsDatabase;

export interface DatabaseConnection {
  readonly db: SlotlyFlowDatabase;
  check(): Promise<boolean>;
  close(): Promise<void>;
}

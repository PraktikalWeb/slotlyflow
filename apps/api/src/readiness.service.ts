import { Injectable, type OnApplicationShutdown } from '@nestjs/common';

import type { DatabaseConnection } from '@slotlyflow/database';

type DatabaseReadiness = Pick<DatabaseConnection, 'check' | 'close'>;

@Injectable()
export class ReadinessService implements OnApplicationShutdown {
  private database: DatabaseReadiness | undefined;

  setDatabase(database: DatabaseReadiness): void {
    this.database = database;
  }

  async isReady(): Promise<boolean> {
    return this.database === undefined ? false : this.database.check();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.database?.close();
  }
}

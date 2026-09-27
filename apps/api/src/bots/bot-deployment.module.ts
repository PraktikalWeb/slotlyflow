import { DynamicModule, Module } from '@nestjs/common';
import type { DatabaseConnection } from '@slotlyflow/database';

import { AUTH_DATABASE } from '../auth/auth.tokens.js';
import { DrizzleBotDeploymentRepository } from './bot-deployment.repository.js';
import { BotDeploymentResolver } from './bot-deployment-resolver.service.js';
import { BotDeploymentService } from './bot-deployment.service.js';
import { BotPublicationService } from './bot-publication.service.js';
import { BOT_DEPLOYMENT_REPOSITORY } from './bot-deployment.tokens.js';

@Module({})
export class BotDeploymentModule {
  static register(database: DatabaseConnection): DynamicModule {
    return {
      module: BotDeploymentModule,
      providers: [
        BotDeploymentService,
        BotDeploymentResolver,
        BotPublicationService,
        DrizzleBotDeploymentRepository,
        { provide: AUTH_DATABASE, useValue: database.db },
        { provide: BOT_DEPLOYMENT_REPOSITORY, useExisting: DrizzleBotDeploymentRepository },
      ],
      exports: [BotDeploymentService, BotDeploymentResolver, BotPublicationService],
    };
  }
}

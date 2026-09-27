import { DynamicModule, Module } from '@nestjs/common';
import type { AuthenticationConfig } from '@slotlyflow/config';
import type { DatabaseConnection } from '@slotlyflow/database';

import { AUTH_CONFIG, AUTH_DATABASE } from '../auth/auth.tokens.js';
import { CsrfService } from '../auth/csrf.service.js';
import { BotDeploymentModule } from '../bots/bot-deployment.module.js';
import { BotDeploymentAdminController } from './bot-deployment-admin.controller.js';
import { PlatformAdminController } from './platform-admin.controller.js';
import { DrizzlePlatformAdminRepository } from './platform-admin.repository.js';
import { PlatformAdminService } from './platform-admin.service.js';
import { PLATFORM_ADMIN_REPOSITORY, PLATFORM_STAFF_REPOSITORY } from './platform-admin.tokens.js';
import { PlatformAuthorizationGuard } from './platform-authorization.guard.js';
import { PlatformAuthorizationService } from './platform-authorization.service.js';
import { PlatformSessionService } from './platform-session.service.js';
import { DrizzlePlatformStaffRepository } from './platform-staff.repository.js';
import { PlatformStaffService } from './platform-staff.service.js';

@Module({})
export class PlatformAdminModule {
  static register(database: DatabaseConnection, authConfig: AuthenticationConfig): DynamicModule {
    return {
      module: PlatformAdminModule,
      imports: [BotDeploymentModule.register(database)],
      controllers: [PlatformAdminController, BotDeploymentAdminController],
      providers: [
        CsrfService,
        PlatformSessionService,
        PlatformAuthorizationService,
        PlatformAuthorizationGuard,
        PlatformStaffService,
        PlatformAdminService,
        DrizzlePlatformStaffRepository,
        DrizzlePlatformAdminRepository,
        { provide: AUTH_DATABASE, useValue: database.db },
        { provide: AUTH_CONFIG, useValue: authConfig },
        { provide: PLATFORM_STAFF_REPOSITORY, useExisting: DrizzlePlatformStaffRepository },
        { provide: PLATFORM_ADMIN_REPOSITORY, useExisting: DrizzlePlatformAdminRepository },
      ],
      exports: [BotDeploymentModule],
    };
  }
}

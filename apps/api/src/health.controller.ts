import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { ServiceStatusResponse } from '@slotlyflow/contracts';

import { ReadinessService } from './readiness.service.js';

@Controller()
export class HealthController {
  constructor(@Inject(ReadinessService) private readonly readiness: ReadinessService) {}

  @Get('health')
  health(): ServiceStatusResponse {
    return { status: 'ok', service: 'api' };
  }

  @Get('ready')
  async ready(): Promise<ServiceStatusResponse> {
    if (!(await this.readiness.isReady())) {
      throw new ServiceUnavailableException();
    }

    return { status: 'ok', service: 'api' };
  }
}

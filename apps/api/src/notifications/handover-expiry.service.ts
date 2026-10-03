import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';

import { NotificationService } from './notification.service.js';

const sweepIntervalMilliseconds = 15 * 60_000;
const sweepBatchSize = 100;

/** Database-backed, bounded recurring work; no timer belongs to an individual handover. */
@Injectable()
export class HandoverExpiryService {
  private readonly logger = new Logger(HandoverExpiryService.name);

  constructor(@Inject(NotificationService) private readonly handovers: NotificationService) {}

  async processDue(now = new Date()): Promise<{ readonly due: number; readonly closed: number }> {
    const due = await this.handovers.dueHandovers(now, sweepBatchSize);
    let closed = 0;
    for (const handover of due) {
      try {
        if (await this.handovers.closeExpiredHandover({
          organizationId: handover.organizationId,
          handoverId: handover.id,
        }, new Date()) === 'closed') closed += 1;
      } catch {
        this.logger.warn({ event: 'handover_expiry_close_failed', organization_id: handover.organizationId, handover_assignment_id: handover.id });
      }
    }
    this.logger.log({ event: 'handover_expiry_sweep_completed', due_count: due.length, processed_count: closed });
    return { due: due.length, closed };
  }
}

@Injectable()
export class HandoverExpiryScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(HandoverExpiryScheduler.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(@Inject(HandoverExpiryService) private readonly expiry: HandoverExpiryService) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => { void this.run(); }, sweepIntervalMilliseconds);
    void this.run();
  }

  onModuleDestroy(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.logger.log({ event: 'handover_expiry_sweep_started' });
    try {
      await this.expiry.processDue();
    } catch {
      this.logger.warn({ event: 'handover_expiry_sweep_failed' });
    } finally {
      this.running = false;
    }
  }
}

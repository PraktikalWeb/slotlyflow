import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import type { AuthenticationConfig } from '@slotlyflow/config';

import { AUTH_CONFIG, EMAIL_PROVIDER } from '../auth/auth.tokens.js';
import type { EmailProvider } from '../email/email-provider.js';
import { DrizzleNotificationRepository } from './notification.repository.js';

const maximumAttempts = 3;
const staleSendingMilliseconds = 15 * 60 * 1_000;
const dispatcherIntervalMilliseconds = 15_000;

/**
 * A durable PostgreSQL-claimed dispatcher. It is intentionally separate from
 * notification producers and can move to a dedicated worker without changing
 * notification creation, authorization, or delivery records.
 */
@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(
    @Inject(DrizzleNotificationRepository) private readonly repository: DrizzleNotificationRepository,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(AUTH_CONFIG) private readonly authConfig: AuthenticationConfig,
  ) {}

  async processAvailable(limit = 10): Promise<void> {
    for (let index = 0; index < limit; index += 1) {
      const now = new Date();
      const delivery = await this.repository.claimNextDelivery(
        now,
        new Date(now.getTime() - staleSendingMilliseconds),
        maximumAttempts,
      );
      if (delivery === undefined) return;

      const authorization = await this.repository.revalidateDelivery(delivery);
      if (!authorization.allowed) {
        const blocked = await this.repository.markDeliveryBlocked(delivery, authorization.reason, new Date());
        this.logger.warn({
          event: blocked ? 'notification_delivery_blocked' : 'notification_delivery_stale_claim',
          organization_id: authorization.organizationId,
          notification_id: delivery.notificationId,
          delivery_id: delivery.id,
          failure_reason: authorization.reason,
        });
        continue;
      }

      let result: Awaited<ReturnType<EmailProvider['sendNotificationEmail']>>;
      try {
        result = await this.email.sendNotificationEmail({
          to: authorization.destination,
          subject: 'New WhatsApp handover assigned to you',
          businessName: authorization.businessName,
          customerDisplayName: authorization.customerDisplayName,
          conversationUrl: this.conversationUrl(authorization.conversationId),
        });
      } catch {
        const status = await this.repository.markDeliveryFailed(delivery, maximumAttempts, new Date());
        this.logger.warn({
          event: status === 'STALE_CLAIM' ? 'notification_delivery_stale_claim' : 'notification_email_failed',
          organization_id: delivery.organizationId,
          notification_id: delivery.notificationId,
          delivery_id: delivery.id,
          delivery_status: status,
        });
        continue;
      }

      try {
        const markedSent = await this.repository.markDeliverySent(delivery, result.providerMessageId, new Date());
        if (!markedSent) {
          await this.repository.markDeliveryOutcomeUncertain(delivery, new Date());
          this.logger.error({
            event: 'notification_delivery_provider_accepted_persistence_uncertain',
            organization_id: authorization.organizationId,
            notification_id: delivery.notificationId,
            delivery_id: delivery.id,
          });
          continue;
        }
        this.logger.log({
          event: 'notification_email_sent',
          organization_id: authorization.organizationId,
          notification_id: delivery.notificationId,
          delivery_id: delivery.id,
        });
      } catch {
        // SMTP already accepted this message. Do not put it back on the automatic
        // retry path because that would create a known duplicate-delivery risk.
        try {
          await this.repository.markDeliveryOutcomeUncertain(delivery, new Date());
        } catch {
          // The original persistence ambiguity remains; keep logs free of provider details.
        }
        this.logger.error({
          event: 'notification_delivery_provider_accepted_persistence_uncertain',
          organization_id: delivery.organizationId,
          notification_id: delivery.notificationId,
          delivery_id: delivery.id,
        });
      }
    }
  }

  private conversationUrl(conversationId: string): string {
    if (this.authConfig.email.provider !== 'smtp') {
      throw new Error('Notification email delivery is not configured.');
    }
    const url = new URL('/dashboard/conversations', this.authConfig.email.webAppUrl);
    url.searchParams.set('conversationId', conversationId);
    return url.toString();
  }
}

@Injectable()
export class NotificationDeliveryScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDeliveryScheduler.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(@Inject(NotificationDeliveryService) private readonly deliveries: NotificationDeliveryService) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => { void this.run(); }, dispatcherIntervalMilliseconds);
    void this.run();
  }

  onModuleDestroy(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.deliveries.processAvailable();
    } catch {
      this.logger.warn({ event: 'notification_delivery_dispatch_failed' });
    } finally {
      this.running = false;
    }
  }
}

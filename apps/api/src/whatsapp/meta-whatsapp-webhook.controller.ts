import { BadRequestException, Controller, Get, Headers, HttpCode, Inject, Post, Query, Req, Res, ServiceUnavailableException } from '@nestjs/common';
import type { MetaWhatsAppConfig } from '@slotlyflow/config';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { InboundWhatsAppMessageService } from './inbound-whatsapp-message.service.js';
import { MetaWebhookPayloadError, normalizeMetaWhatsAppWebhook } from './meta-whatsapp-webhook.adapter.js';
import { hasValidMetaWebhookSignature, matchesMetaWebhookVerifyToken } from './meta-whatsapp-webhook-signature.js';
import { META_WHATSAPP_CONFIG } from './whatsapp-onboarding.tokens.js';
import { createConnectionTestDiagnosticReporter } from './connection-test-diagnostics.js';
import { ContactService } from '../contacts/contact.service.js';
import { createContactDiagnosticReporter } from '../contacts/contact-diagnostics.js';
import { createCoexistenceHistorySyncDiagnosticReporter } from './coexistence-history-sync-diagnostics.js';
import { WhatsAppOnboardingService } from './whatsapp-onboarding.service.js';

type RawBodyRequest = FastifyRequest & { readonly rawBody?: Buffer };

@Controller('webhooks/meta/whatsapp')
export class MetaWhatsAppWebhookController {
  constructor(
    @Inject(META_WHATSAPP_CONFIG) private readonly metaConfig: MetaWhatsAppConfig | undefined,
    @Inject(InboundWhatsAppMessageService)
    private readonly inboundMessageService: InboundWhatsAppMessageService,
    @Inject(ContactService)
    private readonly contacts: ContactService,
    @Inject(WhatsAppOnboardingService)
    private readonly onboarding: WhatsAppOnboardingService,
  ) {}

  @Get()
  verify(
    @Query('hub.mode') mode: unknown,
    @Query('hub.verify_token') verifyToken: unknown,
    @Query('hub.challenge') challenge: unknown,
    @Res() reply: FastifyReply,
  ): void {
    const config = this.requireConfiguration();
    if (mode !== 'subscribe' || !matchesMetaWebhookVerifyToken(verifyToken, config.webhookVerifyToken) || !isSafeChallenge(challenge)) {
      throw new BadRequestException({ code: 'META_WEBHOOK_VERIFICATION_REJECTED' });
    }
    reply.type('text/plain; charset=utf-8').code(200).send(challenge);
  }

  @Post()
  @HttpCode(200)
  async receive(
    @Req() request: RawBodyRequest,
    @Headers('x-hub-signature-256') signature: string | string[] | undefined,
  ): Promise<void> {
    const config = this.requireConfiguration();
    const rawBody = request.rawBody;
    if (rawBody === undefined || !hasValidMetaWebhookSignature(rawBody, signature, config.appSecret)) {
      throw new BadRequestException({ code: 'META_WEBHOOK_SIGNATURE_INVALID' });
    }
    request.log.info({ provider: 'META', webhook_signature_valid: true }, 'Meta WhatsApp webhook signature verified');

    let normalized;
    try {
      normalized = normalizeMetaWhatsAppWebhook(request.body);
    } catch (error) {
      if (error instanceof MetaWebhookPayloadError) {
        throw new BadRequestException({ code: 'META_WEBHOOK_PAYLOAD_INVALID' });
      }
      throw error;
    }
    const contactDiagnostics = createContactDiagnosticReporter(request.id, request.log);
    const historyDiagnostics = createCoexistenceHistorySyncDiagnosticReporter(request.id, request.log);
    let coexistenceContactPersistence = { created: 0, existing: 0, updatedAsSaved: 0, skipped: 0 };
    if (normalized.coexistenceSyncEvents > 0) {
      contactDiagnostics({
        event: 'coexistence_contact_sync_received',
        entriesReceived: normalized.coexistenceContactEntriesReceived,
        skipped: normalized.coexistenceContactEntriesSkipped,
      });
      coexistenceContactPersistence = await this.contacts.ingestCoexistenceContacts(
        normalized.coexistenceContacts,
        contactDiagnostics,
      );
      contactDiagnostics({
        event: 'coexistence_contact_sync_processed',
        entriesReceived: normalized.coexistenceContactEntriesReceived,
        created: coexistenceContactPersistence.created,
        existing: coexistenceContactPersistence.existing,
        skipped: normalized.coexistenceContactEntriesSkipped + coexistenceContactPersistence.skipped,
      });
    }

    let historyContactsCreated = 0;
    let historyContactsExisting = 0;
    let historyContactsSkipped = 0;
    let historyEntriesReceived = 0;
    for (const history of normalized.coexistenceHistoryEvents) {
      historyEntriesReceived += history.entriesReceived;
      historyContactsSkipped += history.entriesSkipped;
      historyDiagnostics({
        event: 'coexistence_history_sync_webhook_received',
        entriesReceived: history.entriesReceived,
        threadsExamined: history.entriesReceived,
        validUniqueIdentities: new Set(history.contacts.map((contact) => contact.whatsappId)).size,
        contactsSkipped: history.entriesSkipped,
      });
      contactDiagnostics({
        event: 'coexistence_history_sync_received',
        entriesReceived: history.entriesReceived,
        skipped: history.entriesSkipped,
      });

      if (history.declined) {
        await this.onboarding.recordCoexistenceHistoryWebhookOutcome(
          history.destinationPhoneNumberId,
          'DECLINED',
          historyDiagnostics,
        );
        continue;
      }

      const persistence = await this.contacts.ingestCoexistenceHistoryContacts(
        history.contacts,
        contactDiagnostics,
      );
      historyContactsCreated += persistence.created;
      historyContactsExisting += persistence.existing;
      historyContactsSkipped += persistence.skipped;
      contactDiagnostics({
        event: 'coexistence_history_sync_processed',
        entriesReceived: history.entriesReceived,
        created: persistence.created,
        existing: persistence.existing,
        skipped: history.entriesSkipped + persistence.skipped,
      });
      if (history.processed) {
        await this.onboarding.recordCoexistenceHistoryWebhookOutcome(
          history.destinationPhoneNumberId,
          'PROCESSED',
          historyDiagnostics,
        );
      }
    }

    const persisted = await this.inboundMessageService.persistAll(
      normalized.messages,
      createConnectionTestDiagnosticReporter(request.id, request.log),
      contactDiagnostics,
    );
    const humanEchoPersistence = await this.inboundMessageService.persistAllHumanBusinessAppMessages(
      normalized.humanBusinessAppMessages,
    );
    const statusPersistence = await this.inboundMessageService.applyAllStatuses(normalized.statuses);
    request.log.info(
      {
        correlation_id: request.id,
        provider: 'META',
        webhook_outcome: 'accepted',
        inbound_messages_received: normalized.messages.length,
        inbound_messages_stored: persisted.stored,
        duplicate_messages: persisted.duplicates,
        connection_tests_intercepted: persisted.connectionTestsIntercepted,
        bot_deployments_resolved: persisted.botDeploymentsResolved,
        business_app_echoes_received: normalized.humanBusinessAppMessages.length,
        business_app_echoes_stored: humanEchoPersistence.stored,
        business_app_echoes_duplicate: humanEchoPersistence.duplicates,
        business_app_echoes_unknown_connections: humanEchoPersistence.unknownConnections,
        business_app_echoes_unknown_conversations: humanEchoPersistence.unknownConversations,
        business_app_echoes_active_handovers: humanEchoPersistence.activeHandovers,
        unknown_connections: persisted.unknownConnections,
        provider_statuses_received: normalized.statuses.length,
        provider_statuses_updated: statusPersistence.updated,
        provider_statuses_ignored: statusPersistence.ignored + normalized.ignoredStatusEvents,
        provider_statuses_unknown_messages: statusPersistence.unknownMessages,
        provider_statuses_unknown_connections: statusPersistence.unknownConnections,
        ignored_events: normalized.ignoredEvents,
        coexistence_sync_events: normalized.coexistenceSyncEvents,
        coexistence_contact_entries_received: normalized.coexistenceContactEntriesReceived,
        coexistence_contacts_created: coexistenceContactPersistence.created,
        coexistence_contacts_existing: coexistenceContactPersistence.existing,
        coexistence_contacts_skipped: normalized.coexistenceContactEntriesSkipped + coexistenceContactPersistence.skipped,
        coexistence_contacts_updated_as_saved: coexistenceContactPersistence.updatedAsSaved,
        coexistence_history_events: normalized.coexistenceHistoryEvents.length,
        coexistence_history_entries_received: historyEntriesReceived,
        coexistence_history_contacts_created: historyContactsCreated,
        coexistence_history_contacts_existing: historyContactsExisting,
        coexistence_history_contacts_skipped: historyContactsSkipped,
      },
      'Meta WhatsApp webhook processed',
    );
  }

  private requireConfiguration(): MetaWhatsAppConfig {
    if (this.metaConfig === undefined) {
      throw new ServiceUnavailableException({ code: 'META_WEBHOOK_CONFIGURATION_UNAVAILABLE' });
    }
    return this.metaConfig;
  }
}

function isSafeChallenge(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 2_048 && !/[\r\n]/.test(value);
}

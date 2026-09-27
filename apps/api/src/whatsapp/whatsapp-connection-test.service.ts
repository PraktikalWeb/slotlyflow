import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import type { StartWhatsAppConnectionTestRequest, WhatsAppConnectionTestResponse } from '@slotlyflow/contracts';

import type { TrustedOrganizationContext } from '../organizations/organization.types.js';
import type { InboundWhatsAppMessage } from './inbound-whatsapp-message.types.js';
import { ConnectionTestReplyError, OutboundWhatsAppMessageService } from './outbound-whatsapp-message.service.js';
import { WhatsAppConnectionService } from './whatsapp-connection.service.js';
import { WHATSAPP_CONNECTION_REPOSITORY } from './whatsapp-connection.tokens.js';
import type { WhatsAppConnectionRepository } from './whatsapp-connection.repository.js';
import { DrizzleWhatsAppConnectionTestRepository, type ConnectionTestRow } from './whatsapp-connection-test.repository.js';
import { normalizeConnectionTestPhoneNumber, normalizeConnectionTestWebhookSender, type ConnectionTestPhoneNumberIssue } from './connection-test-phone-number.js';
import {
  noWabaSubscriptionDiagnostics,
  type WabaSubscriptionDiagnosticReporter,
} from './waba-subscription-diagnostics.js';
import {
  noConnectionTestDiagnostics,
  type ConnectionTestDiagnosticReporter,
} from './connection-test-diagnostics.js';

const fifteenMinutes = 15 * 60 * 1_000;
export const CONNECTION_TEST_REPLY = '✅ SlotlyFlow connection test successful\n\nYour WhatsApp connection can receive and respond to messages correctly.';

@Injectable()
export class WhatsAppConnectionTestService {
  constructor(
    @Inject(DrizzleWhatsAppConnectionTestRepository)
    private readonly tests: DrizzleWhatsAppConnectionTestRepository,
    @Inject(WHATSAPP_CONNECTION_REPOSITORY)
    private readonly connections: WhatsAppConnectionRepository,
    @Inject(OutboundWhatsAppMessageService)
    private readonly outbound: OutboundWhatsAppMessageService,
    @Inject(WhatsAppConnectionService)
    private readonly connectionService: WhatsAppConnectionService,
  ) {}

  async start(
    context: TrustedOrganizationContext,
    body: StartWhatsAppConnectionTestRequest,
    diagnostics: WabaSubscriptionDiagnosticReporter = noWabaSubscriptionDiagnostics,
  ): Promise<WhatsAppConnectionTestResponse> {
    const normalized = normalizeConnectionTestPhoneNumber(body?.testPhoneNumber);
    if (!normalized.ok) throw new BadRequestException({ code: phoneNumberErrorCode(normalized.issue) });
    const sender = normalized.value;
    const connection = await this.connections.findForOrganization(context.organizationId);
    if (
      connection === undefined || connection.connectionStatus !== 'CONNECTED' || connection.verificationStatus !== 'VERIFIED' ||
      connection.externalPhoneNumberId === null
    ) throw new ConflictException({ code: 'WHATSAPP_CONNECTION_TEST_UNAVAILABLE' });
    await this.connectionService.ensureWabaSubscriptionForContext(context, diagnostics);
    const test = await this.tests.createReplacingActive({
      organizationId: context.organizationId,
      whatsappConnectionId: connection.id,
      destinationPhoneNumberId: connection.externalPhoneNumberId,
      testSenderPhoneNumber: sender,
      expiresAt: new Date(Date.now() + fifteenMinutes),
    });
    return responseFromRow(test);
  }

  async status(context: TrustedOrganizationContext): Promise<WhatsAppConnectionTestResponse> {
    const connection = await this.connections.findForOrganization(context.organizationId);
    if (connection === undefined) return { test: emptyTest() };
    const tests = await this.tests.recentForOrganization(context.organizationId, connection.id);
    for (const test of tests) {
      const normalized = normalizeConnectionTestPhoneNumber(test.testSenderPhoneNumber);
      if (!normalized.ok) continue;
      const canonical = await this.tests.updateCanonicalSender(test, normalized.value);
      return responseFromRow(canonical);
    }
    return { test: emptyTest() };
  }

  /** Returns true only when this exact inbound provider event belongs to an active platform test. */
  async interceptInbound(
    message: InboundWhatsAppMessage,
    diagnostics: ConnectionTestDiagnosticReporter = noConnectionTestDiagnostics,
  ): Promise<boolean> {
    if (message.messageType !== 'TEXT') return false;
    const sender = normalizeConnectionTestWebhookSender(message.customerWhatsAppId);
    if (sender === undefined) return false;
    const claimed = await this.tests.claimMatchingInbound({
      provider: message.provider,
      destinationPhoneNumberId: message.destinationPhoneNumberId,
      senderPhoneNumber: sender,
      providerMessageId: message.providerMessageId,
    });
    if (claimed === undefined) return false;

    const diagnosticContext = {
      organizationId: claimed.organizationId,
      connectionId: claimed.connectionId,
      connectionTestId: claimed.test.id,
      inboundProviderMessageId: message.providerMessageId,
    };
    diagnostics({ event: 'connection_test_message_received', ...diagnosticContext });
    diagnostics({ event: 'connection_test_reply_requested', ...diagnosticContext });

    try {
      const result = await this.outbound.sendConnectionTestReply({
        provider: message.provider,
        senderPhoneNumberId: claimed.senderPhoneNumberId,
        // Meta's trusted inbound `from` is the provider-native digits-only recipient ID.
        recipientWhatsAppId: message.customerWhatsAppId,
        credentialReference: claimed.credentialReference,
        text: CONNECTION_TEST_REPLY,
        organizationId: claimed.organizationId,
        connectionId: claimed.connectionId,
        connectionTestId: claimed.test.id,
      }, diagnostics);
      diagnostics({
        event: 'connection_test_reply_meta_accepted',
        ...diagnosticContext,
        outboundProviderMessageId: result.providerMessageId,
        resultClassification: 'ACCEPTED',
      });
      await this.tests.markReplyAcceptedAndPassed(claimed.test.id, message.providerMessageId, result.acceptedAt);
      diagnostics({ event: 'connection_test_passed', ...diagnosticContext, outboundProviderMessageId: result.providerMessageId });
    } catch (error) {
      await this.tests.markReplyFailed(
        claimed.test.id,
        message.providerMessageId,
        error instanceof ConnectionTestReplyError ? error.failureCode : 'REPLY_FAILED',
      );
      if (!(error instanceof ConnectionTestReplyError)) {
        diagnostics({ event: 'connection_test_reply_failed', ...diagnosticContext, resultClassification: 'INTERNAL' });
      }
    }
    return true;
  }
}

function phoneNumberErrorCode(issue: ConnectionTestPhoneNumberIssue): string {
  if (issue === 'REQUIRED') return 'CONNECTION_TEST_PHONE_NUMBER_REQUIRED';
  return 'CONNECTION_TEST_PHONE_NUMBER_INVALID';
}

function emptyTest(): WhatsAppConnectionTestResponse['test'] {
  return { id: null, status: 'NOT_TESTED', stage: null, testSenderPhoneNumber: null, expiresAt: null, inboundReceivedAt: null, replySentAt: null, completedAt: null };
}

function responseFromRow(row: ConnectionTestRow): WhatsAppConnectionTestResponse {
  return { test: {
    id: row.id,
    status: row.status,
    stage: row.stage,
    testSenderPhoneNumber: row.testSenderPhoneNumber,
    expiresAt: row.expiresAt.toISOString(),
    inboundReceivedAt: row.inboundReceivedAt?.toISOString() ?? null,
    replySentAt: row.replySentAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  } };
}

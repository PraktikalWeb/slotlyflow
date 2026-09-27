import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { SendConversationTextResponse } from '@slotlyflow/contracts';

import type { StructuredBotOutput } from '../bots/built-in-bot-runtime.types.js';
import type { CredentialStore, ProviderCredentialReference } from './credential-store.js';
import type { TrustedOrganizationContext } from '../organizations/organization.types.js';
import { WHATSAPP_CONNECTION_REPOSITORY } from './whatsapp-connection.tokens.js';
import type { WhatsAppConnectionRepository } from './whatsapp-connection.repository.js';
import {
  WHATSAPP_CREDENTIAL_STORE,
  WHATSAPP_MESSAGING_PROVIDER,
  WHATSAPP_OUTBOUND_MESSAGE_REPOSITORY,
} from './whatsapp-inbound-message.tokens.js';
import type {
  OutboundWhatsAppMessageRepository,
  OutboundMessageContent,
  PersistedOutboundMessage,
} from './outbound-whatsapp-message.repository.js';
import { WhatsAppMessagingProviderError, type WhatsAppMessagingProvider } from './whatsapp-messaging-provider.js';
import type { ConnectionTestDiagnosticReporter } from './connection-test-diagnostics.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const idempotencyKeyPattern = /^[A-Za-z0-9._:-]{16,128}$/;
const interactiveOptionIdPattern = /^[0-9A-Za-z._:=-]{1,255}$/;
const maximumTextLength = 4_096;

@Injectable()
export class OutboundWhatsAppMessageService {
  constructor(
    @Inject(WHATSAPP_OUTBOUND_MESSAGE_REPOSITORY)
    private readonly repository: OutboundWhatsAppMessageRepository,
    @Inject(WHATSAPP_CONNECTION_REPOSITORY)
    private readonly connections: WhatsAppConnectionRepository,
    @Inject(WHATSAPP_CREDENTIAL_STORE)
    private readonly credentials: CredentialStore | undefined,
    @Inject(WHATSAPP_MESSAGING_PROVIDER)
    private readonly messagingProvider: WhatsAppMessagingProvider | undefined,
  ) {}

  async sendConversationText(
    context: TrustedOrganizationContext,
    conversationId: string,
    body: unknown,
    idempotencyKey: unknown,
  ): Promise<SendConversationTextResponse> {
    if (!uuidPattern.test(conversationId)) this.notFound();
    const text = normalizeText(body);
    const safeIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);
    const message = await this.sendTrustedConversationMessage({
      organizationId: context.organizationId,
      conversationId,
      content: { type: 'TEXT', body: text, options: null },
      idempotencyKey: safeIdempotencyKey,
    });
    return responseFromMessage(message);
  }

  /**
   * Internal automation boundary. The identifiers must originate from verified
   * persisted inbound state; this method accepts no browser or provider payload.
   */
  async sendTrustedAutomationText(input: {
    readonly organizationId: string;
    readonly whatsappConnectionId: string;
    readonly conversationId: string;
    readonly text: string;
    readonly idempotencyKey: string;
  }): Promise<SendConversationTextResponse> {
    if (!uuidPattern.test(input.organizationId) || !uuidPattern.test(input.whatsappConnectionId) || !uuidPattern.test(input.conversationId)) {
      throw new ConflictException({ code: 'WHATSAPP_AUTOMATION_CONTEXT_INVALID' });
    }
    const message = await this.sendTrustedConversationMessage({
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      expectedConnectionId: input.whatsappConnectionId,
      content: { type: 'TEXT', body: normalizeText({ text: input.text }), options: null },
      idempotencyKey: normalizeIdempotencyKey(input.idempotencyKey),
    });
    return responseFromMessage(message);
  }

  async sendTrustedAutomationMessage(input: {
    readonly organizationId: string;
    readonly whatsappConnectionId: string;
    readonly conversationId: string;
    readonly output: StructuredBotOutput;
    readonly idempotencyKey: string;
  }): Promise<void> {
    if (!uuidPattern.test(input.organizationId) || !uuidPattern.test(input.whatsappConnectionId) || !uuidPattern.test(input.conversationId)) {
      throw new ConflictException({ code: 'WHATSAPP_AUTOMATION_CONTEXT_INVALID' });
    }
    await this.sendTrustedConversationMessage({
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      expectedConnectionId: input.whatsappConnectionId,
      content: normalizeBotOutput(input.output),
      idempotencyKey: normalizeIdempotencyKey(input.idempotencyKey),
    });
  }

  private async sendTrustedConversationMessage(input: {
    readonly organizationId: string;
    readonly conversationId: string;
    readonly expectedConnectionId?: string;
    readonly content: OutboundMessageContent;
    readonly idempotencyKey: string;
  }): Promise<PersistedOutboundMessage> {
    const conversation = await this.repository.findConversationForReply(input.organizationId, input.conversationId);
    if (conversation === undefined) this.notFound();
    if (input.expectedConnectionId !== undefined && conversation.whatsappConnectionId !== input.expectedConnectionId) {
      throw new ConflictException({ code: 'WHATSAPP_AUTOMATION_CONTEXT_INVALID' });
    }

    const connection = await this.connections.findForOrganization(input.organizationId);
    if (
      connection === undefined ||
      connection.id !== conversation.whatsappConnectionId ||
      connection.connectionStatus !== 'CONNECTED' ||
      connection.externalPhoneNumberId === null ||
      connection.credentialReference === null
    ) {
      throw new ConflictException({ code: 'WHATSAPP_CONNECTION_SEND_UNAVAILABLE' });
    }

    const reservation = await this.repository.reserve({ organizationId: input.organizationId }, conversation, input.idempotencyKey, input.content);
    if (reservation.outcome === 'completed') return reservation.message;
    if (reservation.outcome === 'key_reused') throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
    if (reservation.outcome === 'pending') throw new ServiceUnavailableException({ code: 'OUTBOUND_MESSAGE_OUTCOME_UNKNOWN' });
    if (reservation.outcome === 'rejected') throw new ConflictException({ code: 'OUTBOUND_MESSAGE_PREVIOUSLY_REJECTED' });

    if (
      this.messagingProvider === undefined
      || this.credentials === undefined
      || this.messagingProvider.provider !== connection.provider
      || (input.content.type === 'INTERACTIVE' && this.messagingProvider.sendInteractive === undefined)
    ) {
      await this.repository.reject(reservation.request);
      throw new ServiceUnavailableException({ code: 'WHATSAPP_MESSAGING_CONFIGURATION_UNAVAILABLE' });
    }

    try {
      // The provider resolves and decrypts the opaque reference immediately before use.
      const providerContext = {
        senderPhoneNumberId: connection.externalPhoneNumberId,
        recipientWhatsAppId: conversation.customerWhatsAppId,
        credentialReference: connection.credentialReference,
      };
      const result = input.content.type === 'INTERACTIVE'
        ? await this.messagingProvider.sendInteractive!({
          ...providerContext,
          body: input.content.body,
          options: input.content.options,
        })
        : await this.messagingProvider.sendText({ ...providerContext, text: input.content.body });
      try {
        const message = await this.repository.recordAccepted(reservation.request, result.providerMessageId, result.acceptedAt);
        return message;
      } catch {
        // Meta may have accepted the message. Leave PENDING so the same key can never re-send it.
        throw new ServiceUnavailableException({ code: 'OUTBOUND_MESSAGE_OUTCOME_UNKNOWN' });
      }
    } catch (error) {
      if (!(error instanceof WhatsAppMessagingProviderError)) throw error;
      if (error.kind === 'OUTCOME_UNKNOWN') {
        // Do not reject/release a key if transport ambiguity could conceal an accepted send.
        throw new ServiceUnavailableException({ code: 'OUTBOUND_MESSAGE_OUTCOME_UNKNOWN' });
      }
      await this.repository.reject(reservation.request);
      if (error.kind === 'REJECTED') throw new BadRequestException({ code: 'WHATSAPP_MESSAGE_REJECTED' });
      throw new ServiceUnavailableException({ code: 'DEPENDENCY_UNAVAILABLE' });
    }
  }

  /**
   * Platform-only Connection Test reply. It deliberately bypasses customer
   * conversations and automation while retaining the existing provider and
   * encrypted-credential boundary.
   */
  async sendConnectionTestReply(input: {
    readonly provider: 'META';
    readonly senderPhoneNumberId: string;
    readonly recipientWhatsAppId: string;
    readonly credentialReference: ProviderCredentialReference;
    readonly text: string;
    readonly organizationId: string;
    readonly connectionId: string;
    readonly connectionTestId: string;
  }, diagnostics: ConnectionTestDiagnosticReporter): Promise<{ readonly providerMessageId: string; readonly acceptedAt: Date }> {
    if (this.messagingProvider === undefined || this.credentials === undefined || this.messagingProvider.provider !== input.provider) {
      diagnostics({
        event: 'connection_test_reply_failed',
        organizationId: input.organizationId,
        connectionId: input.connectionId,
        connectionTestId: input.connectionTestId,
        resultClassification: 'CONFIGURATION',
        providerErrorCode: 'MESSAGING_CONFIGURATION_UNAVAILABLE',
      });
      throw new ConnectionTestReplyError('MESSAGING_CONFIGURATION_UNAVAILABLE');
    }
    diagnostics({
      event: 'connection_test_reply_meta_request_started',
      organizationId: input.organizationId,
      connectionId: input.connectionId,
      connectionTestId: input.connectionTestId,
    });
    try {
      return await this.messagingProvider.sendText(input);
    } catch (error) {
      if (error instanceof WhatsAppMessagingProviderError) {
        diagnostics({
          event: 'connection_test_reply_failed',
          organizationId: input.organizationId,
          connectionId: input.connectionId,
          connectionTestId: input.connectionTestId,
          resultClassification: error.kind,
          ...(error.providerErrorCode === undefined ? {} : { providerErrorCode: error.providerErrorCode }),
        });
        throw new ConnectionTestReplyError(connectionTestFailureCode(error.kind));
      }
      throw error;
    }
  }

  private notFound(): never {
    throw new NotFoundException({ code: 'CONVERSATION_ACCESS_NOT_FOUND' });
  }
}

type ConnectionTestReplyFailureCode =
  | 'MESSAGING_CONFIGURATION_UNAVAILABLE'
  | 'CREDENTIAL_INVALID'
  | 'META_REJECTED'
  | 'META_UNAVAILABLE'
  | 'META_OUTCOME_UNKNOWN';

export class ConnectionTestReplyError extends Error {
  constructor(readonly failureCode: ConnectionTestReplyFailureCode) {
    super('WhatsApp Connection Test reply failed.');
    this.name = 'ConnectionTestReplyError';
  }
}

function connectionTestFailureCode(kind: WhatsAppMessagingProviderError['kind']): ConnectionTestReplyFailureCode {
  if (kind === 'CREDENTIAL_INVALID') return 'CREDENTIAL_INVALID';
  if (kind === 'REJECTED') return 'META_REJECTED';
  if (kind === 'UNAVAILABLE') return 'META_UNAVAILABLE';
  return 'META_OUTCOME_UNKNOWN';
}

function normalizeText(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('text' in body) || typeof body.text !== 'string') {
    throw new BadRequestException({ code: 'CONVERSATION_MESSAGE_TEXT_INVALID' });
  }
  const text = body.text.trim();
  if (text.length === 0 || text.length > maximumTextLength) {
    throw new BadRequestException({ code: 'CONVERSATION_MESSAGE_TEXT_INVALID' });
  }
  return text;
}

function normalizeIdempotencyKey(value: unknown): string {
  if (typeof value !== 'string' || !idempotencyKeyPattern.test(value)) {
    throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_INVALID' });
  }
  return value;
}

function normalizeBotOutput(output: StructuredBotOutput): OutboundMessageContent {
  if (output.type === 'text') {
    return { type: 'TEXT', body: normalizeText({ text: output.text }), options: null };
  }
  const body = output.body.trim();
  const options = output.options.map((option) => ({ id: option.id, label: option.label.trim() }));
  if (
    body.length === 0
    || body.length > 1_024
    || options.length < 1
    || options.length > 3
    || new Set(options.map((option) => option.id)).size !== options.length
    || options.some((option) => (
      !interactiveOptionIdPattern.test(option.id)
      || option.label.length === 0
      || option.label.length > 20
    ))
  ) {
    throw new BadRequestException({ code: 'WHATSAPP_INTERACTIVE_MESSAGE_INVALID' });
  }
  return { type: 'INTERACTIVE', body, options };
}

function responseFromMessage(message: PersistedOutboundMessage): SendConversationTextResponse {
  if (message.messageType !== 'TEXT') throw new Error('Text send resolved to a non-text message.');
  return {
    message: {
      id: message.id,
      direction: 'OUTBOUND',
      messageType: 'TEXT',
      status: message.outboundStatus,
      createdAt: message.createdAt.toISOString(),
    },
  };
}

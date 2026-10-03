import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import {
  conversations,
  messages,
  outboundMessageRequests,
  type SlotlyFlowDatabase,
  whatsappConnections,
} from '@slotlyflow/database';

import { AUTH_DATABASE } from '../auth/auth.tokens.js';
import type { TrustedOrganizationContext } from '../organizations/organization.types.js';
import type { OutboundWhatsAppReplyOption } from './whatsapp-messaging-provider.js';

export type PersistedOutboundStatus = 'ACCEPTED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface ScopedConversationForReply {
  readonly id: string;
  readonly organizationId: string;
  readonly whatsappConnectionId: string;
  readonly customerWhatsAppId: string;
}

export interface OutboundMessageReservation {
  readonly id: string;
  readonly organizationId: string;
  readonly conversationId: string;
  readonly whatsappConnectionId: string;
  readonly idempotencyKey: string;
  readonly textBody: string;
  readonly interactiveOptions: readonly OutboundWhatsAppReplyOption[] | null;
}

export type OutboundMessageContent =
  | { readonly type: 'TEXT'; readonly body: string; readonly options: null }
  | { readonly type: 'INTERACTIVE'; readonly body: string; readonly options: readonly OutboundWhatsAppReplyOption[] };

export type ReserveOutboundMessageResult =
  | { readonly outcome: 'reserved'; readonly request: OutboundMessageReservation }
  | { readonly outcome: 'completed'; readonly message: PersistedOutboundMessage }
  | { readonly outcome: 'pending' }
  | { readonly outcome: 'rejected' }
  | { readonly outcome: 'key_reused' };

export interface PersistedOutboundMessage {
  readonly id: string;
  readonly organizationId: string;
  readonly conversationId: string;
  readonly whatsappConnectionId: string;
  readonly direction: 'OUTBOUND';
  readonly messageType: 'TEXT' | 'INTERACTIVE';
  readonly textBody: string;
  readonly interactiveOptions: readonly OutboundWhatsAppReplyOption[] | null;
  readonly outboundStatus: PersistedOutboundStatus;
  readonly createdAt: Date;
}

export interface ProviderMessageStatusUpdate {
  readonly provider: 'META';
  readonly destinationPhoneNumberId: string;
  readonly providerMessageId: string;
  readonly status: Exclude<PersistedOutboundStatus, 'ACCEPTED'>;
  readonly occurredAt: Date;
}

export type ProviderMessageStatusPersistenceOutcome = 'updated' | 'ignored' | 'unknown_message' | 'unknown_connection';

export interface OutboundWhatsAppMessageRepository {
  findConversationForReply(organizationId: string, conversationId: string): Promise<ScopedConversationForReply | undefined>;
  reserve(
    context: Pick<TrustedOrganizationContext, 'organizationId'>,
    conversation: ScopedConversationForReply,
    idempotencyKey: string,
    content: OutboundMessageContent,
  ): Promise<ReserveOutboundMessageResult>;
  reject(request: OutboundMessageReservation): Promise<void>;
  recordAccepted(
    request: OutboundMessageReservation,
    providerMessageId: string,
    acceptedAt: Date,
  ): Promise<PersistedOutboundMessage>;
  applyProviderStatus(status: ProviderMessageStatusUpdate): Promise<ProviderMessageStatusPersistenceOutcome>;
}

@Injectable()
export class DrizzleOutboundWhatsAppMessageRepository implements OutboundWhatsAppMessageRepository {
  constructor(@Inject(AUTH_DATABASE) private readonly db: SlotlyFlowDatabase) {}

  async findConversationForReply(organizationId: string, conversationId: string): Promise<ScopedConversationForReply | undefined> {
    const [row] = await this.db.select({
      id: conversations.id,
      organizationId: conversations.organizationId,
      whatsappConnectionId: conversations.whatsappConnectionId,
      customerWhatsAppId: conversations.customerWhatsAppId,
    })
      .from(conversations)
      .where(and(eq(conversations.organizationId, organizationId), eq(conversations.id, conversationId)));
    return row;
  }

  async reserve(
    context: Pick<TrustedOrganizationContext, 'organizationId'>,
    conversation: ScopedConversationForReply,
    idempotencyKey: string,
    content: OutboundMessageContent,
  ): Promise<ReserveOutboundMessageResult> {
    const [created] = await this.db.insert(outboundMessageRequests).values({
      organizationId: context.organizationId,
      conversationId: conversation.id,
      whatsappConnectionId: conversation.whatsappConnectionId,
      idempotencyKey,
      textBody: content.body,
      interactiveOptions: content.options,
    }).onConflictDoNothing({
      target: [outboundMessageRequests.organizationId, outboundMessageRequests.idempotencyKey],
    }).returning();
    if (created !== undefined) return { outcome: 'reserved', request: reservationFromRow(created) };

    const [existing] = await this.db.select().from(outboundMessageRequests).where(and(
      eq(outboundMessageRequests.organizationId, context.organizationId),
      eq(outboundMessageRequests.idempotencyKey, idempotencyKey),
    ));
    if (existing === undefined) throw new Error('Outbound idempotency reservation disappeared.');
    if (
      existing.conversationId !== conversation.id ||
      existing.whatsappConnectionId !== conversation.whatsappConnectionId ||
      existing.textBody !== content.body ||
      !sameOptions(existing.interactiveOptions, content.options)
    ) return { outcome: 'key_reused' };
    if (existing.state === 'PENDING') return { outcome: 'pending' };
    if (existing.state === 'REJECTED') return { outcome: 'rejected' };
    if (existing.messageId === null) throw new Error('Completed outbound request has no message.');
    const message = await this.findPersistedOutboundMessage(existing.messageId, context.organizationId);
    if (message === undefined) throw new Error('Completed outbound request message is missing.');
    return { outcome: 'completed', message };
  }

  async reject(request: OutboundMessageReservation): Promise<void> {
    await this.db.update(outboundMessageRequests).set({
      state: 'REJECTED',
      updatedAt: new Date(),
    }).where(and(
      eq(outboundMessageRequests.id, request.id),
      eq(outboundMessageRequests.organizationId, request.organizationId),
      eq(outboundMessageRequests.state, 'PENDING'),
    ));
  }

  async recordAccepted(
    request: OutboundMessageReservation,
    providerMessageId: string,
    acceptedAt: Date,
  ): Promise<PersistedOutboundMessage> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(outboundMessageRequests).where(and(
        eq(outboundMessageRequests.id, request.id),
        eq(outboundMessageRequests.organizationId, request.organizationId),
      )).for('update');
      if (current === undefined || current.state !== 'PENDING') throw new Error('Outbound request is no longer pending.');

      const [existing] = await tx.select().from(messages).where(and(
        eq(messages.provider, 'META'),
        eq(messages.providerMessageId, providerMessageId),
      ));
      const message = existing === undefined
        ? (await tx.insert(messages).values({
          organizationId: request.organizationId,
          conversationId: request.conversationId,
          whatsappConnectionId: request.whatsappConnectionId,
          provider: 'META',
          providerMessageId,
          direction: 'OUTBOUND',
          origin: 'SLOTLYFLOW_API_OUTBOUND',
          messageType: 'TEXT',
          textBody: request.textBody,
          interactiveOptions: request.interactiveOptions,
          outboundStatus: 'ACCEPTED',
          outboundStatusUpdatedAt: acceptedAt,
          providerTimestamp: acceptedAt,
        }).returning())[0]
        : existing;
      if (message === undefined || !isMatchingOutboundMessage(message, request)) {
        throw new Error('Provider message identifier conflicts with another message.');
      }

      await tx.update(outboundMessageRequests).set({
        state: 'COMPLETED',
        messageId: message.id,
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(
        eq(outboundMessageRequests.id, request.id),
        eq(outboundMessageRequests.organizationId, request.organizationId),
      ));
      return persistedMessageFromRow(message);
    });
  }

  async applyProviderStatus(status: ProviderMessageStatusUpdate): Promise<ProviderMessageStatusPersistenceOutcome> {
    return this.db.transaction(async (tx) => {
      // A status is scoped by the provider phone identifier before a message is read.
      const [connection] = await tx.select({ id: whatsappConnections.id })
        .from(whatsappConnections)
        .where(and(
          eq(whatsappConnections.provider, status.provider),
          eq(whatsappConnections.externalPhoneNumberId, status.destinationPhoneNumberId),
        ));
      if (connection === undefined) return 'unknown_connection';

      const [message] = await tx.select().from(messages).where(and(
        eq(messages.provider, status.provider),
        eq(messages.providerMessageId, status.providerMessageId),
        eq(messages.whatsappConnectionId, connection.id),
        eq(messages.direction, 'OUTBOUND'),
        eq(messages.origin, 'SLOTLYFLOW_API_OUTBOUND'),
      )).for('update');
      if (message === undefined) return 'unknown_message';
      if (!canAdvanceStatus(message.outboundStatus, status.status)) return 'ignored';
      await tx.update(messages).set({
        outboundStatus: status.status,
        outboundStatusUpdatedAt: status.occurredAt,
      }).where(eq(messages.id, message.id));
      return 'updated';
    });
  }

  private async findPersistedOutboundMessage(messageId: string, organizationId: string): Promise<PersistedOutboundMessage | undefined> {
    const [row] = await this.db.select().from(messages).where(and(
      eq(messages.id, messageId),
      eq(messages.organizationId, organizationId),
      eq(messages.direction, 'OUTBOUND'),
      eq(messages.origin, 'SLOTLYFLOW_API_OUTBOUND'),
    ));
    return row === undefined ? undefined : persistedMessageFromRow(row);
  }
}

function reservationFromRow(row: typeof outboundMessageRequests.$inferSelect): OutboundMessageReservation {
  return {
    id: row.id,
    organizationId: row.organizationId,
    conversationId: row.conversationId,
    whatsappConnectionId: row.whatsappConnectionId,
    idempotencyKey: row.idempotencyKey,
    textBody: row.textBody,
    interactiveOptions: row.interactiveOptions,
  };
}

function isMatchingOutboundMessage(row: typeof messages.$inferSelect, request: OutboundMessageReservation): boolean {
  return row.organizationId === request.organizationId
    && row.conversationId === request.conversationId
    && row.whatsappConnectionId === request.whatsappConnectionId
    && row.direction === 'OUTBOUND'
    && row.origin === 'SLOTLYFLOW_API_OUTBOUND'
    && row.messageType === 'TEXT'
    && row.textBody === request.textBody
    && sameOptions(row.interactiveOptions, request.interactiveOptions);
}

function persistedMessageFromRow(row: typeof messages.$inferSelect): PersistedOutboundMessage {
  if (row.direction !== 'OUTBOUND' || row.messageType !== 'TEXT' || row.textBody === null || row.outboundStatus === null) {
    throw new Error('Persisted outbound message is invalid.');
  }
  return {
    id: row.id,
    organizationId: row.organizationId,
    conversationId: row.conversationId,
    whatsappConnectionId: row.whatsappConnectionId,
    direction: 'OUTBOUND',
    messageType: row.interactiveOptions === null ? 'TEXT' : 'INTERACTIVE',
    textBody: row.textBody,
    interactiveOptions: row.interactiveOptions,
    outboundStatus: row.outboundStatus,
    createdAt: row.createdAt,
  };
}

function sameOptions(
  left: readonly OutboundWhatsAppReplyOption[] | null,
  right: readonly OutboundWhatsAppReplyOption[] | null,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function canAdvanceStatus(
  current: PersistedOutboundStatus | null,
  next: Exclude<PersistedOutboundStatus, 'ACCEPTED'>,
): boolean {
  if (current === null || current === 'ACCEPTED') return true;
  if (current === 'SENT') return next === 'DELIVERED' || next === 'READ' || next === 'FAILED';
  if (current === 'DELIVERED') return next === 'READ';
  return false; // READ and FAILED are terminal; same/replayed values are harmless.
}

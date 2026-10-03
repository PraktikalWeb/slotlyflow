import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import {
  conversations,
  messages,
  type SlotlyFlowDatabase,
  whatsappConnections,
} from '@slotlyflow/database';

import { AUTH_DATABASE } from '../auth/auth.tokens.js';
import { DrizzleNotificationRepository } from '../notifications/notification.repository.js';
import type { InboundMessagePersistenceResult, InboundWhatsAppMessage } from './inbound-whatsapp-message.types.js';
import type { HumanBusinessAppMessage, HumanBusinessAppPersistenceResult } from './human-business-app-message.types.js';

export interface InboundWhatsAppMessageRepository {
  persistVerifiedInboundMessage(message: InboundWhatsAppMessage): Promise<InboundMessagePersistenceResult>;
  persistVerifiedHumanBusinessAppMessage(message: HumanBusinessAppMessage): Promise<HumanBusinessAppPersistenceResult>;
  hasConversationForTrustedConnection(input: {
    readonly organizationId: string;
    readonly whatsappConnectionId: string;
    readonly conversationId: string;
  }): Promise<boolean>;
  findConversationForOrganization(organizationId: string, conversationId: string): Promise<{ readonly id: string; readonly organizationId: string } | undefined>;
  findMessagesForConversation(organizationId: string, conversationId: string): Promise<readonly { readonly id: string; readonly organizationId: string }[]>;
}

@Injectable()
export class DrizzleInboundWhatsAppMessageRepository implements InboundWhatsAppMessageRepository {
  constructor(
    @Inject(AUTH_DATABASE) private readonly db: SlotlyFlowDatabase,
    @Inject(DrizzleNotificationRepository) private readonly handovers: DrizzleNotificationRepository,
  ) {}

  async persistVerifiedInboundMessage(message: InboundWhatsAppMessage): Promise<InboundMessagePersistenceResult> {
    return this.db.transaction(async (tx) => {
      const [connection] = await tx
        .select()
        .from(whatsappConnections)
        .where(and(
          eq(whatsappConnections.provider, message.provider),
          eq(whatsappConnections.externalPhoneNumberId, message.destinationPhoneNumberId),
          eq(whatsappConnections.connectionStatus, 'CONNECTED'),
        ));
      if (connection === undefined) return { outcome: 'unknown_connection' };

      const [conversation] = await tx
        .insert(conversations)
        .values({
          organizationId: connection.organizationId,
          whatsappConnectionId: connection.id,
          customerWhatsAppId: message.customerWhatsAppId,
          customerDisplayName: message.customerDisplayName,
          lastMessageAt: message.occurredAt,
        })
        .onConflictDoUpdate({
          target: [conversations.organizationId, conversations.whatsappConnectionId, conversations.customerWhatsAppId],
          set: {
            customerDisplayName: sql`coalesce(${conversations.customerDisplayName}, excluded.customer_display_name)`,
            lastMessageAt: sql`greatest(${conversations.lastMessageAt}, excluded.last_message_at)`,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (conversation === undefined) throw new Error('Conversation persistence failed.');

      const inserted = await tx
        .insert(messages)
        .values({
          organizationId: connection.organizationId,
          conversationId: conversation.id,
          whatsappConnectionId: connection.id,
          provider: message.provider,
          providerMessageId: message.providerMessageId,
          direction: 'INBOUND',
          origin: 'CUSTOMER_INBOUND',
          // The existing database enum remains provider-neutral. A normalized
          // interactive reply is identified by its dedicated stable-ID column.
          messageType: message.messageType === 'INTERACTIVE_REPLY' ? 'TEXT' : message.messageType,
          textBody: message.textBody,
          interactiveOptionId: message.interactiveOptionId ?? null,
          providerTimestamp: message.occurredAt,
        })
        .onConflictDoNothing({ target: [messages.provider, messages.providerMessageId] })
        .returning({ id: messages.id });

      if (inserted.length === 0) return { outcome: 'duplicate', organizationId: connection.organizationId, connectionId: connection.id };
      const handoverActive = await this.handovers.recordCustomerActivityInTransaction(
        tx, connection.organizationId, conversation.id, message.occurredAt,
      );
      return {
          outcome: 'stored',
          organizationId: connection.organizationId,
          connectionId: connection.id,
          conversationId: conversation.id,
          inboundMessageId: inserted[0]!.id,
          customerWhatsAppId: conversation.customerWhatsAppId,
          handoverActive,
        };
    });
  }

  async persistVerifiedHumanBusinessAppMessage(message: HumanBusinessAppMessage): Promise<HumanBusinessAppPersistenceResult> {
    return this.db.transaction(async (tx) => {
      const [connection] = await tx.select({ id: whatsappConnections.id, organizationId: whatsappConnections.organizationId })
        .from(whatsappConnections).where(and(
          eq(whatsappConnections.provider, message.provider),
          eq(whatsappConnections.externalPhoneNumberId, message.destinationPhoneNumberId),
          eq(whatsappConnections.externalWabaId, message.wabaId),
          eq(whatsappConnections.connectionSource, 'EXISTING_BUSINESS_APP'),
          eq(whatsappConnections.connectionStatus, 'CONNECTED'),
        ));
      if (connection === undefined) return { outcome: 'unknown_connection' };

      // The echo recipient is a phone number, not necessarily a WhatsApp ID.
      // Only an exact existing conversation identity is unambiguous today.
      const [conversation] = await tx.select({ id: conversations.id }).from(conversations).where(and(
        eq(conversations.organizationId, connection.organizationId),
        eq(conversations.whatsappConnectionId, connection.id),
        eq(conversations.customerWhatsAppId, message.customerWhatsAppId),
      )).for('update');
      if (conversation === undefined) return { outcome: 'unknown_conversation' };

      const [inserted] = await tx.insert(messages).values({
        organizationId: connection.organizationId,
        conversationId: conversation.id,
        whatsappConnectionId: connection.id,
        provider: message.provider,
        providerMessageId: message.providerMessageId,
        direction: 'OUTBOUND',
        origin: 'BUSINESS_APP_OUTBOUND',
        messageType: message.messageType,
        textBody: message.textBody,
        providerTimestamp: message.occurredAt,
      }).onConflictDoNothing({ target: [messages.provider, messages.providerMessageId] })
        .returning({ id: messages.id });
      if (inserted === undefined) return { outcome: 'duplicate' };

      await tx.update(conversations).set({
        lastMessageAt: sql`greatest(${conversations.lastMessageAt}, ${message.occurredAt.toISOString()}::timestamptz)`,
        updatedAt: new Date(),
      }).where(and(eq(conversations.organizationId, connection.organizationId), eq(conversations.id, conversation.id)));
      const handoverActive = await this.handovers.recordHumanActivityInTransaction(
        tx, connection.organizationId, conversation.id, message.occurredAt,
      );
      return {
        outcome: 'stored', organizationId: connection.organizationId, connectionId: connection.id,
        conversationId: conversation.id, handoverActive,
      };
    });
  }

  async hasConversationForTrustedConnection(input: {
    readonly organizationId: string;
    readonly whatsappConnectionId: string;
    readonly conversationId: string;
  }): Promise<boolean> {
    const [row] = await this.db.select({ id: conversations.id }).from(conversations).where(and(
      eq(conversations.organizationId, input.organizationId),
      eq(conversations.whatsappConnectionId, input.whatsappConnectionId),
      eq(conversations.id, input.conversationId),
    ));
    return row !== undefined;
  }

  async findConversationForOrganization(organizationId: string, conversationId: string): Promise<{ readonly id: string; readonly organizationId: string } | undefined> {
    const [row] = await this.db
      .select({ id: conversations.id, organizationId: conversations.organizationId })
      .from(conversations)
      .where(and(eq(conversations.organizationId, organizationId), eq(conversations.id, conversationId)));
    return row;
  }

  async findMessagesForConversation(organizationId: string, conversationId: string): Promise<readonly { readonly id: string; readonly organizationId: string }[]> {
    return this.db
      .select({ id: messages.id, organizationId: messages.organizationId })
      .from(messages)
      .where(and(eq(messages.organizationId, organizationId), eq(messages.conversationId, conversationId)));
  }
}

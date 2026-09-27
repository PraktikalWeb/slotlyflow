import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, lte } from 'drizzle-orm';
import { type SlotlyFlowDatabase, whatsappConnectionTests, whatsappConnections } from '@slotlyflow/database';

import { AUTH_DATABASE } from '../auth/auth.tokens.js';
import type { ProviderCredentialReference } from './credential-store.js';

export type ConnectionTestRow = typeof whatsappConnectionTests.$inferSelect;

export interface ClaimedConnectionTest {
  readonly test: ConnectionTestRow;
  readonly organizationId: string;
  readonly connectionId: string;
  readonly credentialReference: ProviderCredentialReference;
  readonly senderPhoneNumberId: string;
}

@Injectable()
export class DrizzleWhatsAppConnectionTestRepository {
  constructor(@Inject(AUTH_DATABASE) private readonly db: SlotlyFlowDatabase) {}

  async createReplacingActive(input: {
    readonly organizationId: string;
    readonly whatsappConnectionId: string;
    readonly destinationPhoneNumberId: string;
    readonly testSenderPhoneNumber: string;
    readonly expiresAt: Date;
  }): Promise<ConnectionTestRow> {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [active] = await tx.select().from(whatsappConnectionTests).where(and(
        eq(whatsappConnectionTests.whatsappConnectionId, input.whatsappConnectionId),
        eq(whatsappConnectionTests.status, 'IN_PROGRESS'),
      )).for('update');
      if (active !== undefined && active.expiresAt.getTime() > now.getTime() && active.testSenderPhoneNumber === input.testSenderPhoneNumber) {
        return active;
      }
      if (active !== undefined) {
        await tx.update(whatsappConnectionTests).set({
          status: 'FAILED', stage: 'FAILED', failureCode: active.expiresAt.getTime() <= now.getTime() ? 'EXPIRED' : 'REPLACED', completedAt: now, updatedAt: now,
        }).where(eq(whatsappConnectionTests.id, active.id));
      }
      const [created] = await tx.insert(whatsappConnectionTests).values({
        organizationId: input.organizationId,
        whatsappConnectionId: input.whatsappConnectionId,
        destinationPhoneNumberId: input.destinationPhoneNumberId,
        testSenderPhoneNumber: input.testSenderPhoneNumber,
        expiresAt: input.expiresAt,
      }).returning();
      if (created === undefined) throw new Error('Connection Test creation failed.');
      return created;
    });
  }

  async recentForOrganization(organizationId: string, connectionId: string): Promise<readonly ConnectionTestRow[]> {
    await this.expireActive(organizationId, connectionId);
    return this.db.select().from(whatsappConnectionTests).where(and(
      eq(whatsappConnectionTests.organizationId, organizationId),
      eq(whatsappConnectionTests.whatsappConnectionId, connectionId),
    )).orderBy(desc(whatsappConnectionTests.createdAt));
  }

  async updateCanonicalSender(row: ConnectionTestRow, canonicalSender: string): Promise<ConnectionTestRow> {
    if (row.testSenderPhoneNumber === canonicalSender) return row;
    const [updated] = await this.db.update(whatsappConnectionTests).set({
      testSenderPhoneNumber: canonicalSender,
      updatedAt: new Date(),
    }).where(and(
      eq(whatsappConnectionTests.id, row.id),
      eq(whatsappConnectionTests.organizationId, row.organizationId),
      eq(whatsappConnectionTests.whatsappConnectionId, row.whatsappConnectionId),
    )).returning();
    return updated ?? row;
  }

  async claimMatchingInbound(input: {
    readonly provider: 'META';
    readonly destinationPhoneNumberId: string;
    readonly senderPhoneNumber: string;
    readonly providerMessageId: string;
  }): Promise<ClaimedConnectionTest | undefined> {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      await tx.update(whatsappConnectionTests).set({
        status: 'FAILED', stage: 'FAILED', failureCode: 'EXPIRED', completedAt: now, updatedAt: now,
      }).where(and(eq(whatsappConnectionTests.status, 'IN_PROGRESS'), lte(whatsappConnectionTests.expiresAt, now)));

      const [test] = await tx.select().from(whatsappConnectionTests).where(and(
        eq(whatsappConnectionTests.destinationPhoneNumberId, input.destinationPhoneNumberId),
        eq(whatsappConnectionTests.testSenderPhoneNumber, input.senderPhoneNumber),
        eq(whatsappConnectionTests.status, 'IN_PROGRESS'),
        gt(whatsappConnectionTests.expiresAt, now),
        isNull(whatsappConnectionTests.inboundProviderMessageId),
      )).for('update');
      if (test === undefined) return undefined;

      const [connection] = await tx.select({
        id: whatsappConnections.id,
        provider: whatsappConnections.provider,
        connectionStatus: whatsappConnections.connectionStatus,
        externalPhoneNumberId: whatsappConnections.externalPhoneNumberId,
        credentialReference: whatsappConnections.credentialReference,
      }).from(whatsappConnections).where(and(
        eq(whatsappConnections.id, test.whatsappConnectionId),
        eq(whatsappConnections.organizationId, test.organizationId),
        eq(whatsappConnections.provider, input.provider),
        eq(whatsappConnections.externalPhoneNumberId, input.destinationPhoneNumberId),
        eq(whatsappConnections.connectionStatus, 'CONNECTED'),
      )).for('update');
      if (connection?.credentialReference === null || connection?.credentialReference === undefined || connection.externalPhoneNumberId === null) return undefined;

      const [claimed] = await tx.update(whatsappConnectionTests).set({
        inboundProviderMessageId: input.providerMessageId,
        inboundReceivedAt: now,
        stage: 'MESSAGE_RECEIVED',
        updatedAt: now,
      }).where(and(eq(whatsappConnectionTests.id, test.id), isNull(whatsappConnectionTests.inboundProviderMessageId))).returning();
      if (claimed === undefined) return undefined;
      return {
        test: claimed,
        organizationId: test.organizationId,
        connectionId: connection.id,
        credentialReference: connection.credentialReference as ProviderCredentialReference,
        senderPhoneNumberId: connection.externalPhoneNumberId,
      };
    });
  }

  async markReplyAcceptedAndPassed(testId: string, providerMessageId: string, acceptedAt: Date): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [replySent] = await tx.update(whatsappConnectionTests).set({
        stage: 'REPLY_SENT', replySentAt: acceptedAt, updatedAt: acceptedAt,
      }).where(and(
        eq(whatsappConnectionTests.id, testId),
        eq(whatsappConnectionTests.inboundProviderMessageId, providerMessageId),
        eq(whatsappConnectionTests.status, 'IN_PROGRESS'),
        eq(whatsappConnectionTests.stage, 'MESSAGE_RECEIVED'),
      )).returning({ id: whatsappConnectionTests.id });
      if (replySent === undefined) throw new Error('Connection Test reply state could not be recorded.');

      const completedAt = new Date();
      const [passed] = await tx.update(whatsappConnectionTests).set({
        status: 'PASSED', stage: 'PASSED', completedAt, updatedAt: completedAt,
      }).where(and(
        eq(whatsappConnectionTests.id, testId),
        eq(whatsappConnectionTests.inboundProviderMessageId, providerMessageId),
        eq(whatsappConnectionTests.status, 'IN_PROGRESS'),
        eq(whatsappConnectionTests.stage, 'REPLY_SENT'),
      )).returning({ id: whatsappConnectionTests.id });
      if (passed === undefined) throw new Error('Connection Test completion state could not be recorded.');
    });
  }

  async markReplyFailed(testId: string, providerMessageId: string, failureCode = 'REPLY_FAILED'): Promise<void> {
    const now = new Date();
    await this.db.update(whatsappConnectionTests).set({
      status: 'FAILED', stage: 'FAILED', failureCode, completedAt: now, updatedAt: now,
    }).where(and(eq(whatsappConnectionTests.id, testId), eq(whatsappConnectionTests.inboundProviderMessageId, providerMessageId), eq(whatsappConnectionTests.status, 'IN_PROGRESS')));
  }

  private async expireActive(organizationId: string, connectionId: string): Promise<void> {
    const now = new Date();
    await this.db.update(whatsappConnectionTests).set({
      status: 'FAILED', stage: 'FAILED', failureCode: 'EXPIRED', completedAt: now, updatedAt: now,
    }).where(and(
      eq(whatsappConnectionTests.organizationId, organizationId),
      eq(whatsappConnectionTests.whatsappConnectionId, connectionId),
      eq(whatsappConnectionTests.status, 'IN_PROGRESS'),
      lte(whatsappConnectionTests.expiresAt, now),
    ));
  }
}

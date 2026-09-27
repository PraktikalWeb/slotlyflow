import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { auditLogs, organizations, providerCredentials, type SlotlyFlowDatabase, whatsappConnections, whatsappOnboardingTransactions } from '@slotlyflow/database';

import { AUTH_DATABASE } from '../auth/auth.tokens.js';
import type { PreparedProviderCredential } from './credential-store.js';
import type { WhatsAppConnection } from './whatsapp-connection.types.js';
import type { WhatsAppOnboardingTransaction } from './whatsapp-onboarding.types.js';
import type { CoexistenceContactSyncError, CoexistenceHistorySyncError } from './whatsapp-provider.js';

function transactionFromRow(row: typeof whatsappOnboardingTransactions.$inferSelect): WhatsAppOnboardingTransaction {
  return {
    id: row.id,
    organizationId: row.organizationId,
    actorUserId: row.actorUserId,
    provider: row.provider,
    connectionSource: row.connectionSource,
    status: row.status,
    expiresAt: row.expiresAt,
    completedAt: row.completedAt,
    coexistenceContactSyncStatus: row.coexistenceContactSyncStatus,
    coexistenceContactSyncAttemptedAt: row.coexistenceContactSyncAttemptedAt,
    coexistenceContactSyncAcceptedAt: row.coexistenceContactSyncAcceptedAt,
    coexistenceContactSyncProviderRequestId: row.coexistenceContactSyncProviderRequestId,
    coexistenceContactSyncFailureCategory: row.coexistenceContactSyncFailureCategory,
    coexistenceContactSyncProviderErrorCode: row.coexistenceContactSyncProviderErrorCode,
    coexistenceContactSyncProviderErrorSubcode: row.coexistenceContactSyncProviderErrorSubcode,
    coexistenceHistorySyncStatus: row.coexistenceHistorySyncStatus,
    coexistenceHistorySyncAttemptedAt: row.coexistenceHistorySyncAttemptedAt,
    coexistenceHistorySyncAcceptedAt: row.coexistenceHistorySyncAcceptedAt,
    coexistenceHistorySyncProcessedAt: row.coexistenceHistorySyncProcessedAt,
    coexistenceHistorySyncProviderRequestId: row.coexistenceHistorySyncProviderRequestId,
    coexistenceHistorySyncFailureCategory: row.coexistenceHistorySyncFailureCategory,
    coexistenceHistorySyncProviderErrorCode: row.coexistenceHistorySyncProviderErrorCode,
    coexistenceHistorySyncProviderErrorSubcode: row.coexistenceHistorySyncProviderErrorSubcode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function connectionFromRow(row: typeof whatsappConnections.$inferSelect): WhatsAppConnection {
  return {
    id: row.id,
    organizationId: row.organizationId,
    provider: row.provider,
    connectionSource: row.connectionSource,
    connectionStatus: row.connectionStatus,
    externalWabaId: row.externalWabaId,
    externalPhoneNumberId: row.externalPhoneNumberId,
    displayPhoneNumber: row.displayPhoneNumber,
    credentialReference: row.credentialReference as WhatsAppConnection['credentialReference'],
    verificationStatus: row.verificationStatus,
    lastVerifiedAt: row.lastVerifiedAt,
    lastVerificationCode: row.lastVerificationCode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class OnboardingCompletionDeniedError extends Error { constructor() { super('Onboarding completion is unavailable.'); this.name = 'OnboardingCompletionDeniedError'; } }
export class OnboardingCompletionPersistenceError extends Error { constructor() { super('Onboarding completion persistence failed.'); this.name = 'OnboardingCompletionPersistenceError'; } }

export type CoexistenceContactSyncClaim =
  | { readonly outcome: 'CLAIMED'; readonly connection: WhatsAppConnection }
  | { readonly outcome: 'ALREADY_ATTEMPTED'; readonly connectionId: string };

export type CoexistenceHistorySyncClaim = CoexistenceContactSyncClaim;
export type CoexistenceHistoryWebhookTransition =
  | { readonly outcome: 'UPDATED' | 'ALREADY_RECORDED'; readonly organizationId: string; readonly connectionId: string; readonly onboardingId: string }
  | { readonly outcome: 'NOT_FOUND' };

@Injectable()
export class DrizzleWhatsAppOnboardingCompletionRepository {
  constructor(@Inject(AUTH_DATABASE) private readonly db: SlotlyFlowDatabase) {}

  async getForCompletion(input: { readonly transactionId: string; readonly organizationId: string; readonly actorUserId: string; readonly now: Date }): Promise<{ readonly transaction: WhatsAppOnboardingTransaction; readonly connection: WhatsAppConnection | undefined }> {
    const [transaction] = await this.db.select().from(whatsappOnboardingTransactions).where(and(
      eq(whatsappOnboardingTransactions.id, input.transactionId),
      eq(whatsappOnboardingTransactions.organizationId, input.organizationId),
      eq(whatsappOnboardingTransactions.actorUserId, input.actorUserId),
    ));
    if (transaction === undefined || transaction.provider !== 'META' || transaction.connectionSource !== 'EXISTING_BUSINESS_APP') throw new OnboardingCompletionDeniedError();
    const [connection] = await this.db.select().from(whatsappConnections).where(eq(whatsappConnections.organizationId, input.organizationId));
    if (transaction.status === 'COMPLETED') {
      if (connection === undefined) throw new OnboardingCompletionDeniedError();
      return { transaction: transactionFromRow(transaction), connection: connectionFromRow(connection) };
    }
    if (transaction.status !== 'STARTED' || transaction.expiresAt.getTime() <= input.now.getTime()) throw new OnboardingCompletionDeniedError();
    const resumable = connection !== undefined
      && connection.provider === 'META'
      && connection.connectionSource === 'EXISTING_BUSINESS_APP'
      && connection.connectionStatus === 'CONNECTED'
      && connection.externalWabaId !== null
      && connection.externalPhoneNumberId !== null
      && connection.credentialReference !== null;
    return {
      transaction: transactionFromRow(transaction),
      connection: resumable ? connectionFromRow(connection) : undefined,
    };
  }

  async persistVerifiedCompletion(input: {
    readonly transactionId: string;
    readonly organizationId: string;
    readonly actorUserId: string;
    readonly now: Date;
    readonly verified: { readonly externalWabaId: string; readonly externalPhoneNumberId: string; readonly displayPhoneNumber: string | null };
    readonly credential: PreparedProviderCredential;
  }): Promise<WhatsAppConnection> {
    try {
      return await this.db.transaction(async (tx) => {
        await tx.execute(sql`select ${organizations.id} from ${organizations} where ${organizations.id} = ${input.organizationId} for update`);
        const [transaction] = await tx.select().from(whatsappOnboardingTransactions).where(and(
          eq(whatsappOnboardingTransactions.id, input.transactionId),
          eq(whatsappOnboardingTransactions.organizationId, input.organizationId),
          eq(whatsappOnboardingTransactions.actorUserId, input.actorUserId),
        ));
        if (transaction === undefined || transaction.provider !== 'META' || transaction.connectionSource !== 'EXISTING_BUSINESS_APP') throw new OnboardingCompletionDeniedError();
        const [existing] = await tx.select().from(whatsappConnections).where(eq(whatsappConnections.organizationId, input.organizationId));
        if (transaction.status === 'COMPLETED' && existing !== undefined) return connectionFromRow(existing);
        if (transaction.status !== 'STARTED' || transaction.expiresAt.getTime() <= input.now.getTime()) throw new OnboardingCompletionDeniedError();
        if (
          existing !== undefined
          && (
            existing.provider !== 'META'
            || existing.connectionSource !== 'EXISTING_BUSINESS_APP'
            || !['PENDING', 'VERIFYING', 'CONNECTED', 'DISCONNECTED', 'NEEDS_REAUTH'].includes(existing.connectionStatus)
            || (existing.externalWabaId !== null && existing.externalWabaId !== input.verified.externalWabaId)
            || (existing.externalPhoneNumberId !== null && existing.externalPhoneNumberId !== input.verified.externalPhoneNumberId)
          )
        ) {
          throw new OnboardingCompletionDeniedError();
        }
        if (
          existing !== undefined
          && existing.connectionStatus === 'CONNECTED'
          && existing.externalWabaId === input.verified.externalWabaId
          && existing.externalPhoneNumberId === input.verified.externalPhoneNumberId
          && existing.credentialReference !== null
        ) {
          return connectionFromRow(existing);
        }

        await tx.insert(providerCredentials).values({
          id: input.credential.reference,
          organizationId: input.organizationId,
          provider: input.credential.provider,
          encryptionVersion: input.credential.encryptionVersion,
          nonce: input.credential.nonce,
          ciphertext: input.credential.ciphertext,
          authenticationTag: input.credential.authenticationTag,
          expiresAt: input.credential.expiresAt,
        });
        const [connection] = existing === undefined
          ? await tx.insert(whatsappConnections).values({
              organizationId: input.organizationId,
              provider: 'META',
              connectionSource: 'EXISTING_BUSINESS_APP',
              connectionStatus: 'CONNECTED',
              externalWabaId: input.verified.externalWabaId,
              externalPhoneNumberId: input.verified.externalPhoneNumberId,
              displayPhoneNumber: input.verified.displayPhoneNumber,
              credentialReference: input.credential.reference,
              verificationStatus: null,
              lastVerifiedAt: null,
              lastVerificationCode: null,
            }).returning()
          : await tx.update(whatsappConnections).set({
              connectionStatus: 'CONNECTED',
              externalWabaId: input.verified.externalWabaId,
              externalPhoneNumberId: input.verified.externalPhoneNumberId,
              displayPhoneNumber: input.verified.displayPhoneNumber,
              credentialReference: input.credential.reference,
              verificationStatus: null,
              lastVerifiedAt: null,
              lastVerificationCode: null,
              updatedAt: input.now,
            }).where(and(
              eq(whatsappConnections.id, existing.id),
              eq(whatsappConnections.organizationId, input.organizationId),
            )).returning();
        if (connection === undefined) throw new OnboardingCompletionPersistenceError();
        return connectionFromRow(connection);
      });
    } catch (error) {
      if (error instanceof OnboardingCompletionDeniedError) throw error;
      throw new OnboardingCompletionPersistenceError();
    }
  }

  async claimCoexistenceContactSync(input: {
    readonly transactionId: string;
    readonly organizationId: string;
    readonly actorUserId: string;
    readonly now: Date;
  }): Promise<CoexistenceContactSyncClaim> {
    try {
      return await this.db.transaction(async (tx) => {
        await tx.execute(sql`select ${organizations.id} from ${organizations} where ${organizations.id} = ${input.organizationId} for update`);
        const [transaction] = await tx.select().from(whatsappOnboardingTransactions).where(and(
          eq(whatsappOnboardingTransactions.id, input.transactionId),
          eq(whatsappOnboardingTransactions.organizationId, input.organizationId),
          eq(whatsappOnboardingTransactions.actorUserId, input.actorUserId),
        ));
        if (
          transaction === undefined
          || transaction.provider !== 'META'
          || transaction.connectionSource !== 'EXISTING_BUSINESS_APP'
          || !['STARTED', 'COMPLETED'].includes(transaction.status)
          || (transaction.status === 'STARTED' && transaction.expiresAt.getTime() <= input.now.getTime())
        ) {
          throw new OnboardingCompletionDeniedError();
        }

        const [connection] = await tx.select().from(whatsappConnections).where(and(
          eq(whatsappConnections.organizationId, input.organizationId),
          eq(whatsappConnections.provider, 'META'),
          eq(whatsappConnections.connectionSource, 'EXISTING_BUSINESS_APP'),
          eq(whatsappConnections.connectionStatus, 'CONNECTED'),
          eq(whatsappConnections.verificationStatus, 'VERIFIED'),
        ));
        if (
          connection === undefined
          || connection.externalPhoneNumberId === null
          || connection.credentialReference === null
        ) {
          throw new OnboardingCompletionDeniedError();
        }
        if (transaction.status === 'COMPLETED') {
          return { outcome: 'ALREADY_ATTEMPTED', connectionId: connection.id };
        }
        if (transaction.coexistenceContactSyncStatus !== null) {
          return { outcome: 'ALREADY_ATTEMPTED', connectionId: connection.id };
        }

        const [claimed] = await tx.update(whatsappOnboardingTransactions).set({
          coexistenceContactSyncStatus: 'ATTEMPTED',
          coexistenceContactSyncAttemptedAt: input.now,
          updatedAt: input.now,
        }).where(and(
          eq(whatsappOnboardingTransactions.id, transaction.id),
          eq(whatsappOnboardingTransactions.status, 'STARTED'),
          isNull(whatsappOnboardingTransactions.coexistenceContactSyncStatus),
        )).returning();
        if (claimed === undefined) {
          return { outcome: 'ALREADY_ATTEMPTED', connectionId: connection.id };
        }
        return { outcome: 'CLAIMED', connection: connectionFromRow(connection) };
      });
    } catch (error) {
      if (error instanceof OnboardingCompletionDeniedError) throw error;
      throw new OnboardingCompletionPersistenceError();
    }
  }

  async recordCoexistenceContactSyncAccepted(input: {
    readonly transactionId: string;
    readonly organizationId: string;
    readonly actorUserId: string;
    readonly providerRequestId: string;
    readonly now: Date;
  }): Promise<void> {
    try {
      const [updated] = await this.db.update(whatsappOnboardingTransactions).set({
        coexistenceContactSyncStatus: 'ACCEPTED',
        coexistenceContactSyncAcceptedAt: input.now,
        coexistenceContactSyncProviderRequestId: input.providerRequestId,
        coexistenceContactSyncFailureCategory: null,
        coexistenceContactSyncProviderErrorCode: null,
        coexistenceContactSyncProviderErrorSubcode: null,
        updatedAt: input.now,
      }).where(and(
        eq(whatsappOnboardingTransactions.id, input.transactionId),
        eq(whatsappOnboardingTransactions.organizationId, input.organizationId),
        eq(whatsappOnboardingTransactions.actorUserId, input.actorUserId),
        eq(whatsappOnboardingTransactions.coexistenceContactSyncStatus, 'ATTEMPTED'),
      )).returning();
      if (updated === undefined) throw new OnboardingCompletionPersistenceError();
    } catch (error) {
      if (error instanceof OnboardingCompletionPersistenceError) throw error;
      throw new OnboardingCompletionPersistenceError();
    }
  }

  async recordCoexistenceContactSyncFailed(input: {
    readonly transactionId: string;
    readonly organizationId: string;
    readonly actorUserId: string;
    readonly error: CoexistenceContactSyncError;
    readonly now: Date;
  }): Promise<void> {
    try {
      const [updated] = await this.db.update(whatsappOnboardingTransactions).set({
        coexistenceContactSyncStatus: 'FAILED',
        coexistenceContactSyncFailureCategory: input.error.category,
        coexistenceContactSyncProviderErrorCode: input.error.providerErrorCode,
        coexistenceContactSyncProviderErrorSubcode: input.error.providerErrorSubcode ?? null,
        updatedAt: input.now,
      }).where(and(
        eq(whatsappOnboardingTransactions.id, input.transactionId),
        eq(whatsappOnboardingTransactions.organizationId, input.organizationId),
        eq(whatsappOnboardingTransactions.actorUserId, input.actorUserId),
        eq(whatsappOnboardingTransactions.coexistenceContactSyncStatus, 'ATTEMPTED'),
      )).returning();
      if (updated === undefined) throw new OnboardingCompletionPersistenceError();
    } catch (error) {
      if (error instanceof OnboardingCompletionPersistenceError) throw error;
      throw new OnboardingCompletionPersistenceError();
    }
  }

  async claimCoexistenceHistorySync(input: {
    readonly transactionId: string;
    readonly organizationId: string;
    readonly actorUserId: string;
    readonly now: Date;
  }): Promise<CoexistenceHistorySyncClaim> {
    try {
      return await this.db.transaction(async (tx) => {
        await tx.execute(sql`select ${organizations.id} from ${organizations} where ${organizations.id} = ${input.organizationId} for update`);
        const [transaction] = await tx.select().from(whatsappOnboardingTransactions).where(and(
          eq(whatsappOnboardingTransactions.id, input.transactionId),
          eq(whatsappOnboardingTransactions.organizationId, input.organizationId),
          eq(whatsappOnboardingTransactions.actorUserId, input.actorUserId),
        ));
        if (
          transaction === undefined
          || transaction.provider !== 'META'
          || transaction.connectionSource !== 'EXISTING_BUSINESS_APP'
          || !['STARTED', 'COMPLETED'].includes(transaction.status)
          || (transaction.status === 'STARTED' && transaction.expiresAt.getTime() <= input.now.getTime())
        ) {
          throw new OnboardingCompletionDeniedError();
        }

        const [connection] = await tx.select().from(whatsappConnections).where(and(
          eq(whatsappConnections.organizationId, input.organizationId),
          eq(whatsappConnections.provider, 'META'),
          eq(whatsappConnections.connectionSource, 'EXISTING_BUSINESS_APP'),
          eq(whatsappConnections.connectionStatus, 'CONNECTED'),
          eq(whatsappConnections.verificationStatus, 'VERIFIED'),
        ));
        if (
          connection === undefined
          || connection.externalPhoneNumberId === null
          || connection.credentialReference === null
        ) {
          throw new OnboardingCompletionDeniedError();
        }
        if (transaction.status === 'COMPLETED' || transaction.coexistenceHistorySyncStatus !== null) {
          return { outcome: 'ALREADY_ATTEMPTED', connectionId: connection.id };
        }

        const [claimed] = await tx.update(whatsappOnboardingTransactions).set({
          coexistenceHistorySyncStatus: 'ATTEMPTED',
          coexistenceHistorySyncAttemptedAt: input.now,
          updatedAt: input.now,
        }).where(and(
          eq(whatsappOnboardingTransactions.id, transaction.id),
          eq(whatsappOnboardingTransactions.status, 'STARTED'),
          isNull(whatsappOnboardingTransactions.coexistenceHistorySyncStatus),
        )).returning();
        if (claimed === undefined) {
          return { outcome: 'ALREADY_ATTEMPTED', connectionId: connection.id };
        }
        return { outcome: 'CLAIMED', connection: connectionFromRow(connection) };
      });
    } catch (error) {
      if (error instanceof OnboardingCompletionDeniedError) throw error;
      throw new OnboardingCompletionPersistenceError();
    }
  }

  async recordCoexistenceHistorySyncAccepted(input: {
    readonly transactionId: string;
    readonly organizationId: string;
    readonly actorUserId: string;
    readonly providerRequestId: string;
    readonly now: Date;
  }): Promise<void> {
    try {
      const [updated] = await this.db.update(whatsappOnboardingTransactions).set({
        coexistenceHistorySyncStatus: 'ACCEPTED',
        coexistenceHistorySyncAcceptedAt: input.now,
        coexistenceHistorySyncProviderRequestId: input.providerRequestId,
        coexistenceHistorySyncFailureCategory: null,
        coexistenceHistorySyncProviderErrorCode: null,
        coexistenceHistorySyncProviderErrorSubcode: null,
        updatedAt: input.now,
      }).where(and(
        eq(whatsappOnboardingTransactions.id, input.transactionId),
        eq(whatsappOnboardingTransactions.organizationId, input.organizationId),
        eq(whatsappOnboardingTransactions.actorUserId, input.actorUserId),
        eq(whatsappOnboardingTransactions.coexistenceHistorySyncStatus, 'ATTEMPTED'),
      )).returning();
      if (updated !== undefined) return;
      const [terminal] = await this.db.select({
        status: whatsappOnboardingTransactions.coexistenceHistorySyncStatus,
        providerRequestId: whatsappOnboardingTransactions.coexistenceHistorySyncProviderRequestId,
      }).from(whatsappOnboardingTransactions).where(and(
        eq(whatsappOnboardingTransactions.id, input.transactionId),
        eq(whatsappOnboardingTransactions.organizationId, input.organizationId),
        eq(whatsappOnboardingTransactions.actorUserId, input.actorUserId),
      ));
      if (
        terminal?.status === 'PROCESSED'
        || terminal?.status === 'DECLINED'
      ) {
        await this.db.update(whatsappOnboardingTransactions).set({
          coexistenceHistorySyncAcceptedAt: input.now,
          coexistenceHistorySyncProviderRequestId: input.providerRequestId,
          updatedAt: input.now,
        }).where(and(
          eq(whatsappOnboardingTransactions.id, input.transactionId),
          isNull(whatsappOnboardingTransactions.coexistenceHistorySyncProviderRequestId),
        ));
        return;
      }
      if (terminal?.status === 'ACCEPTED' && terminal.providerRequestId === input.providerRequestId) return;
      throw new OnboardingCompletionPersistenceError();
    } catch (error) {
      if (error instanceof OnboardingCompletionPersistenceError) throw error;
      throw new OnboardingCompletionPersistenceError();
    }
  }

  async recordCoexistenceHistorySyncFailed(input: {
    readonly transactionId: string;
    readonly organizationId: string;
    readonly actorUserId: string;
    readonly error: CoexistenceHistorySyncError;
    readonly now: Date;
  }): Promise<void> {
    try {
      const [updated] = await this.db.update(whatsappOnboardingTransactions).set({
        coexistenceHistorySyncStatus: 'FAILED',
        coexistenceHistorySyncFailureCategory: input.error.category,
        coexistenceHistorySyncProviderErrorCode: input.error.providerErrorCode,
        coexistenceHistorySyncProviderErrorSubcode: input.error.providerErrorSubcode ?? null,
        updatedAt: input.now,
      }).where(and(
        eq(whatsappOnboardingTransactions.id, input.transactionId),
        eq(whatsappOnboardingTransactions.organizationId, input.organizationId),
        eq(whatsappOnboardingTransactions.actorUserId, input.actorUserId),
        eq(whatsappOnboardingTransactions.coexistenceHistorySyncStatus, 'ATTEMPTED'),
      )).returning();
      if (updated !== undefined) return;
      const [terminal] = await this.db.select({
        status: whatsappOnboardingTransactions.coexistenceHistorySyncStatus,
      }).from(whatsappOnboardingTransactions).where(and(
        eq(whatsappOnboardingTransactions.id, input.transactionId),
        eq(whatsappOnboardingTransactions.organizationId, input.organizationId),
        eq(whatsappOnboardingTransactions.actorUserId, input.actorUserId),
      ));
      if (terminal?.status === 'PROCESSED' || terminal?.status === 'DECLINED' || terminal?.status === 'FAILED') return;
      throw new OnboardingCompletionPersistenceError();
    } catch (error) {
      if (error instanceof OnboardingCompletionPersistenceError) throw error;
      throw new OnboardingCompletionPersistenceError();
    }
  }

  async recordCoexistenceHistoryWebhookOutcome(input: {
    readonly externalPhoneNumberId: string;
    readonly outcome: 'DECLINED' | 'PROCESSED';
    readonly now: Date;
  }): Promise<CoexistenceHistoryWebhookTransition> {
    return this.db.transaction(async (tx) => {
      const [scope] = await tx.select({
        onboardingId: whatsappOnboardingTransactions.id,
        organizationId: whatsappOnboardingTransactions.organizationId,
        connectionId: whatsappConnections.id,
        status: whatsappOnboardingTransactions.coexistenceHistorySyncStatus,
      }).from(whatsappOnboardingTransactions).innerJoin(
        whatsappConnections,
        eq(whatsappConnections.organizationId, whatsappOnboardingTransactions.organizationId),
      ).where(and(
        eq(whatsappConnections.provider, 'META'),
        eq(whatsappConnections.connectionSource, 'EXISTING_BUSINESS_APP'),
        eq(whatsappConnections.externalPhoneNumberId, input.externalPhoneNumberId),
        eq(whatsappOnboardingTransactions.provider, 'META'),
        eq(whatsappOnboardingTransactions.connectionSource, 'EXISTING_BUSINESS_APP'),
        sql`${whatsappOnboardingTransactions.coexistenceHistorySyncStatus} is not null`,
      )).orderBy(desc(whatsappOnboardingTransactions.createdAt)).limit(1);
      if (scope === undefined) return { outcome: 'NOT_FOUND' };
      if (scope.status === input.outcome || scope.status === 'DECLINED' || scope.status === 'PROCESSED') {
        return { outcome: 'ALREADY_RECORDED', ...scopeWithoutStatus(scope) };
      }

      const [updated] = await tx.update(whatsappOnboardingTransactions).set({
        coexistenceHistorySyncStatus: input.outcome,
        coexistenceHistorySyncProcessedAt: input.outcome === 'PROCESSED' ? input.now : null,
        coexistenceHistorySyncFailureCategory: input.outcome === 'DECLINED' ? 'USER_DECISION' : null,
        coexistenceHistorySyncProviderErrorCode: input.outcome === 'DECLINED' ? 'META_HISTORY_SHARING_DECLINED' : null,
        coexistenceHistorySyncProviderErrorSubcode: null,
        updatedAt: input.now,
      }).where(and(
        eq(whatsappOnboardingTransactions.id, scope.onboardingId),
        sql`${whatsappOnboardingTransactions.coexistenceHistorySyncStatus} in ('ATTEMPTED', 'ACCEPTED', 'FAILED')`,
      )).returning({ id: whatsappOnboardingTransactions.id });
      return {
        outcome: updated === undefined ? 'ALREADY_RECORDED' : 'UPDATED',
        ...scopeWithoutStatus(scope),
      };
    });
  }

  async markCompletionSucceeded(input: {
    readonly transactionId: string;
    readonly organizationId: string;
    readonly actorUserId: string;
    readonly connectionId: string;
    readonly now: Date;
  }): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        await tx.execute(sql`select ${organizations.id} from ${organizations} where ${organizations.id} = ${input.organizationId} for update`);
        const [transaction] = await tx.select().from(whatsappOnboardingTransactions).where(and(
          eq(whatsappOnboardingTransactions.id, input.transactionId),
          eq(whatsappOnboardingTransactions.organizationId, input.organizationId),
          eq(whatsappOnboardingTransactions.actorUserId, input.actorUserId),
        ));
        if (transaction === undefined || transaction.provider !== 'META' || transaction.connectionSource !== 'EXISTING_BUSINESS_APP') {
          throw new OnboardingCompletionDeniedError();
        }
        if (transaction.status === 'COMPLETED') return;
        if (transaction.status !== 'STARTED' || transaction.expiresAt.getTime() <= input.now.getTime()) {
          throw new OnboardingCompletionDeniedError();
        }
        const [connection] = await tx.select().from(whatsappConnections).where(and(
          eq(whatsappConnections.id, input.connectionId),
          eq(whatsappConnections.organizationId, input.organizationId),
          eq(whatsappConnections.provider, 'META'),
          eq(whatsappConnections.connectionStatus, 'CONNECTED'),
          eq(whatsappConnections.verificationStatus, 'VERIFIED'),
        ));
        if (connection === undefined) throw new OnboardingCompletionDeniedError();

        await tx.update(whatsappOnboardingTransactions).set({
          status: 'COMPLETED',
          completedAt: input.now,
          updatedAt: input.now,
        }).where(and(
          eq(whatsappOnboardingTransactions.id, transaction.id),
          eq(whatsappOnboardingTransactions.status, 'STARTED'),
        ));
        await tx.insert(auditLogs).values({
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'whatsapp.onboarding.completed',
          targetType: 'whatsapp_connection',
          targetId: connection.id,
          metadata: { provider: 'META', source: 'EXISTING_BUSINESS_APP', status: 'CONNECTED' },
        });
      });
    } catch (error) {
      if (error instanceof OnboardingCompletionDeniedError) throw error;
      throw new OnboardingCompletionPersistenceError();
    }
  }
}

function scopeWithoutStatus(scope: {
  readonly onboardingId: string;
  readonly organizationId: string;
  readonly connectionId: string;
}): { readonly onboardingId: string; readonly organizationId: string; readonly connectionId: string } {
  return {
    onboardingId: scope.onboardingId,
    organizationId: scope.organizationId,
    connectionId: scope.connectionId,
  };
}

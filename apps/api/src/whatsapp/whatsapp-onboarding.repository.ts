import { Inject, Injectable } from '@nestjs/common';
import {
  auditLogs,
  organizations,
  type SlotlyFlowDatabase,
  whatsappConnections,
  whatsappOnboardingTransactions,
} from '@slotlyflow/database';
import { and, eq, lte, sql } from 'drizzle-orm';

import { AUTH_DATABASE } from '../auth/auth.tokens.js';
import type { WhatsAppConnectionStatus } from './whatsapp-connection.types.js';
import type { WhatsAppOnboardingTransaction } from './whatsapp-onboarding.types.js';

export interface WhatsAppOnboardingTransactionRepository {
  startForOrganization(input: {
    readonly actorUserId: string;
    readonly organizationId: string;
    readonly now: Date;
    readonly expiresAt: Date;
  }): Promise<StartedWhatsAppOnboardingTransaction>;
}

export type StartedWhatsAppOnboardingTransaction =
  | { readonly outcome: 'created'; readonly transaction: WhatsAppOnboardingTransaction }
  | { readonly outcome: 'reused'; readonly transaction: WhatsAppOnboardingTransaction }
  | { readonly outcome: 'started_by_other_actor' }
  | { readonly outcome: 'connection_exists'; readonly connectionStatus: WhatsAppConnectionStatus };

export class WhatsAppOnboardingAuditPersistenceError extends Error {
  constructor() {
    super('WhatsApp onboarding audit persistence failed.');
    this.name = 'WhatsAppOnboardingAuditPersistenceError';
  }
}

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

@Injectable()
export class DrizzleWhatsAppOnboardingTransactionRepository implements WhatsAppOnboardingTransactionRepository {
  constructor(@Inject(AUTH_DATABASE) private readonly db: SlotlyFlowDatabase) {}

  async startForOrganization(input: {
    readonly actorUserId: string;
    readonly organizationId: string;
    readonly now: Date;
    readonly expiresAt: Date;
  }): Promise<StartedWhatsAppOnboardingTransaction> {
    return this.db.transaction(async (tx) => {
      // Serialize connection/onboarding changes for this Business across all API instances.
      await tx.execute(sql`select ${organizations.id} from ${organizations} where ${organizations.id} = ${input.organizationId} for update`);

      const [connection] = await tx
        .select({
          connectionStatus: whatsappConnections.connectionStatus,
          connectionSource: whatsappConnections.connectionSource,
          provider: whatsappConnections.provider,
        })
        .from(whatsappConnections)
        .where(eq(whatsappConnections.organizationId, input.organizationId));
      if (
        connection !== undefined
        && (
          connection.provider !== 'META'
          || connection.connectionSource !== 'EXISTING_BUSINESS_APP'
          || ![
            'PENDING',
            'VERIFYING',
            'DISCONNECTED',
            'NEEDS_REAUTH',
          ].includes(connection.connectionStatus)
        )
      ) {
        return { outcome: 'connection_exists', connectionStatus: connection.connectionStatus };
      }

      const [active] = await tx
        .select()
        .from(whatsappOnboardingTransactions)
        .where(and(
          eq(whatsappOnboardingTransactions.organizationId, input.organizationId),
          eq(whatsappOnboardingTransactions.status, 'STARTED'),
      ));
      if (active !== undefined && active.expiresAt > input.now) {
        if (active.actorUserId !== input.actorUserId) return { outcome: 'started_by_other_actor' };
        return { outcome: 'reused', transaction: transactionFromRow(active) };
      }
      if (active !== undefined) {
        await tx.update(whatsappOnboardingTransactions)
          .set({ status: 'EXPIRED', updatedAt: input.now })
          .where(and(
            eq(whatsappOnboardingTransactions.id, active.id),
            eq(whatsappOnboardingTransactions.status, 'STARTED'),
            lte(whatsappOnboardingTransactions.expiresAt, input.now),
          ));
      }

      const [created] = await tx.insert(whatsappOnboardingTransactions).values({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        provider: 'META',
        connectionSource: 'EXISTING_BUSINESS_APP',
        status: 'STARTED',
        expiresAt: input.expiresAt,
      }).returning();
      if (created === undefined) throw new Error('WhatsApp onboarding transaction creation failed.');

      try {
        await tx.insert(auditLogs).values({
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'whatsapp.onboarding.started',
          targetType: 'whatsapp_onboarding_transaction',
          targetId: created.id,
          metadata: { provider: 'META', source: 'EXISTING_BUSINESS_APP' },
        });
      } catch {
        throw new WhatsAppOnboardingAuditPersistenceError();
      }
      return { outcome: 'created', transaction: transactionFromRow(created) };
    });
  }
}

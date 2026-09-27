import type { WhatsAppConnectionSource, WhatsAppProviderName } from './whatsapp-connection.types.js';

export const whatsappOnboardingTransactionStatuses = ['STARTED', 'COMPLETED', 'EXPIRED', 'CANCELLED'] as const;
export type WhatsAppOnboardingTransactionStatus = (typeof whatsappOnboardingTransactionStatuses)[number];
export const whatsappCoexistenceContactSyncStatuses = ['ATTEMPTED', 'ACCEPTED', 'FAILED'] as const;
export type WhatsAppCoexistenceContactSyncStatus = (typeof whatsappCoexistenceContactSyncStatuses)[number];
export const whatsappCoexistenceHistorySyncStatuses = ['ATTEMPTED', 'ACCEPTED', 'DECLINED', 'FAILED', 'PROCESSED'] as const;
export type WhatsAppCoexistenceHistorySyncStatus = (typeof whatsappCoexistenceHistorySyncStatuses)[number];

/** Durable, provider-neutral state; raw provider payloads never enter this model. */
export interface WhatsAppOnboardingTransaction {
  readonly id: string;
  readonly organizationId: string;
  readonly actorUserId: string;
  readonly provider: WhatsAppProviderName;
  readonly connectionSource: WhatsAppConnectionSource;
  readonly status: WhatsAppOnboardingTransactionStatus;
  readonly expiresAt: Date;
  readonly completedAt: Date | null;
  readonly coexistenceContactSyncStatus: WhatsAppCoexistenceContactSyncStatus | null;
  readonly coexistenceContactSyncAttemptedAt: Date | null;
  readonly coexistenceContactSyncAcceptedAt: Date | null;
  readonly coexistenceContactSyncProviderRequestId: string | null;
  readonly coexistenceContactSyncFailureCategory: string | null;
  readonly coexistenceContactSyncProviderErrorCode: string | null;
  readonly coexistenceContactSyncProviderErrorSubcode: string | null;
  readonly coexistenceHistorySyncStatus: WhatsAppCoexistenceHistorySyncStatus | null;
  readonly coexistenceHistorySyncAttemptedAt: Date | null;
  readonly coexistenceHistorySyncAcceptedAt: Date | null;
  readonly coexistenceHistorySyncProcessedAt: Date | null;
  readonly coexistenceHistorySyncProviderRequestId: string | null;
  readonly coexistenceHistorySyncFailureCategory: string | null;
  readonly coexistenceHistorySyncProviderErrorCode: string | null;
  readonly coexistenceHistorySyncProviderErrorSubcode: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

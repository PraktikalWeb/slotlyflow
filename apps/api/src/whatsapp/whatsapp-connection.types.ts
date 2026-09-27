import type { ProviderCredentialReference } from './credential-store.js';

export const whatsappConnectionSources = ['EXISTING_BUSINESS_APP', 'NEW_NUMBER', 'EXISTING_PLATFORM'] as const;
export type WhatsAppConnectionSource = (typeof whatsappConnectionSources)[number];

export const whatsappConnectionStatuses = ['PENDING', 'VERIFYING', 'CONNECTED', 'FAILED', 'DISCONNECTED', 'NEEDS_REAUTH', 'CONFLICT'] as const;
export type WhatsAppConnectionStatus = (typeof whatsappConnectionStatuses)[number];
export type WhatsAppConnectionVerificationStatus = 'VERIFIED' | 'CHECK_FAILED';

export type WhatsAppProviderName = 'META';

export interface WhatsAppConnection {
  readonly id: string;
  readonly organizationId: string;
  readonly provider: WhatsAppProviderName;
  readonly connectionSource: WhatsAppConnectionSource;
  readonly connectionStatus: WhatsAppConnectionStatus;
  readonly externalWabaId: string | null;
  readonly externalPhoneNumberId: string | null;
  readonly displayPhoneNumber: string | null;
  /** Server-only opaque pointer. It is never returned to ordinary product APIs. */
  readonly credentialReference: ProviderCredentialReference | null;
  readonly verificationStatus: WhatsAppConnectionVerificationStatus | null;
  readonly lastVerifiedAt: Date | null;
  readonly lastVerificationCode: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Provider-normalized evidence that an onboarding flow has verified a number.
 * It deliberately contains no Meta SDK or raw callback types.
 */
export interface VerifiedWhatsAppConnectionResult {
  readonly provider: WhatsAppProviderName;
  readonly source: WhatsAppConnectionSource;
  readonly externalWabaId: string;
  readonly externalPhoneNumberId: string;
  readonly displayPhoneNumber: string | null;
  readonly credentialReference: ProviderCredentialReference;
}

const allowedTransitions: Readonly<Record<WhatsAppConnectionStatus, readonly WhatsAppConnectionStatus[]>> = {
  PENDING: ['VERIFYING', 'CONNECTED', 'FAILED', 'DISCONNECTED', 'NEEDS_REAUTH', 'CONFLICT'],
  VERIFYING: ['CONNECTED', 'FAILED', 'DISCONNECTED', 'NEEDS_REAUTH', 'CONFLICT'],
  CONNECTED: ['VERIFYING', 'DISCONNECTED', 'NEEDS_REAUTH', 'CONFLICT'],
  FAILED: ['VERIFYING', 'DISCONNECTED', 'NEEDS_REAUTH', 'CONFLICT'],
  DISCONNECTED: ['VERIFYING', 'CONNECTED', 'NEEDS_REAUTH', 'CONFLICT'],
  NEEDS_REAUTH: ['VERIFYING', 'CONNECTED', 'DISCONNECTED', 'CONFLICT'],
  CONFLICT: ['VERIFYING', 'CONNECTED', 'DISCONNECTED', 'NEEDS_REAUTH'],
};

/** The small persisted lifecycle; connection source is intentionally separate. */
export function mayTransitionWhatsAppConnection(
  from: WhatsAppConnectionStatus,
  to: WhatsAppConnectionStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

export function isWhatsAppConnectionSource(value: unknown): value is WhatsAppConnectionSource {
  return typeof value === 'string' && whatsappConnectionSources.includes(value as WhatsAppConnectionSource);
}

export function isWhatsAppConnectionStatus(value: unknown): value is WhatsAppConnectionStatus {
  return typeof value === 'string' && whatsappConnectionStatuses.includes(value as WhatsAppConnectionStatus);
}

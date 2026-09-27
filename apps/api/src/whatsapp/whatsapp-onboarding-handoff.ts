import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const version = 'v1';
const nonceLength = 12;
const authenticationTagLength = 16;
const additionalAuthenticatedData = Buffer.from('slotlyflow:whatsapp-onboarding-handoff:v1', 'utf8');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface WhatsAppOnboardingHandoff {
  readonly transactionId: string;
  readonly organizationId: string;
  readonly actorUserId: string;
  readonly expiresAt: Date;
}

export class WhatsAppOnboardingHandoffError extends Error {
  constructor() {
    super('WhatsApp onboarding handoff is unavailable.');
    this.name = 'WhatsAppOnboardingHandoffError';
  }
}

/**
 * Seals the existing transaction binding into a short-lived opaque capability.
 * The token is carried in the popup URL fragment, never persisted or logged.
 */
export function sealWhatsAppOnboardingHandoff(
  input: WhatsAppOnboardingHandoff,
  encryptionKey: Uint8Array,
): string {
  assertEncryptionKey(encryptionKey);
  const nonce = randomBytes(nonceLength);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, nonce, {
    authTagLength: authenticationTagLength,
  });
  cipher.setAAD(additionalAuthenticatedData);
  const plaintext = Buffer.from(JSON.stringify({
    transactionId: input.transactionId,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    expiresAt: input.expiresAt.toISOString(),
  }), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();
  return [
    version,
    nonce.toString('base64url'),
    ciphertext.toString('base64url'),
    authenticationTag.toString('base64url'),
  ].join('.');
}

export function openWhatsAppOnboardingHandoff(
  token: unknown,
  encryptionKey: Uint8Array,
  now: Date,
): WhatsAppOnboardingHandoff {
  assertEncryptionKey(encryptionKey);
  if (typeof token !== 'string' || token.length < 64 || token.length > 2_048 || /[\r\n]/.test(token)) {
    throw new WhatsAppOnboardingHandoffError();
  }
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== version) throw new WhatsAppOnboardingHandoffError();

  try {
    const nonce = Buffer.from(parts[1] as string, 'base64url');
    const ciphertext = Buffer.from(parts[2] as string, 'base64url');
    const authenticationTag = Buffer.from(parts[3] as string, 'base64url');
    if (nonce.length !== nonceLength || ciphertext.length === 0 || authenticationTag.length !== authenticationTagLength) {
      throw new WhatsAppOnboardingHandoffError();
    }
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey, nonce, {
      authTagLength: authenticationTagLength,
    });
    decipher.setAAD(additionalAuthenticatedData);
    decipher.setAuthTag(authenticationTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const payload: unknown = JSON.parse(plaintext);
    const handoff = handoffFromPayload(payload);
    if (handoff.expiresAt.getTime() <= now.getTime()) throw new WhatsAppOnboardingHandoffError();
    return handoff;
  } catch (error) {
    if (error instanceof WhatsAppOnboardingHandoffError) throw error;
    throw new WhatsAppOnboardingHandoffError();
  }
}

function handoffFromPayload(value: unknown): WhatsAppOnboardingHandoff {
  if (typeof value !== 'object' || value === null) throw new WhatsAppOnboardingHandoffError();
  const payload = value as Record<string, unknown>;
  if (
    typeof payload.transactionId !== 'string'
    || typeof payload.organizationId !== 'string'
    || typeof payload.actorUserId !== 'string'
    || typeof payload.expiresAt !== 'string'
    || !uuidPattern.test(payload.transactionId)
    || !uuidPattern.test(payload.organizationId)
    || !uuidPattern.test(payload.actorUserId)
  ) {
    throw new WhatsAppOnboardingHandoffError();
  }
  const expiresAt = new Date(payload.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) throw new WhatsAppOnboardingHandoffError();
  return {
    transactionId: payload.transactionId,
    organizationId: payload.organizationId,
    actorUserId: payload.actorUserId,
    expiresAt,
  };
}

function assertEncryptionKey(value: Uint8Array): void {
  if (value.byteLength !== 32) throw new WhatsAppOnboardingHandoffError();
}

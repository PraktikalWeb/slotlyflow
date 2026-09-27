const providerWhatsAppIdentity = /^[1-9][0-9]{6,14}$/;

export interface NormalizedWhatsAppContactIdentity {
  readonly whatsappId: string;
  readonly phoneNumber: string;
}

/**
 * Provider identities are international digits, not locale-specific input.
 * A single optional leading plus is accepted without inventing a country code.
 */
export function normalizeWhatsAppContactIdentity(value: unknown): NormalizedWhatsAppContactIdentity | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  const whatsappId = trimmed.startsWith('+') ? trimmed.slice(1) : trimmed;
  if (!providerWhatsAppIdentity.test(whatsappId)) return undefined;
  return { whatsappId, phoneNumber: `+${whatsappId}` };
}

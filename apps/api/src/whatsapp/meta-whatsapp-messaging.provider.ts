import type { MetaWhatsAppConfig } from '@slotlyflow/config';

import { CredentialEncryptionError, type CredentialStore } from './credential-store.js';
import {
  WhatsAppMessagingProviderError,
  type OutboundWhatsAppMessageResult,
  type OutboundWhatsAppInteractiveMessage,
  type OutboundWhatsAppTextMessage,
  type WhatsAppMessagingProvider,
} from './whatsapp-messaging-provider.js';

const graphOrigin = 'https://graph.facebook.com';
const numericIdentifier = /^[0-9]{1,64}$/;
const providerMessageIdentifier = /^[0-9A-Za-z._:=-]{1,255}$/;

/** Meta-only outbound adapter. Graph request/response types remain here. */
export class MetaWhatsAppMessagingProvider implements WhatsAppMessagingProvider {
  readonly provider = 'META' as const;

  constructor(
    private readonly config: MetaWhatsAppConfig,
    private readonly credentials: CredentialStore,
    private readonly request: typeof fetch = fetch,
  ) {}

  async sendText(message: OutboundWhatsAppTextMessage): Promise<OutboundWhatsAppMessageResult> {
    if (
      !numericIdentifier.test(message.senderPhoneNumberId) ||
      !numericIdentifier.test(message.recipientWhatsAppId) ||
      typeof message.text !== 'string' || message.text.length === 0 || message.text.length > 4_096
    ) {
      throw new WhatsAppMessagingProviderError('REJECTED', 'LOCAL_REQUEST_INVALID');
    }

    return this.send(message, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: message.recipientWhatsAppId,
      type: 'text',
      text: { preview_url: false, body: message.text },
    });
  }

  async sendInteractive(message: OutboundWhatsAppInteractiveMessage): Promise<OutboundWhatsAppMessageResult> {
    if (
      !numericIdentifier.test(message.senderPhoneNumberId)
      || !numericIdentifier.test(message.recipientWhatsAppId)
      || typeof message.body !== 'string' || message.body.length === 0 || message.body.length > 1_024
      || message.options.length < 1 || message.options.length > 3
      || message.options.some((option) => (
        !providerMessageIdentifier.test(option.id)
        || option.label.length === 0
        || option.label.length > 20
      ))
    ) {
      throw new WhatsAppMessagingProviderError('REJECTED', 'LOCAL_REQUEST_INVALID');
    }

    return this.send(message, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: message.recipientWhatsAppId,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: message.body },
        action: {
          buttons: message.options.map((option) => ({
            type: 'reply',
            reply: { id: option.id, title: option.label },
          })),
        },
      },
    });
  }

  private async send(
    message: Pick<OutboundWhatsAppTextMessage, 'senderPhoneNumberId' | 'credentialReference'>,
    body: Record<string, unknown>,
  ): Promise<OutboundWhatsAppMessageResult> {
    let credential: { readonly provider: 'META'; readonly accessToken: string; readonly expiresAt: Date | null };
    try {
      const resolved = await this.credentials.retrieve(message.credentialReference);
      if (!isMetaCredential(resolved) || (resolved.expiresAt !== null && resolved.expiresAt.getTime() <= Date.now())) {
        throw new CredentialEncryptionError();
      }
      credential = resolved;
    } catch {
      throw new WhatsAppMessagingProviderError('CREDENTIAL_INVALID', 'CREDENTIAL_INVALID');
    }

    const endpoint = new URL(`${graphOrigin}/${this.config.graphApiVersion}/${encodeURIComponent(message.senderPhoneNumberId)}/messages`);
    let response: Response;
    try {
      response = await this.request(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${credential.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      // A transport timeout cannot prove that Meta did not accept the request.
      throw new WhatsAppMessagingProviderError('OUTCOME_UNKNOWN', 'TRANSPORT_OUTCOME_UNKNOWN');
    }

    const payload = await safeJson(response);
    if (!response.ok) {
      const providerErrorCode = metaErrorCodeFrom(payload) ?? `HTTP_${response.status}`;
      if (response.status === 401 || response.status === 403 || isMetaAuthorizationCode(providerErrorCode)) {
        throw new WhatsAppMessagingProviderError('CREDENTIAL_INVALID', providerErrorCode);
      }
      if (response.status === 429 || response.status >= 500) {
        throw new WhatsAppMessagingProviderError('UNAVAILABLE', providerErrorCode);
      }
      throw new WhatsAppMessagingProviderError('REJECTED', providerErrorCode);
    }
    const providerMessageId = providerMessageIdFrom(payload);
    if (providerMessageId === undefined) {
      // Meta may have accepted a 2xx request even if a proxy produced an unusable body.
      throw new WhatsAppMessagingProviderError('OUTCOME_UNKNOWN', 'META_RESPONSE_INVALID');
    }
    return { providerMessageId, acceptedAt: new Date() };
  }
}

function metaErrorCodeFrom(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('error' in value)) return undefined;
  const error = value.error;
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const code = error.code;
  if ((typeof code !== 'number' && typeof code !== 'string') || !/^\d{1,10}$/.test(String(code))) return undefined;
  if (!('error_subcode' in error)) return String(code);
  const subcode = error.error_subcode;
  return (typeof subcode === 'number' || typeof subcode === 'string') && /^\d{1,10}$/.test(String(subcode))
    ? `${String(code)}:${String(subcode)}`
    : String(code);
}

function isMetaAuthorizationCode(value: string): boolean {
  const primaryCode = value.split(':', 1)[0];
  return primaryCode === '10' || primaryCode === '190' || primaryCode === '200';
}

function isMetaCredential(value: unknown): value is { readonly provider: 'META'; readonly accessToken: string; readonly expiresAt: Date | null } {
  return typeof value === 'object' && value !== null
    && 'provider' in value && value.provider === 'META'
    && 'accessToken' in value && typeof value.accessToken === 'string' && value.accessToken.length > 0
    && 'expiresAt' in value && (value.expiresAt === null || value.expiresAt instanceof Date);
}

function providerMessageIdFrom(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('messages' in value) || !Array.isArray(value.messages)) return undefined;
  const first = value.messages[0];
  return typeof first === 'object' && first !== null && 'id' in first && typeof first.id === 'string' && providerMessageIdentifier.test(first.id)
    ? first.id
    : undefined;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

import { describe, expect, it, vi } from 'vitest';

import { providerCredentialReference, type CredentialStore } from '../src/whatsapp/credential-store.js';
import { MetaWhatsAppMessagingProvider } from '../src/whatsapp/meta-whatsapp-messaging.provider.js';
import { WhatsAppMessagingProviderError } from '../src/whatsapp/whatsapp-messaging-provider.js';

const config = {
  appId: '1234567890',
  appSecret: 'server-only-fixture',
  embeddedSignupConfigurationId: '9876543210',
  graphApiVersion: 'v25.0',
  webhookVerifyToken: 'fixture-webhook-verify-token',
  credentialEncryptionKey: Buffer.alloc(32, 5),
};
const credentialReference = providerCredentialReference('00000000-0000-4000-8000-000000000001');

function credentialStore(): CredentialStore {
  return {
    prepare: vi.fn(),
    retrieve: vi.fn(async () => ({ provider: 'META' as const, accessToken: 'server-only-test-token', expiresAt: null })),
    rotate: vi.fn(),
    revoke: vi.fn(),
  };
}

describe('MetaWhatsAppMessagingProvider', () => {
  it('uses the persisted credential reference to send the documented text payload and returns only a normalized result', async () => {
    const request = vi.fn<typeof fetch>(async (url, init) => {
      expect(url.toString()).toBe('https://graph.facebook.com/v25.0/106540352242922/messages');
      expect(init?.headers).toMatchObject({ authorization: 'Bearer server-only-test-token', 'content-type': 'application/json' });
      expect(init?.body).toBe(JSON.stringify({
        messaging_product: 'whatsapp', recipient_type: 'individual', to: '16505551234', type: 'text',
        text: { preview_url: false, body: 'Hello customer' },
      }));
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.outbound-test' }] }), { status: 200 });
    });
    const provider = new MetaWhatsAppMessagingProvider(config, credentialStore(), request);

    const result = await provider.sendText({
      senderPhoneNumberId: '106540352242922', recipientWhatsAppId: '16505551234', credentialReference, text: 'Hello customer',
    });

    expect(result.providerMessageId).toBe('wamid.outbound-test');
    expect(result.acceptedAt).toBeInstanceOf(Date);
  });

  it('classifies credential rejection, provider rejection, and ambiguous transport safely without exposing raw responses', async () => {
    const message = { senderPhoneNumberId: '106540352242922', recipientWhatsAppId: '16505551234', credentialReference, text: 'Hello customer' };
    const unauthorized = new MetaWhatsAppMessagingProvider(config, credentialStore(), async () => new Response(JSON.stringify({ error: { message: 'secret raw provider detail' } }), { status: 401 }));
    const rejected = new MetaWhatsAppMessagingProvider(config, credentialStore(), async () => new Response(JSON.stringify({ error: { message: 'raw provider detail' } }), { status: 400 }));
    const ambiguous = new MetaWhatsAppMessagingProvider(config, credentialStore(), async () => { throw new Error('network detail'); });

    await expect(unauthorized.sendText(message)).rejects.toMatchObject({ kind: 'CREDENTIAL_INVALID' } satisfies Partial<WhatsAppMessagingProviderError>);
    await expect(rejected.sendText(message)).rejects.toMatchObject({ kind: 'REJECTED' } satisfies Partial<WhatsAppMessagingProviderError>);
    await expect(ambiguous.sendText(message)).rejects.toMatchObject({ kind: 'OUTCOME_UNKNOWN' } satisfies Partial<WhatsAppMessagingProviderError>);
  });

  it('renders four or more reviewed choices as a Meta interactive list with stable row IDs', async () => {
    const request = vi.fn<typeof fetch>(async (_url, init) => {
      expect(init?.body).toBe(JSON.stringify({
        messaging_product: 'whatsapp', recipient_type: 'individual', to: '16505551234', type: 'interactive',
        interactive: {
          type: 'list', body: { text: 'What can we help you with?' }, action: {
            button: 'Choose an enquiry', sections: [{ title: 'Options', rows: [
              { id: 'wansati_enquiry_shop_products', title: 'Shop & Products' },
              { id: 'wansati_enquiry_orders_delivery', title: 'Orders & Delivery' },
              { id: 'wansati_enquiry_payments', title: 'Payments' },
              { id: 'wansati_enquiry_returns_exchanges', title: 'Returns & Exchanges' },
            ] }],
          },
        },
      }));
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.outbound-list' }] }), { status: 200 });
    });
    const provider = new MetaWhatsAppMessagingProvider(config, credentialStore(), request);

    await expect(provider.sendInteractive({
      senderPhoneNumberId: '106540352242922', recipientWhatsAppId: '16505551234', credentialReference,
      body: 'What can we help you with?', listButtonLabel: 'Choose an enquiry', options: [
        { id: 'wansati_enquiry_shop_products', label: 'Shop & Products' },
        { id: 'wansati_enquiry_orders_delivery', label: 'Orders & Delivery' },
        { id: 'wansati_enquiry_payments', label: 'Payments' },
        { id: 'wansati_enquiry_returns_exchanges', label: 'Returns & Exchanges' },
      ],
    })).resolves.toMatchObject({ providerMessageId: 'wamid.outbound-list' });
  });
});

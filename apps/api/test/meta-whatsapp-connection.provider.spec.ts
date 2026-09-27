import { describe, expect, it, vi } from 'vitest';

import { MetaProviderOperationError, MetaWhatsAppConnectionProvider } from '../src/whatsapp/meta-whatsapp-connection.provider.js';

const config = { appId: '123', appSecret: 'test-only-secret', embeddedSignupConfigurationId: '456', graphApiVersion: 'v25.0', webhookVerifyToken: 'meta-webhook-verify-token-fixture', credentialEncryptionKey: Buffer.alloc(32, 4) };

describe('MetaWhatsAppConnectionProvider', () => {
  it('exchanges the code server-side, verifies the hinted phone inside the hinted WABA, and returns encrypted material only', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'provider-access-token', expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: '222', display_phone_number: '+27 12 345 6789' }] }), { status: 200 }));
    const provider = new MetaWhatsAppConnectionProvider(config, request);
    const result = await provider.completeExistingBusinessAppConnection({ authorizationCode: 'browser-code', whatsappBusinessAccountIdHint: '111', phoneNumberIdHint: '222' });
    expect(result.connection).toMatchObject({ externalWabaId: '111', externalPhoneNumberId: '222', displayPhoneNumber: '+27 12 345 6789' });
    expect(result.credential.ciphertext).not.toContain('provider-access-token');
    expect(result.credential.reference).not.toContain('provider-access-token');
    expect(String(request.mock.calls[0]?.[0])).toContain('/v25.0/oauth/access_token');
    expect(String(request.mock.calls[1]?.[0])).toContain('/v25.0/111/phone_numbers');
  });

  it('refuses a browser hint that Meta does not verify', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'provider-access-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'different' }] }), { status: 200 }));
    const provider = new MetaWhatsAppConnectionProvider(config, request);
    await expect(provider.completeExistingBusinessAppConnection({ authorizationCode: 'browser-code', whatsappBusinessAccountIdHint: '111', phoneNumberIdHint: '222' })).rejects.toBeInstanceOf(MetaProviderOperationError);
  });
});

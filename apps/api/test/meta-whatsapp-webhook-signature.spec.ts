import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { hasValidMetaWebhookSignature, matchesMetaWebhookVerifyToken } from '../src/whatsapp/meta-whatsapp-webhook-signature.js';

describe('Meta WhatsApp webhook authenticity checks', () => {
  const secret = 'server-only-webhook-test-secret';
  const body = Buffer.from('{"object":"whatsapp_business_account"}', 'utf8');
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

  it('accepts only the exact signed body and supports constant-time verify-token matching', () => {
    expect(hasValidMetaWebhookSignature(body, signature, secret)).toBe(true);
    expect(hasValidMetaWebhookSignature(Buffer.from('{"object":"modified"}', 'utf8'), signature, secret)).toBe(false);
    expect(hasValidMetaWebhookSignature(body, undefined, secret)).toBe(false);
    expect(matchesMetaWebhookVerifyToken('correct-token-value', 'correct-token-value')).toBe(true);
    expect(matchesMetaWebhookVerifyToken('wrong-token-value', 'correct-token-value')).toBe(false);
  });
});

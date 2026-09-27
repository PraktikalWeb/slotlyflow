import { createHmac, timingSafeEqual } from 'node:crypto';

const signaturePrefix = 'sha256=';

/** Verifies Meta's X-Hub-Signature-256 over the exact request bytes. */
export function hasValidMetaWebhookSignature(
  rawBody: Buffer,
  suppliedSignature: string | string[] | undefined,
  appSecret: string,
): boolean {
  if (!Buffer.isBuffer(rawBody) || typeof suppliedSignature !== 'string' || !suppliedSignature.startsWith(signaturePrefix)) return false;
  const received = suppliedSignature.slice(signaturePrefix.length);
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(received, 'hex');
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

/** Constant-time string equality for the Meta webhook verification token. */
export function matchesMetaWebhookVerifyToken(received: unknown, expected: string): boolean {
  if (typeof received !== 'string') return false;
  const receivedBuffer = Buffer.from(received, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

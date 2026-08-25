import type { Transporter } from 'nodemailer';
import { describe, expect, it, vi } from 'vitest';

import { SmtpEmailProvider } from '../src/email/smtp-email.provider.js';

describe('SMTP email provider', () => {
  it('uses the configured transport and sends restrained HTML with a plain-text fallback', async () => {
    const verify = vi.fn(async () => true);
    let delivered: unknown;
    const sendMail = vi.fn<(message: unknown) => Promise<unknown>>(async (message) => {
      delivered = message;
      return { messageId: 'test-message' };
    });
    const provider = new SmtpEmailProvider({
      provider: 'smtp',
      webAppUrl: 'http://localhost:3000/',
      from: { address: 'no-reply@slotlyflow.local', name: 'SlotlyFlow' },
      smtp: { host: '127.0.0.1', port: 1025, secure: false },
    }, { verify, sendMail } as unknown as Pick<Transporter, 'sendMail' | 'verify'>);

    await provider.assertAvailable();
    await provider.sendVerificationEmail({
      to: 'person@example.test',
      verificationUrl: 'http://localhost:3000/verify-email?token=opaque-token',
      expiresAt: new Date('2026-08-26T12:00:00.000Z'),
    });

    expect(verify).toHaveBeenCalledOnce();
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: { address: 'no-reply@slotlyflow.local', name: 'SlotlyFlow' },
      to: 'person@example.test',
      subject: 'Verify your SlotlyFlow email address',
      text: expect.stringContaining('http://localhost:3000/verify-email?token=opaque-token'),
      html: expect.stringContaining('Verify email address'),
    }));
    expect(JSON.stringify(delivered)).not.toContain('tracking');
    expect(JSON.stringify(delivered)).not.toContain('<img');
  });
});

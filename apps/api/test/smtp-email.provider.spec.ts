import type { Transporter } from 'nodemailer';
import net from 'node:net';
import { describe, expect, it, vi } from 'vitest';

import { SmtpEmailProvider, smtpTransportTimeouts } from '../src/email/smtp-email.provider.js';

describe('SMTP email provider', () => {
  it('uses bounded transport timeouts', () => {
    expect(smtpTransportTimeouts).toEqual({
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
    });
  });

  it('fails within the bounded greeting timeout when SMTP accepts a connection but never responds', async () => {
    const sockets = new Set<net.Socket>();
    const server = net.createServer((socket) => {
      sockets.add(socket);
      socket.once('close', () => sockets.delete(socket));
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('Expected a TCP server address.');

    const provider = new SmtpEmailProvider({
      provider: 'smtp',
      webAppUrl: 'http://localhost:3000/',
      from: { address: 'no-reply@slotlyflow.local', name: 'SlotlyFlow' },
      smtp: { host: '127.0.0.1', port: address.port, secure: false },
    });

    const startedAt = Date.now();
    try {
      await expect(provider.sendVerificationEmail({
        to: 'person@example.test',
        verificationUrl: 'http://localhost:3000/verify-email?token=opaque-token',
        expiresAt: new Date('2026-08-26T12:00:00.000Z'),
      })).rejects.toThrow();
      expect(Date.now() - startedAt).toBeLessThanOrEqual(smtpTransportTimeouts.greetingTimeout + 2_000);
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)));
    }
  }, 10_000);

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

    expect(verify).toHaveBeenCalledTimes(2);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: { address: 'no-reply@slotlyflow.local', name: 'SlotlyFlow' },
      to: 'person@example.test',
      subject: 'Verify your SlotlyFlow email address',
      text: expect.stringContaining('http://localhost:3000/verify-email?token=opaque-token'),
      html: expect.stringContaining('Verify email'),
    }));
    expect(JSON.stringify(delivered)).not.toContain('tracking');
    expect(JSON.stringify(delivered)).toContain('cid:slotlyflow-logo');
  });

  it('sends password-reset email through the same SMTP boundary without exposing it through HTTP', async () => {
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

    await provider.sendPasswordResetEmail({
      to: 'person@example.test',
      passwordResetUrl: 'http://localhost:3000/reset-password?token=opaque-token',
      expiresAt: new Date('2026-08-26T12:00:00.000Z'),
    });

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'person@example.test',
      subject: 'Reset your SlotlyFlow password',
      text: expect.stringContaining('http://localhost:3000/reset-password?token=opaque-token'),
      html: expect.stringContaining('Reset password'),
    }));
    expect(JSON.stringify(delivered)).not.toContain('tracking');
  });
});

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { EmailDeliveryConfig } from '@slotlyflow/config';

import type { EmailProvider, VerificationEmailMessage } from './email-provider.js';

type SmtpEmailConfig = Extract<EmailDeliveryConfig, { provider: 'smtp' }>;
type VerificationTransport = Pick<Transporter, 'sendMail' | 'verify'>;

export class SmtpEmailProvider implements EmailProvider {
  private readonly transport: VerificationTransport;

  constructor(
    private readonly config: SmtpEmailConfig,
    transport?: VerificationTransport,
  ) {
    this.transport = transport ?? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      ...(config.smtp.username === undefined
        ? {}
        : { auth: { user: config.smtp.username, pass: config.smtp.password } }),
    });
  }

  async assertAvailable(): Promise<void> {
    await this.transport.verify();
  }

  async sendVerificationEmail(message: VerificationEmailMessage): Promise<void> {
    const expiry = message.expiresAt.toUTCString();
    const escapedUrl = escapeHtml(message.verificationUrl);
    await this.transport.sendMail({
      from: { address: this.config.from.address, name: this.config.from.name },
      to: message.to,
      subject: 'Verify your SlotlyFlow email address',
      text: [
        'Verify your SlotlyFlow email address',
        '',
        'Use this secure link to verify your email address:',
        message.verificationUrl,
        '',
        `This link expires at ${expiry}.`,
        '',
        'If you did not create a SlotlyFlow account, you can ignore this email.',
      ].join('\n'),
      html: [
        '<!doctype html><html><body style="margin:0;background:#f7f9f8;color:#111816;font-family:Arial,sans-serif">',
        '<div style="margin:0 auto;max-width:560px;padding:40px 24px">',
        '<p style="margin:0 0 24px;color:#003b2d;font-size:20px;font-weight:700">SlotlyFlow</p>',
        '<h1 style="margin:0 0 12px;color:#003b2d;font-size:28px;line-height:1.2">Verify your email address</h1>',
        '<p style="margin:0 0 24px;line-height:1.6">Confirm this email address to finish setting up your SlotlyFlow account.</p>',
        `<p style="margin:0 0 24px"><a href="${escapedUrl}" style="display:inline-block;padding:12px 20px;border-radius:7px;background:#b7f34a;color:#003b2d;font-weight:700;text-decoration:none">Verify email address</a></p>`,
        `<p style="margin:0 0 12px;color:#66736f;font-size:14px;line-height:1.5">This link expires at ${escapeHtml(expiry)}.</p>`,
        '<p style="margin:0;color:#66736f;font-size:14px;line-height:1.5">If you did not create a SlotlyFlow account, you can ignore this email.</p>',
        '</div></body></html>',
      ].join(''),
    });
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

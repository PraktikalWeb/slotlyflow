import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { EmailDeliveryConfig } from '@slotlyflow/config';

import type { EmailProvider, NotificationEmailMessage, PasswordResetEmailMessage, VerificationEmailMessage } from './email-provider.js';
import {
  noRegistrationDiagnostics,
  safeRegistrationExceptionType,
  type RegistrationDiagnosticReporter,
} from '../observability/registration-diagnostics.js';
import { buildTransactionalEmailHtml, getTransactionalEmailAttachments } from './transactional-email.js';

type SmtpEmailConfig = Extract<EmailDeliveryConfig, { provider: 'smtp' }>;
type SmtpTransport = Pick<Transporter, 'sendMail' | 'verify'>;

export const smtpTransportTimeouts = {
  connectionTimeout: 5_000,
  greetingTimeout: 5_000,
  socketTimeout: 10_000,
} as const;

export class SmtpEmailProvider implements EmailProvider {
  private transport: SmtpTransport | undefined;

  constructor(
    private readonly config: SmtpEmailConfig,
    transport?: SmtpTransport,
  ) {
    this.transport = transport;
  }

  async assertAvailable(): Promise<void> {
    await this.transportFor(noRegistrationDiagnostics).verify();
  }

  async sendVerificationEmail(
    message: VerificationEmailMessage,
    diagnostics: RegistrationDiagnosticReporter = noRegistrationDiagnostics,
  ): Promise<void> {
    diagnostics({
      stage: 'email_configuration_resolved',
      outcome: 'success',
      configuration: {
        email_provider: 'smtp',
        smtp_host_loaded: this.config.smtp.host.length > 0,
        smtp_port_loaded: Number.isInteger(this.config.smtp.port),
        smtp_secure_loaded: typeof this.config.smtp.secure === 'boolean',
        email_from_address_loaded: this.config.from.address.length > 0,
        email_from_name_loaded: this.config.from.name.length > 0,
      },
    });
    const transport = this.transportFor(diagnostics);

    diagnostics({ stage: 'smtp_connection_started', outcome: 'success' });
    try {
      await transport.verify();
    } catch (error) {
      diagnostics({ stage: 'smtp_connection_established', outcome: 'failure', exceptionType: safeRegistrationExceptionType(error) });
      throw error;
    }
    diagnostics({ stage: 'smtp_connection_established', outcome: 'success' });
    diagnostics({ stage: 'smtp_greeting_received', outcome: 'success' });

    const expiry = message.expiresAt.toUTCString();
    const escapedUrl = escapeHtml(message.verificationUrl);
    const personalizedGreeting = message.firstName == null
      ? ''
      : `Hi ${escapeHtml(message.firstName)},<br><br>`;
    const textGreeting = message.firstName == null ? [] : [`Hi ${message.firstName},`, ''];

    const htmlContent = buildTransactionalEmailHtml({
      heading: 'Verify your email',
      supportingCopy: `${personalizedGreeting}Confirm this email address to finish setting up your SlotlyFlow account.`,
      ctaLabel: 'Verify email',
      ctaUrl: escapedUrl,
      secondaryCopy: [
        `This secure link expires at ${escapeHtml(expiry)}.`,
        'If you did not create a SlotlyFlow account, you can safely ignore this email.'
      ],
      decorativeVariant: 'verify-email',
    });

    diagnostics({ stage: 'send_mail_started', outcome: 'success' });
    try {
      await transport.sendMail({
        from: { address: this.config.from.address, name: this.config.from.name },
        to: message.to,
        subject: 'Verify your SlotlyFlow email address',
        text: [
          'Verify your SlotlyFlow email address',
          '',
          ...textGreeting,
          'Use this secure link to verify your email address:',
          message.verificationUrl,
          '',
          `This link expires at ${expiry}.`,
          '',
          'If you did not create a SlotlyFlow account, you can ignore this email.',
        ].join('\n'),
        html: htmlContent,
        attachments: getTransactionalEmailAttachments(),
      });
    } catch (error) {
      diagnostics({ stage: 'send_mail_completed', outcome: 'failure', exceptionType: safeRegistrationExceptionType(error) });
      throw error;
    }
    diagnostics({ stage: 'send_mail_completed', outcome: 'success' });
  }

  async sendPasswordResetEmail(message: PasswordResetEmailMessage): Promise<void> {
    const transport = this.transportFor(noRegistrationDiagnostics);
    await transport.verify();

    const expiry = message.expiresAt.toUTCString();
    const escapedUrl = escapeHtml(message.passwordResetUrl);

    const htmlContent = buildTransactionalEmailHtml({
      heading: 'Reset your password',
      supportingCopy: 'Use the secure link below to choose a new SlotlyFlow password.',
      ctaLabel: 'Reset password',
      ctaUrl: escapedUrl,
      secondaryCopy: [
        `This secure link expires at ${escapeHtml(expiry)}.`,
        'If you did not request a password reset, you can safely ignore this email.'
      ],
      decorativeVariant: 'password-reset',
    });

    await transport.sendMail({
      from: { address: this.config.from.address, name: this.config.from.name },
      to: message.to,
      subject: 'Reset your SlotlyFlow password',
      text: [
        'Reset your SlotlyFlow password',
        '',
        'Use this secure link to reset your password:',
        message.passwordResetUrl,
        '',
        `This link expires at ${expiry}.`,
        '',
        'If you did not request a password reset, you can safely ignore this email.',
      ].join('\n'),
      html: htmlContent,
      attachments: getTransactionalEmailAttachments(),
    });
  }

  async sendNotificationEmail(message: NotificationEmailMessage): Promise<{ readonly providerMessageId: string | undefined }> {
    const transport = this.transportFor(noRegistrationDiagnostics);
    await transport.verify();
    const details = message.handoverContext;
    const structuredLines = details === null || details === undefined ? [] : [
      `WhatsApp: ${details.customerWhatsAppId}`,
      ...(details.savedContact === null || details.savedContact === undefined ? [] : [`Saved contact: ${details.savedContact ? 'Yes' : 'No'}`]),
      `Request: ${details.requestType.replaceAll('_', ' ')}`,
      `Received: ${details.receivedAt}`,
      `Operating hours: ${details.receivedDuringBusinessHours === null ? 'Not configured' : details.receivedDuringBusinessHours ? 'During' : 'Outside'}`,
      ...Object.entries(details.answers).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${value}`),
    ];
    const htmlContent = details === null || details === undefined
      ? buildTransactionalEmailHtml({
        heading: 'New WhatsApp handover assigned to you',
        supportingCopy: `A customer conversation has been assigned to you for ${escapeHtml(message.businessName)}.`,
        ctaLabel: 'Open conversation',
        ctaUrl: escapeHtml(message.conversationUrl ?? ''),
        secondaryCopy: [`Customer: ${escapeHtml(message.customerDisplayName)}`],
        decorativeVariant: 'verify-email',
      })
      : `<html><body><h1>${escapeHtml(message.subject)}</h1><p>Business: ${escapeHtml(message.businessName)}<br>Customer: ${escapeHtml(message.customerDisplayName)}</p>${structuredLines.map((line) => `<p>${escapeHtml(line).replaceAll('\n', '<br>')}</p>`).join('')}</body></html>`;
    const result = await transport.sendMail({
      from: { address: this.config.from.address, name: this.config.from.name },
      to: message.to,
      subject: message.subject,
      text: [message.subject, '', `Business: ${message.businessName}`, `Customer: ${message.customerDisplayName}`, ...structuredLines,
        ...(message.conversationUrl === null ? [] : ['', 'Open conversation:', message.conversationUrl])].join('\n'),
      html: htmlContent,
      attachments: getTransactionalEmailAttachments(),
    });
    const providerMessageId = typeof result === 'object' && result !== null && 'messageId' in result && typeof result.messageId === 'string'
      ? result.messageId
      : undefined;
    return { providerMessageId };
  }

  private transportFor(diagnostics: RegistrationDiagnosticReporter): SmtpTransport {
    if (this.transport === undefined) {
      this.transport = nodemailer.createTransport({
        host: this.config.smtp.host,
        port: this.config.smtp.port,
        secure: this.config.smtp.secure,
        ...smtpTransportTimeouts,
        ...(this.config.smtp.username === undefined
          ? {}
          : { auth: { user: this.config.smtp.username, pass: this.config.smtp.password } }),
      });
    }
    diagnostics({ stage: 'nodemailer_transporter_created', outcome: 'success' });
    return this.transport;
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

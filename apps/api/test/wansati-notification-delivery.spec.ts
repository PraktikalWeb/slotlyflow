import { describe, expect, it, vi } from 'vitest';
import type { AuthenticationConfig } from '@slotlyflow/config';

import type { EmailProvider } from '../src/email/email-provider.js';
import { NotificationDeliveryService } from '../src/notifications/notification-delivery.service.js';
import type { DrizzleNotificationRepository } from '../src/notifications/notification.repository.js';
import { SmtpEmailProvider } from '../src/email/smtp-email.provider.js';

describe('trusted automation handover notification', () => {
  it('escapes customer-controlled answers in the SMTP HTML without a broken inbox link', async () => {
    const sendMail = vi.fn(async (message: unknown) => {
      void message;
      return { messageId: 'mock' };
    });
    const provider = new SmtpEmailProvider({
      provider: 'smtp', webAppUrl: 'https://example.test',
      from: { address: 'no-reply@example.test', name: 'SlotlyFlow' },
      smtp: { host: 'unused.example.test', port: 465, secure: true },
    }, { verify: vi.fn(async () => true), sendMail } as unknown as ConstructorParameters<typeof SmtpEmailProvider>[1]);

    await provider.sendNotificationEmail({
      to: 'owner@example.test', subject: 'WhatsApp handover: urgent order – Wansati Brands',
      businessName: 'Wansati Brands', customerDisplayName: 'Customer', conversationUrl: null,
      handoverContext: {
        requestType: 'urgent_order', answers: { product: '<script>alert(1)</script>' },
        receivedAt: '2026-10-05T10:00:00.000Z', receivedDuringBusinessHours: true,
        customerWhatsAppId: '27123456789',
      },
    });

    const mail = sendMail.mock.calls[0]?.[0] as { html: string; text: string } | undefined;
    expect(mail?.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(mail?.html).not.toContain('<script>');
    expect(mail?.text).not.toContain('Open conversation:');
  });

  it('sends structured context only through the existing email provider boundary', async () => {
    const sendNotificationEmail = vi.fn<EmailProvider['sendNotificationEmail']>(async () => ({ providerMessageId: 'mock-message' }));
    const delivery = {
      id: 'delivery', organizationId: 'organization', notificationId: 'notification', destination: 'owner@example.test',
      recipientUserId: null, recipientMembershipId: null, attemptCount: 1,
    };
    const markDeliverySent = vi.fn(async () => true);
    const repository = {
      claimNextDelivery: vi.fn(async () => delivery),
      revalidateDelivery: vi.fn(async () => ({
        allowed: true as const, organizationId: 'organization', destination: 'owner@example.test',
        businessName: 'Wansati Brands', customerDisplayName: 'Customer', conversationId: 'conversation',
        handoverContext: {
          requestType: 'urgent_order', answers: { product: '<red dress>', required_date: '2026-12-01' },
          receivedAt: '2026-10-05T10:00:00.000Z', receivedDuringBusinessHours: true,
          customerWhatsAppId: '27123456789', savedContact: false,
        },
      })),
      markDeliverySent,
    } as unknown as DrizzleNotificationRepository;
    const email = { sendNotificationEmail } as unknown as EmailProvider;
    const service = new NotificationDeliveryService(repository, email, {} as AuthenticationConfig);

    await service.processAvailable(1);

    expect(sendNotificationEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'owner@example.test', conversationUrl: null,
      handoverContext: expect.objectContaining({
        requestType: 'urgent_order', answers: { product: '<red dress>', required_date: '2026-12-01' },
      }),
    }));
    expect(markDeliverySent).toHaveBeenCalledOnce();
  });

  it('records an SMTP failure on the delivery row without closing or rolling back the handover', async () => {
    const delivery = {
      id: 'delivery', organizationId: 'organization', notificationId: 'notification', destination: 'owner@example.test',
      recipientUserId: null, recipientMembershipId: null, attemptCount: 1,
    };
    const closeHandover = vi.fn();
    const markDeliveryFailed = vi.fn(async () => 'FAILED' as const);
    const repository = {
      claimNextDelivery: vi.fn().mockResolvedValueOnce(delivery).mockResolvedValueOnce(undefined),
      revalidateDelivery: vi.fn(async () => ({
        allowed: true as const, organizationId: 'organization', destination: 'owner@example.test',
        businessName: 'Wansati Brands', customerDisplayName: 'Customer', conversationId: 'conversation',
        handoverContext: {
          requestType: 'urgent_order', answers: { product: 'Dress' }, receivedAt: '2026-10-05T10:00:00.000Z',
          receivedDuringBusinessHours: true, customerWhatsAppId: '27123456789',
        },
      })),
      markDeliveryFailed,
      closeHandover,
    } as unknown as DrizzleNotificationRepository;
    const sendNotificationEmail = vi.fn<EmailProvider['sendNotificationEmail']>(async () => { throw new Error('SMTP unavailable'); });
    const service = new NotificationDeliveryService(repository, { sendNotificationEmail } as EmailProvider, {} as AuthenticationConfig);

    await expect(service.processAvailable(2)).resolves.toBeUndefined();
    expect(markDeliveryFailed).toHaveBeenCalledWith(delivery, 3, expect.any(Date));
    expect(closeHandover).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import type { AuthenticationConfig } from '@slotlyflow/config';
import type { FastifyRequest } from 'fastify';

import { HandoverExpiryService } from '../src/notifications/handover-expiry.service.js';
import { handoverDeadline, validHandoverInactivityMinutes } from '../src/notifications/handover-inactivity.policy.js';
import { NotificationController } from '../src/notifications/notification.controller.js';
import { NotificationService } from '../src/notifications/notification.service.js';
import type { DrizzleNotificationRepository } from '../src/notifications/notification.repository.js';
import type { TrustedOrganizationContext } from '../src/organizations/organization.types.js';
import { InboundWhatsAppMessageService } from '../src/whatsapp/inbound-whatsapp-message.service.js';
import type { InboundWhatsAppMessageRepository } from '../src/whatsapp/inbound-whatsapp-message.repository.js';
import type { OutboundWhatsAppMessageRepository } from '../src/whatsapp/outbound-whatsapp-message.repository.js';
import type { WhatsAppConnectionTestService } from '../src/whatsapp/whatsapp-connection-test.service.js';
import type { ContactService } from '../src/contacts/contact.service.js';
import type { BotDeploymentResolver } from '../src/bots/bot-deployment-resolver.service.js';
import type { BuiltInBotRuntime } from '../src/bots/built-in-bot-runtime.service.js';
import type { AuthService } from '../src/auth/auth.service.js';
import type { CsrfService } from '../src/auth/csrf.service.js';
import type { OrganizationContextService } from '../src/organizations/organization-context.service.js';

const organizationId = '00000000-0000-4000-8000-000000000001';
const handoverId = '00000000-0000-4000-8000-000000000003';
const conversationId = '00000000-0000-4000-8000-000000000004';
const context: TrustedOrganizationContext = {
  userId: '00000000-0000-4000-8000-000000000005', organizationId,
  membershipId: '00000000-0000-4000-8000-000000000006', role: 'AGENT', status: 'active',
  organization: { id: organizationId, name: 'Business A', slug: 'business-a' },
};

describe('generic handover lifecycle boundaries', () => {
  it('computes the configured deadline and never assigns one when auto-close is disabled', () => {
    const activity = new Date('2026-10-02T12:00:00.000Z');
    expect(handoverDeadline(activity, { handoverAutoCloseEnabled: true, handoverInactivityMinutes: 30 }))
      .toEqual(new Date('2026-10-02T12:30:00.000Z'));
    expect(handoverDeadline(activity, { handoverAutoCloseEnabled: false, handoverInactivityMinutes: 30 })).toBeNull();
    expect(validHandoverInactivityMinutes(15)).toBe(true);
    expect(validHandoverInactivityMinutes(43_200)).toBe(true);
    expect(validHandoverInactivityMinutes(43_201)).toBe(false);
  });
  it('validates per-Business timeout bounds and disabled configuration without changing the requested values', async () => {
    const save = vi.fn(async (_organizationId: string, settings: { handoverAutoCloseEnabled: boolean; handoverInactivityMinutes: number }) => settings);
    const service = new NotificationService({ saveHandoverInactivitySettings: save } as unknown as DrizzleNotificationRepository);
    for (const minutes of [0, -1, 43_201, 1.5, Number.NaN]) {
      await expect(service.updateHandoverInactivitySettings(context, { handoverAutoCloseEnabled: true, handoverInactivityMinutes: minutes })).rejects.toThrow();
    }
    await expect(service.updateHandoverInactivitySettings(context, { handoverAutoCloseEnabled: false, handoverInactivityMinutes: 15 }))
      .resolves.toEqual({ handoverAutoCloseEnabled: false, handoverInactivityMinutes: 15 });
    expect(save).toHaveBeenCalledWith(organizationId, { handoverAutoCloseEnabled: false, handoverInactivityMinutes: 15 });
  });

  it('uses only the trusted membership Organization and records the manual reason', async () => {
    const close = vi.fn(async () => 'closed' as const);
    const service = new NotificationService({ closeHandover: close } as unknown as DrizzleNotificationRepository);
    await expect(service.resolveHandover(context, handoverId)).resolves.toBe('closed');
    expect(close).toHaveBeenCalledWith(expect.objectContaining({
      organizationId, handoverId, reason: 'manual', actorUserId: context.userId,
    }));
  });

  it('does not disclose an invalid or foreign handover and treats repeated closure as idempotent', async () => {
    const close = vi.fn().mockResolvedValueOnce('not_found').mockResolvedValueOnce('already_closed');
    const service = new NotificationService({ closeHandover: close } as unknown as DrizzleNotificationRepository);
    await expect(service.resolveHandover(context, handoverId)).rejects.toMatchObject({ status: 404 });
    await expect(service.resolveHandover(context, handoverId)).resolves.toBe('already_closed');
    await expect(service.resolveHandover(context, 'not-a-uuid')).rejects.toMatchObject({ status: 404 });
    expect(close).toHaveBeenCalledTimes(2);
  });

  it('sweeps only a bounded due batch and delegates every close to the shared lifecycle path', async () => {
    const due = vi.fn().mockResolvedValue([{ id: handoverId, organizationId }]);
    const close = vi.fn().mockResolvedValue('closed');
    const expiry = new HandoverExpiryService({ dueHandovers: due, closeExpiredHandover: close } as unknown as NotificationService);
    const now = new Date('2026-10-02T12:00:00.000Z');
    await expect(expiry.processDue(now)).resolves.toEqual({ due: 1, closed: 1 });
    expect(due).toHaveBeenCalledWith(now, 100);
    expect(close).toHaveBeenCalledWith({ organizationId, handoverId }, expect.any(Date));
  });

  it('does not invoke automation for a persisted customer message while a handover is active', async () => {
    const resolve = vi.fn();
    const runtime = vi.fn();
    const inbound = new InboundWhatsAppMessageService(
      { persistVerifiedInboundMessage: vi.fn().mockResolvedValue({
        outcome: 'stored', organizationId, connectionId: handoverId, conversationId,
        inboundMessageId: handoverId, customerWhatsAppId: '27123456789', handoverActive: true,
      }) } as unknown as InboundWhatsAppMessageRepository,
      {} as OutboundWhatsAppMessageRepository,
      { interceptInbound: vi.fn().mockResolvedValue(false) } as unknown as WhatsAppConnectionTestService,
      { ingestInboundSender: vi.fn().mockResolvedValue(undefined) } as unknown as ContactService,
      { resolveActiveBotForInbound: resolve } as unknown as BotDeploymentResolver,
      { execute: runtime } as unknown as BuiltInBotRuntime,
    );
    await inbound.persistAll([{ provider: 'META', providerMessageId: 'wamid.test', destinationPhoneNumberId: 'phone',
      customerWhatsAppId: '27123456789', customerDisplayName: null, occurredAt: new Date(), messageType: 'TEXT',
      textBody: 'Hello', interactiveOptionId: null }]);
    expect(resolve).not.toHaveBeenCalled();
    expect(runtime).not.toHaveBeenCalled();
  });

  it('allows the next persisted inbound message to reach the trusted runtime after closure', async () => {
    const runtime = vi.fn().mockResolvedValue('EXECUTED');
    const inbound = new InboundWhatsAppMessageService(
      { persistVerifiedInboundMessage: vi.fn().mockResolvedValue({
        outcome: 'stored', organizationId, connectionId: handoverId, conversationId,
        inboundMessageId: handoverId, customerWhatsAppId: '27123456789', handoverActive: false,
      }) } as unknown as InboundWhatsAppMessageRepository,
      {} as OutboundWhatsAppMessageRepository,
      { interceptInbound: vi.fn().mockResolvedValue(false) } as unknown as WhatsAppConnectionTestService,
      { ingestInboundSender: vi.fn().mockResolvedValue(undefined) } as unknown as ContactService,
      { resolveActiveBotForInbound: vi.fn().mockResolvedValue({
        deploymentId: handoverId, botVersionId: handoverId, implementationKey: 'HANDOVER_TEST_V1', isPublished: true,
      }) } as unknown as BotDeploymentResolver,
      { execute: runtime } as unknown as BuiltInBotRuntime,
    );
    await inbound.persistAll([{ provider: 'META', providerMessageId: 'wamid.after-close', destinationPhoneNumberId: 'phone',
      customerWhatsAppId: '27123456789', customerDisplayName: null, occurredAt: new Date(), messageType: 'TEXT',
      textBody: 'Hello again', interactiveOptionId: null }]);
    expect(runtime).toHaveBeenCalledTimes(1);
  });

  it('routes Business App echoes only to persistence, never to the Bot, Connection Test, or Contacts', async () => {
    const persist = vi.fn().mockResolvedValue({ outcome: 'stored', organizationId, connectionId: handoverId,
      conversationId, handoverActive: true });
    const intercept = vi.fn();
    const contact = vi.fn();
    const resolve = vi.fn();
    const runtime = vi.fn();
    const service = new InboundWhatsAppMessageService(
      { persistVerifiedHumanBusinessAppMessage: persist } as unknown as InboundWhatsAppMessageRepository,
      {} as OutboundWhatsAppMessageRepository,
      { interceptInbound: intercept } as unknown as WhatsAppConnectionTestService,
      { ingestInboundSender: contact } as unknown as ContactService,
      { resolveActiveBotForInbound: resolve } as unknown as BotDeploymentResolver,
      { execute: runtime } as unknown as BuiltInBotRuntime,
    );
    const echo = { provider: 'META' as const, providerMessageId: 'wamid.human', wabaId: 'waba',
      destinationPhoneNumberId: 'phone', customerWhatsAppId: '27123456789',
      occurredAt: new Date('2026-10-02T12:00:00.000Z'), messageType: 'TEXT' as const, textBody: 'Human reply' };
    expect(await service.persistAllHumanBusinessAppMessages([echo])).toEqual({
      stored: 1, duplicates: 0, unknownConnections: 0, unknownConversations: 0, activeHandovers: 1,
    });
    expect(persist).toHaveBeenCalledWith(echo);
    expect(intercept).not.toHaveBeenCalled();
    expect(contact).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
    expect(runtime).not.toHaveBeenCalled();
  });

  it('requires CSRF and the existing handoff.complete membership permission before manual resolution', async () => {
    const assert = vi.fn();
    const resolveForPermission = vi.fn().mockResolvedValue(context);
    const resolveHandover = vi.fn().mockResolvedValue('closed');
    const controller = new NotificationController(
      { current: vi.fn().mockResolvedValue({ id: context.userId }) } as unknown as AuthService,
      { session: { cookieName: 'session' } } as AuthenticationConfig,
      { assert } as unknown as CsrfService,
      { resolveForPermission } as unknown as OrganizationContextService,
      { resolveHandover } as unknown as NotificationService,
    );
    const request = { cookies: { session: 'opaque-session' } } as FastifyRequest;
    await expect(controller.resolveHandover(organizationId, handoverId, request)).resolves.toEqual({ outcome: 'closed' });
    expect(assert).toHaveBeenCalledWith(request);
    expect(resolveForPermission).toHaveBeenCalledWith(context.userId, organizationId, 'handoff.complete');
    expect(resolveHandover).toHaveBeenCalledWith(context, handoverId);
    resolveForPermission.mockRejectedValueOnce(new NotFoundException({ code: 'ORGANIZATION_ACCESS_NOT_FOUND' }));
    await expect(controller.resolveHandover(organizationId, handoverId, request)).rejects.toMatchObject({ status: 404 });
    expect(resolveHandover).toHaveBeenCalledTimes(1);
  });
});

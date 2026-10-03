import { describe, expect, it, vi } from 'vitest';

import { WansatiBrandsBot } from '../src/bots/wansati-brands-bot.js';
import { BuiltInBotRuntime } from '../src/bots/built-in-bot-runtime.service.js';
import { BotPreviewService } from '../src/bots/bot-preview.service.js';
import { BotPreviewSessionStore } from '../src/bots/bot-preview-session.store.js';
import type { BotDeploymentResolver } from '../src/bots/bot-deployment-resolver.service.js';
import type { WhatsAppConnectionRepository } from '../src/whatsapp/whatsapp-connection.repository.js';
import type { InboundWhatsAppMessageRepository } from '../src/whatsapp/inbound-whatsapp-message.repository.js';
import type { NotificationService } from '../src/notifications/notification.service.js';
import type { OutboundWhatsAppMessageService } from '../src/whatsapp/outbound-whatsapp-message.service.js';
import type { BotConversationStateRepository } from '../src/bots/bot-conversation-state.repository.js';
import type { OrganizationRepository } from '../src/organizations/organization.repository.js';
import type { TrustedInboundBotRuntimeContext, WansatiBotCapabilities, WansatiBotState } from '../src/bots/built-in-bot-runtime.types.js';
import { decideWansatiTransition } from '../src/bots/wansati-brands-flow.js';
import { evaluateOrganizationBusinessHours } from '../src/organizations/business-hours.js';
import type { OrganizationSettings } from '../src/organizations/organization.types.js';
import type { TrustedOrganizationContext } from '../src/organizations/organization.types.js';

const organizationId = '00000000-0000-4000-8000-000000000001';
const connectionId = '00000000-0000-4000-8000-000000000002';
const settings: OrganizationSettings = {
  id: organizationId, name: 'Wansati Brands', slug: 'wansati', businessEmail: null, contactNumber: null,
  website: 'https://www.wansatibrands.co.za/', timezone: 'Africa/Johannesburg',
  businessHours: [
    { day: 'MONDAY', enabled: true, opensAt: '09:00', closesAt: '17:00' },
    { day: 'TUESDAY', enabled: false, opensAt: null, closesAt: null },
    { day: 'WEDNESDAY', enabled: false, opensAt: null, closesAt: null },
    { day: 'THURSDAY', enabled: false, opensAt: null, closesAt: null },
    { day: 'FRIDAY', enabled: false, opensAt: null, closesAt: null },
    { day: 'SATURDAY', enabled: false, opensAt: null, closesAt: null },
    { day: 'SUNDAY', enabled: false, opensAt: null, closesAt: null },
  ],
};

function runtimeContext(text: string, receivedAt = new Date('2026-10-05T10:00:00.000Z')): TrustedInboundBotRuntimeContext {
  return {
    organizationId, whatsappConnectionId: connectionId,
    conversationId: '00000000-0000-4000-8000-000000000003',
    inboundMessageId: '00000000-0000-4000-8000-000000000004',
    providerMessageId: 'wamid.fixture', receivedAt, customerWhatsAppId: '27123456789',
    messageType: 'TEXT', input: { type: 'text', text },
    deployment: {
      deploymentId: '00000000-0000-4000-8000-000000000005',
      organizationId, whatsappConnectionId: connectionId,
      botDefinitionId: '00000000-0000-4000-8000-000000000006',
      botVersionId: '00000000-0000-4000-8000-000000000007',
      implementationKey: 'WANSATI_BRANDS_V1', configuration: null, isPublished: true,
    },
  };
}

function harness(initial: WansatiBotState, currentSettings: OrganizationSettings = settings) {
  let state = initial;
  let humanOwned = false;
  const reply = vi.fn<WansatiBotCapabilities['reply']>(async () => {});
  const establishHandover = vi.fn<WansatiBotCapabilities['establishHandover']>(async () => {
    humanOwned = true;
    return { created: true, assignmentId: '00000000-0000-4000-8000-000000000008' };
  });
  const capabilities: WansatiBotCapabilities = {
    hasHandover: async () => humanOwned,
    establishHandover,
    transition: async (context, decide) => {
      const decision = decide(state);
      state = decision.stateAfter;
      expect(context.organizationId).toBe(organizationId);
      return decision;
    },
    getSettings: async (context) => context.organizationId === currentSettings.id ? currentSettings : undefined,
    reply,
  };
  return { bot: new WansatiBrandsBot(capabilities), reply, establishHandover, state: () => state };
}

describe('Wansati Brands trusted handler', () => {
  it('evaluates configured timezone and preserves exact explanation in handover metadata', async () => {
    const test = harness({ node: 'COLLECT:existing_matter:0', answers: {} });
    const context = runtimeContext('  Help with my order  ');
    expect(await test.bot.execute(context)).toBe('EXECUTED');
    expect(test.establishHandover).toHaveBeenCalledWith(context, expect.objectContaining({
      requestType: 'existing_matter', receivedDuringBusinessHours: true,
      answers: { explanation: '  Help with my order  ' }, customerWhatsAppId: context.customerWhatsAppId,
    }));
    expect(test.reply).toHaveBeenCalledWith(context, expect.objectContaining({ text: expect.stringContaining('continue assisting you here shortly') }), expect.any(String));
    expect(await test.bot.execute(context)).toBe('SKIPPED_HUMAN_HANDOVER');
    expect(test.establishHandover).toHaveBeenCalledTimes(1);
  });

  it('reports after-hours configured schedule and creates the same pending handover', async () => {
    const test = harness({ node: 'COLLECT:order_tracking:0', answers: {} });
    const context = runtimeContext('ORDER-9', new Date('2026-10-05T18:00:00.000Z'));
    expect(await test.bot.execute(context)).toBe('EXECUTED');
    expect(test.establishHandover).toHaveBeenCalledWith(context, expect.objectContaining({ receivedDuringBusinessHours: false }));
    expect(test.reply).toHaveBeenCalledWith(context, expect.objectContaining({ text: expect.stringContaining('Monday 09:00–17:00 (Africa/Johannesburg)') }), expect.any(String));
  });

  it.each([
    ['urgent_order', 'COLLECT:urgent_order:3', { product: 'Dress', size: 'M', delivery_location: 'Johannesburg' }, '2026-12-01'],
    ['sales_assistance', 'COLLECT:sales_assistance:0', {}, 'Please help me choose'],
    ['damaged_or_incorrect_item', 'COLLECT:damaged_or_incorrect_item:1', { order_number: 'ORDER-42' }, 'Wrong colour'],
  ] as const)('delegates %s with exact collected answers and no Bot-owned inactivity policy', async (requestType, node, answers, finalAnswer) => {
    const test = harness({ node, answers });
    const context = runtimeContext(finalAnswer);
    expect(await test.bot.execute(context)).toBe('EXECUTED');
    expect(test.establishHandover).toHaveBeenCalledOnce();
    expect(test.establishHandover).toHaveBeenCalledWith(context, {
      requestType,
      answers: { ...answers, ...(requestType === 'urgent_order' ? { required_date: finalAnswer }
        : requestType === 'damaged_or_incorrect_item' ? { description: finalAnswer } : { explanation: finalAnswer }) },
      receivedAt: context.receivedAt.toISOString(),
      receivedDuringBusinessHours: true,
      customerWhatsAppId: context.customerWhatsAppId,
    });
    const details = test.establishHandover.mock.calls[0]?.[1];
    expect(details).not.toHaveProperty('autoCloseAt');
    expect(details).not.toHaveProperty('handoverInactivityMinutes');
    expect(details).not.toHaveProperty('handoverAutoCloseEnabled');
  });

  it('does not advance collection while generic handover ownership is active, then starts fresh after state removal', async () => {
    const test = harness({ node: 'COLLECT:existing_matter:0', answers: {} });
    const context = runtimeContext('My earlier order');
    expect(await test.bot.execute(context)).toBe('EXECUTED');
    const collected = test.state();
    expect(collected).toEqual({ node: 'HANDOVER:existing_matter', answers: { explanation: 'My earlier order' } });
    expect(await test.bot.execute(runtimeContext('A further customer message'))).toBe('SKIPPED_HUMAN_HANDOVER');
    expect(test.state()).toEqual(collected);
    expect(test.establishHandover).toHaveBeenCalledOnce();

    // Generic closure deletes the persisted Bot state. Its next load begins at INITIAL.
    const restarted = harness({ node: 'INITIAL', answers: {} });
    expect(await restarted.bot.execute(runtimeContext('A new message'))).toBe('EXECUTED');
    expect(restarted.state()).toEqual({ node: 'ENTRY', answers: {} });
    expect(restarted.reply).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      body: expect.stringContaining('Welcome to Wansati Brands 🛍️'),
    }), expect.any(String));
    expect(restarted.establishHandover).not.toHaveBeenCalled();
  });

  it('previews a Wansati handover without production persistence or provider capabilities', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T10:00:00.000Z'));
    try {
      const deployment = runtimeContext('Hi').deployment;
      const preview = new BotPreviewService(
        { findForOrganization: vi.fn(async () => ({ id: connectionId, connectionStatus: 'CONNECTED' })) } as unknown as WhatsAppConnectionRepository,
        { resolveActiveBotForInbound: vi.fn(async () => deployment) } as unknown as BotDeploymentResolver,
        new BotPreviewSessionStore(),
        { findSettingsForOrganization: vi.fn(async () => settings) } as unknown as OrganizationRepository,
      );
      const organization: TrustedOrganizationContext = {
        organizationId, userId: '00000000-0000-4000-8000-000000000009',
        membershipId: '00000000-0000-4000-8000-000000000010', role: 'AGENT', status: 'active',
        organization: { id: organizationId, name: 'Wansati Brands', slug: 'wansati' },
      };
      const welcome = await preview.execute(organization, { previewSessionId: null, input: { type: 'text', text: 'Hi' } });
      expect(welcome.messages[0]).toMatchObject({ body: expect.stringContaining('Welcome to Wansati Brands 🛍️') });
      const collection = await preview.execute(organization, { previewSessionId: welcome.previewSessionId, input: { type: 'text', text: '1' } });
      expect(collection.messages[0]).toMatchObject({ text: expect.stringContaining('Please briefly tell us') });
      const handover = await preview.execute(organization, { previewSessionId: welcome.previewSessionId, input: { type: 'text', text: 'My order needs help' } });
      expect(handover.handover).toBe(true);
      expect(handover.messages[0]).toMatchObject({ text: expect.stringContaining('representative will continue assisting') });
      expect(await preview.execute(organization, { previewSessionId: welcome.previewSessionId, input: { type: 'text', text: 'Still here' } }))
        .toMatchObject({ handover: true, messages: [] });
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails closed when the trusted organisation settings do not match', async () => {
    const test = harness({ node: 'INITIAL', answers: {} }, { ...settings, id: '00000000-0000-4000-8000-000000000099' });
    expect(await test.bot.execute(runtimeContext('Hi'))).toBe('FAILED');
    expect(test.reply).not.toHaveBeenCalled();
  });

  it('keeps preview-style effects injectable without any Meta or SMTP calls', async () => {
    const test = harness({ node: 'MAIN', answers: {} });
    expect(await test.bot.execute(runtimeContext('3'))).toBe('EXECUTED');
    expect(test.state().node).toBe('PAYMENTS');
    expect(test.establishHandover).not.toHaveBeenCalled();
  });

  it('does not classify all-disabled hours as operating hours', () => {
    const disabled = { ...settings, businessHours: settings.businessHours.map((day) => ({ ...day, enabled: false, opensAt: null, closesAt: null })) };
    expect(evaluateOrganizationBusinessHours(disabled, new Date('2026-10-05T10:00:00.000Z'))).toBeNull();
    expect(decideWansatiTransition({ node: 'MAIN', answers: {} }, { type: 'text', text: 'urgent order' }, { website: null, sizeGuideUrl: null }).stateAfter.node).toBe('MAIN');
  });

  it('refuses a deployment whose tenant or connection differs before any bot effects', async () => {
    const hasConversationForTrustedConnection = vi.fn(async () => true);
    const sendTrustedAutomationMessage = vi.fn(async () => {});
    const runtime = new BuiltInBotRuntime(
      { hasConversationForTrustedConnection } as unknown as InboundWhatsAppMessageRepository,
      {} as NotificationService,
      { sendTrustedAutomationMessage } as unknown as OutboundWhatsAppMessageService,
      {} as BotConversationStateRepository,
      {} as OrganizationRepository,
    );
    const valid = runtimeContext('Hello');
    expect(await runtime.execute({ ...valid, deployment: { ...valid.deployment, organizationId: 'other-tenant' } })).toBe('FAILED');
    expect(await runtime.execute({ ...valid, deployment: { ...valid.deployment, whatsappConnectionId: 'other-connection' } })).toBe('FAILED');
    expect(hasConversationForTrustedConnection).not.toHaveBeenCalled();
    expect(sendTrustedAutomationMessage).not.toHaveBeenCalled();
  });
});

import { randomUUID } from 'node:crypto';

import { loadDatabaseConfig } from '@slotlyflow/config';
import {
  auditLogs, botConversationStates, botDefinitions, botDeployments, botVersions, conversations,
  createDatabaseConnection, handoverAssignments, messages, organizationNotificationSettings,
  organizations, whatsappConnections,
} from '@slotlyflow/database';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { DrizzleNotificationRepository } from '../src/notifications/notification.repository.js';
import { DrizzleInboundWhatsAppMessageRepository } from '../src/whatsapp/inbound-whatsapp-message.repository.js';
import { DrizzleBotConversationStateRepository } from '../src/bots/bot-conversation-state.repository.js';
import { decideWansatiTransition } from '../src/bots/wansati-brands-flow.js';

const databaseUrl = process.env.DATABASE_URL;
const databaseName = databaseUrl === undefined ? '' : new URL(databaseUrl).pathname.replace(/^\//, '');
const describeDatabase = databaseUrl !== undefined && databaseName.endsWith('_test') ? describe : describe.skip;

describeDatabase('PostgreSQL handover inactivity and tenant isolation', () => {
  let database: ReturnType<typeof createDatabaseConnection>;
  let repository: DrizzleNotificationRepository;
  let inbound: DrizzleInboundWhatsAppMessageRepository;
  const organizationIds = new Set<string>();
  const definitionIds = new Set<string>();

  beforeAll(() => {
    database = createDatabaseConnection(loadDatabaseConfig());
    repository = new DrizzleNotificationRepository(database.db);
    inbound = new DrizzleInboundWhatsAppMessageRepository(database.db, repository);
  });

  afterEach(async () => {
    const ids = [...organizationIds];
    organizationIds.clear();
    if (ids.length > 0) {
      await database.db.delete(auditLogs).where(inArray(auditLogs.organizationId, ids));
      await database.db.delete(botConversationStates).where(inArray(botConversationStates.organizationId, ids));
      await database.db.delete(botDeployments).where(inArray(botDeployments.organizationId, ids));
      await database.db.delete(messages).where(inArray(messages.organizationId, ids));
      await database.db.delete(handoverAssignments).where(inArray(handoverAssignments.organizationId, ids));
      await database.db.delete(organizationNotificationSettings).where(inArray(organizationNotificationSettings.organizationId, ids));
      await database.db.delete(conversations).where(inArray(conversations.organizationId, ids));
      await database.db.delete(whatsappConnections).where(inArray(whatsappConnections.organizationId, ids));
      await database.db.delete(organizations).where(inArray(organizations.id, ids));
    }
    const definitions = [...definitionIds];
    definitionIds.clear();
    if (definitions.length > 0) {
      await database.db.delete(botVersions).where(inArray(botVersions.botDefinitionId, definitions));
      await database.db.delete(botDefinitions).where(inArray(botDefinitions.id, definitions));
    }
  });

  afterAll(async () => { await database?.close(); });

  async function business() {
    const [organization] = await database.db.insert(organizations).values({ name: 'Handover test Business', slug: `handover-${randomUUID()}` }).returning();
    if (organization === undefined) throw new Error('Test Organization was not created.');
    organizationIds.add(organization.id);
    const wabaId = `waba-${randomUUID()}`;
    const [connection] = await database.db.insert(whatsappConnections).values({
      organizationId: organization.id, provider: 'META', connectionSource: 'EXISTING_BUSINESS_APP', connectionStatus: 'CONNECTED',
      externalWabaId: wabaId, externalPhoneNumberId: `phone-${randomUUID()}`, credentialReference: `credential-${randomUUID()}`,
    }).returning();
    if (connection === undefined) throw new Error('Test connection was not created.');
    const [conversation] = await database.db.insert(conversations).values({
      organizationId: organization.id, whatsappConnectionId: connection.id, customerWhatsAppId: '27123456789',
      lastMessageAt: new Date(),
    }).returning();
    if (conversation === undefined) throw new Error('Test conversation was not created.');
    return { organizationId: organization.id, connectionId: connection.id, wabaId,
      phoneNumberId: connection.externalPhoneNumberId ?? '', conversationId: conversation.id };
  }

  function humanEcho(target: Awaited<ReturnType<typeof business>>, occurredAt: Date, providerMessageId = `wamid.${randomUUID()}`) {
    return { provider: 'META' as const, providerMessageId, wabaId: target.wabaId,
      destinationPhoneNumberId: target.phoneNumberId, customerWhatsAppId: '27123456789',
      occurredAt, messageType: 'TEXT' as const, textBody: 'Human reply' };
  }

  async function activeHandover(
    target: Awaited<ReturnType<typeof business>>,
    autoCloseAt: Date | null,
    context: (typeof handoverAssignments.$inferInsert)['context'] = null,
  ) {
    const [row] = await database.db.insert(handoverAssignments).values({
      organizationId: target.organizationId, conversationId: target.conversationId, status: 'WAITING',
      lastActivityAt: new Date('2026-10-01T12:00:00.000Z'), autoCloseAt, context,
    }).returning();
    if (row === undefined) throw new Error('Test handover was not created.');
    return row;
  }

  async function attachBotState(
    target: Awaited<ReturnType<typeof business>>,
    implementationKey: 'HANDOVER_TEST_V1' | 'WANSATI_BRANDS_V1' = 'HANDOVER_TEST_V1',
    state = 'HANDOVER',
    data: Record<string, string> = { size: 'S' },
  ) {
    const [definition] = await database.db.insert(botDefinitions).values({ definitionKey: `TEST_${randomUUID()}`, name: 'Test bot' }).returning();
    if (definition === undefined) throw new Error('Test Bot Definition was not created.');
    definitionIds.add(definition.id);
    const [version] = await database.db.insert(botVersions).values({ botDefinitionId: definition.id, version: '1', implementationKey, publishedAt: new Date() }).returning();
    if (version === undefined) throw new Error('Test Bot Version was not created.');
    const [deployment] = await database.db.insert(botDeployments).values({ organizationId: target.organizationId, whatsappConnectionId: target.connectionId, botVersionId: version.id, status: 'ACTIVE', activatedAt: new Date() }).returning();
    if (deployment === undefined) throw new Error('Test deployment was not created.');
    await database.db.insert(botConversationStates).values({
      organizationId: target.organizationId, whatsappConnectionId: target.connectionId, conversationId: target.conversationId,
      botDeploymentId: deployment.id, botVersionId: version.id, state, data,
    });
    return { definition, version, deployment };
  }

  it('uses the enabled 24-hour default, a configured duration, and null deadlines when disabled', async () => {
    const target = await business();
    expect(await repository.handoverInactivitySettings(target.organizationId)).toEqual({ handoverAutoCloseEnabled: true, handoverInactivityMinutes: 1440 });
    await repository.saveHandoverInactivitySettings(target.organizationId, { handoverAutoCloseEnabled: true, handoverInactivityMinutes: 30 });
    const publication = await repository.publishHandoverForConversation(target.organizationId, target.conversationId, null);
    expect(publication?.created).toBe(true);
    const [first] = await database.db.select().from(handoverAssignments).where(eq(handoverAssignments.organizationId, target.organizationId));
    expect(first?.autoCloseAt?.getTime()).toBe((first?.lastActivityAt.getTime() ?? 0) + 30 * 60_000);
    await repository.saveHandoverInactivitySettings(target.organizationId, { handoverAutoCloseEnabled: false, handoverInactivityMinutes: 30 });
    const [disabled] = await database.db.select().from(handoverAssignments).where(eq(handoverAssignments.organizationId, target.organizationId));
    expect(disabled?.autoCloseAt).toBeNull();
    expect(await repository.listDueHandovers(new Date('2100-01-01T00:00:00.000Z'), 100)).not.toContainEqual({ id: first?.id, organizationId: target.organizationId });
  });

  it('atomically extends an active deadline for a new customer message and suppresses automation', async () => {
    const target = await business();
    await repository.saveHandoverInactivitySettings(target.organizationId, { handoverAutoCloseEnabled: true, handoverInactivityMinutes: 15 });
    const handover = await activeHandover(target, new Date('2026-10-01T12:15:00.000Z'));
    const result = await inbound.persistVerifiedInboundMessage({
      provider: 'META', providerMessageId: `wamid.${randomUUID()}`, destinationPhoneNumberId: target.phoneNumberId,
      customerWhatsAppId: '27123456789', customerDisplayName: null, occurredAt: new Date('2026-10-01T12:10:00.000Z'),
      messageType: 'TEXT', textBody: 'Still here', interactiveOptionId: null,
    });
    expect(result.outcome).toBe('stored');
    if (result.outcome !== 'stored') throw new Error('Expected persisted message.');
    expect(result.handoverActive).toBe(true);
    const [updated] = await database.db.select().from(handoverAssignments).where(eq(handoverAssignments.id, handover.id));
    expect(updated?.autoCloseAt?.getTime()).toBe((updated?.lastActivityAt.getTime() ?? 0) + 15 * 60_000);
    expect(await repository.hasHandoverForConversation(target.organizationId, target.conversationId)).toBe(true);
  });

  it('closes only due active rows, preserves context, resets live state, and permits a fresh handover', async () => {
    const target = await business();
    const handover = await activeHandover(target, new Date('2026-10-01T12:15:00.000Z'), {
      requestType: 'test', answers: { size: 'S' }, receivedAt: '2026-10-01T12:00:00.000Z',
      receivedDuringBusinessHours: null, customerWhatsAppId: '27123456789',
    });
    await attachBotState(target);
    expect(await repository.listDueHandovers(new Date('2026-10-01T12:14:00.000Z'), 100)).not.toContainEqual({ id: handover.id, organizationId: target.organizationId });
    expect(await repository.closeHandover({ organizationId: target.organizationId, handoverId: handover.id, reason: 'inactivity_timeout', actorUserId: null, now: new Date('2026-10-01T12:14:00.000Z') })).toBe('not_due');
    expect(await repository.closeHandover({ organizationId: target.organizationId, handoverId: handover.id, reason: 'inactivity_timeout', actorUserId: null, now: new Date('2026-10-01T12:16:00.000Z') })).toBe('closed');
    expect(await repository.closeHandover({ organizationId: target.organizationId, handoverId: handover.id, reason: 'inactivity_timeout', actorUserId: null, now: new Date('2026-10-01T12:16:00.000Z') })).toBe('already_closed');
    const [closed] = await database.db.select().from(handoverAssignments).where(eq(handoverAssignments.id, handover.id));
    expect(closed).toMatchObject({ status: 'CLOSED', closedReason: 'inactivity_timeout', context: { requestType: 'test', answers: { size: 'S' } } });
    expect(closed?.closedAt).not.toBeNull();
    expect(await database.db.select().from(botConversationStates).where(eq(botConversationStates.organizationId, target.organizationId))).toHaveLength(0);
    expect(await repository.hasHandoverForConversation(target.organizationId, target.conversationId)).toBe(false);
    const next = await repository.publishHandoverForConversation(target.organizationId, target.conversationId, null);
    expect(next?.created).toBe(true);
    expect(next?.assignment.id).not.toBe(handover.id);
  });

  it('keeps a foreign Business handover and Bot state untouched by a guessed ID', async () => {
    const first = await business();
    const second = await business();
    const foreign = await activeHandover(second, new Date('2026-10-01T12:15:00.000Z'));
    await attachBotState(second);
    expect(await repository.closeHandover({ organizationId: first.organizationId, handoverId: foreign.id, reason: 'manual', actorUserId: null, now: new Date() })).toBe('not_found');
    const [unchanged] = await database.db.select().from(handoverAssignments).where(and(
      eq(handoverAssignments.organizationId, second.organizationId), eq(handoverAssignments.id, foreign.id),
    ));
    expect(unchanged?.status).toBe('WAITING');
    expect(unchanged?.closedAt).toBeNull();
    expect(await repository.hasHandoverForConversation(second.organizationId, second.conversationId)).toBe(true);
    expect(await database.db.select().from(botConversationStates).where(eq(botConversationStates.organizationId, second.organizationId))).toHaveLength(1);
  });

  it('records manual resolution and leaves historical handover metadata intact', async () => {
    const target = await business();
    const handover = await activeHandover(target, null, {
      requestType: 'general_enquiry', answers: { question: 'Fixture' }, receivedAt: '2026-10-01T12:00:00.000Z',
      receivedDuringBusinessHours: true, customerWhatsAppId: '27123456789',
    });
    await attachBotState(target);
    const now = new Date('2026-10-02T12:00:00.000Z');
    expect(await repository.closeHandover({ organizationId: target.organizationId, handoverId: handover.id, reason: 'manual', actorUserId: null, now })).toBe('closed');
    const [closed] = await database.db.select().from(handoverAssignments).where(eq(handoverAssignments.id, handover.id));
    expect(closed).toMatchObject({ status: 'CLOSED', closedReason: 'manual', closedAt: now, context: handover.context });
    expect(await database.db.select().from(botConversationStates).where(eq(botConversationStates.organizationId, target.organizationId))).toHaveLength(0);
    expect(await database.db.select().from(conversations).where(eq(conversations.id, target.conversationId))).toHaveLength(1);
  });

  it('deletes Wansati collection state on generic closure so the next transition starts at Welcome', async () => {
    const target = await business();
    await repository.saveHandoverInactivitySettings(target.organizationId, {
      handoverAutoCloseEnabled: true, handoverInactivityMinutes: 30,
    });
    const handover = await activeHandover(target, new Date('2026-10-01T12:30:00.000Z'));
    const bot = await attachBotState(target, 'WANSATI_BRANDS_V1', 'HANDOVER:urgent_order', {
      product: 'Dress', size: 'M', delivery_location: 'Johannesburg', required_date: '2026-12-01',
    });
    const humanReplyAt = new Date('2026-10-01T13:00:00.000Z');
    expect(await inbound.persistVerifiedHumanBusinessAppMessage(humanEcho(target, humanReplyAt)))
      .toMatchObject({ outcome: 'stored', handoverActive: true });
    const [active] = await database.db.select().from(handoverAssignments).where(eq(handoverAssignments.id, handover.id));
    expect(active).toMatchObject({ lastActivityAt: humanReplyAt, lastHumanActivityAt: humanReplyAt,
      autoCloseAt: new Date('2026-10-01T13:30:00.000Z') });
    expect(await repository.closeHandover({ organizationId: target.organizationId, handoverId: handover.id,
      reason: 'manual', actorUserId: null, now: new Date() })).toBe('closed');
    expect(await database.db.select().from(botConversationStates).where(eq(botConversationStates.organizationId, target.organizationId)))
      .toHaveLength(0);

    const states = new DrizzleBotConversationStateRepository(database.db);
    const decision = await states.transitionWansati({
      organizationId: target.organizationId, whatsappConnectionId: target.connectionId,
      conversationId: target.conversationId, inboundMessageId: randomUUID(), providerMessageId: `wamid.${randomUUID()}`,
      receivedAt: new Date(), customerWhatsAppId: '27123456789', messageType: 'TEXT',
      input: { type: 'text', text: 'A new enquiry' },
      deployment: { deploymentId: bot.deployment.id, organizationId: target.organizationId,
        whatsappConnectionId: target.connectionId, botDefinitionId: bot.definition.id, botVersionId: bot.version.id,
        implementationKey: 'WANSATI_BRANDS_V1', configuration: null, isPublished: true },
    }, (state) => decideWansatiTransition(state, { type: 'text', text: 'A new enquiry' }, { website: null, sizeGuideUrl: null }));
    expect(decision.stateAfter).toEqual({ node: 'ENTRY', answers: {} });
    expect(decision.output).toMatchObject({ body: expect.stringContaining('Welcome to Wansati Brands 🛍️') });
  });

  it('allows only one concurrent close and one close audit record', async () => {
    const target = await business();
    const handover = await activeHandover(target, new Date('2026-10-01T12:15:00.000Z'));
    const input = { organizationId: target.organizationId, handoverId: handover.id, reason: 'manual' as const, actorUserId: null, now: new Date() };
    const outcomes = await Promise.all([repository.closeHandover(input), repository.closeHandover(input)]);
    expect(outcomes.sort()).toEqual(['already_closed', 'closed']);
    const audits = await database.db.select().from(auditLogs).where(and(
      eq(auditLogs.organizationId, target.organizationId), eq(auditLogs.action, 'handover.closed'),
    ));
    expect(audits).toHaveLength(1);
  });

  it('never expires a Business with disabled auto-close, even if a stale deadline remains', async () => {
    const target = await business();
    const handover = await activeHandover(target, new Date('2026-10-01T12:15:00.000Z'));
    await repository.saveHandoverInactivitySettings(target.organizationId, { handoverAutoCloseEnabled: false, handoverInactivityMinutes: 15 });
    await database.db.update(handoverAssignments).set({ autoCloseAt: new Date('2026-10-01T12:15:00.000Z') })
      .where(eq(handoverAssignments.id, handover.id));
    expect(await repository.closeHandover({ organizationId: target.organizationId, handoverId: handover.id,
      reason: 'inactivity_timeout', actorUserId: null, now: new Date('2026-10-02T12:00:00.000Z') })).toBe('not_due');
    expect(await repository.hasHandoverForConversation(target.organizationId, target.conversationId)).toBe(true);
  });

  it('serializes customer persistence and an expiry attempt against the same conversation', async () => {
    const target = await business();
    await repository.saveHandoverInactivitySettings(target.organizationId, { handoverAutoCloseEnabled: true, handoverInactivityMinutes: 15 });
    const handover = await activeHandover(target, new Date(Date.now() - 1_000));
    const [message, closure] = await Promise.all([
      inbound.persistVerifiedInboundMessage({
        provider: 'META', providerMessageId: `wamid.${randomUUID()}`, destinationPhoneNumberId: target.phoneNumberId,
        customerWhatsAppId: '27123456789', customerDisplayName: null, occurredAt: new Date(),
        messageType: 'TEXT', textBody: 'Still here', interactiveOptionId: null,
      }),
      repository.closeHandover({ organizationId: target.organizationId, handoverId: handover.id, reason: 'inactivity_timeout', actorUserId: null, now: new Date() }),
    ]);
    if (message.outcome !== 'stored') throw new Error('Expected persisted message.');
    if (message.handoverActive) {
      expect(closure).toBe('not_due');
      expect(await repository.hasHandoverForConversation(target.organizationId, target.conversationId)).toBe(true);
    } else {
      expect(closure).toBe('closed');
      expect(await repository.hasHandoverForConversation(target.organizationId, target.conversationId)).toBe(false);
    }
  });

  it('persists a human echo under the trusted Business and extends the active handover using its policy', async () => {
    const target = await business();
    await repository.saveHandoverInactivitySettings(target.organizationId, { handoverAutoCloseEnabled: true, handoverInactivityMinutes: 30 });
    const handover = await activeHandover(target, new Date('2026-10-01T12:30:00.000Z'));
    await attachBotState(target);
    const replyAt = new Date('2026-10-01T13:00:00.000Z');
    const result = await inbound.persistVerifiedHumanBusinessAppMessage(humanEcho(target, replyAt));
    expect(result).toMatchObject({ outcome: 'stored', organizationId: target.organizationId,
      connectionId: target.connectionId, conversationId: target.conversationId, handoverActive: true });
    const [updated] = await database.db.select().from(handoverAssignments).where(eq(handoverAssignments.id, handover.id));
    expect(updated).toMatchObject({ status: 'WAITING', lastActivityAt: replyAt, lastHumanActivityAt: replyAt,
      autoCloseAt: new Date('2026-10-01T13:30:00.000Z') });
    const [stored] = await database.db.select().from(messages).where(eq(messages.organizationId, target.organizationId));
    expect(stored).toMatchObject({ conversationId: target.conversationId, direction: 'OUTBOUND',
      origin: 'BUSINESS_APP_OUTBOUND', outboundStatus: null, providerTimestamp: replyAt, textBody: 'Human reply' });
    expect(await database.db.select().from(botConversationStates).where(eq(botConversationStates.organizationId, target.organizationId))).toHaveLength(1);
  });

  it('records human activity without setting a deadline when auto-close is disabled', async () => {
    const target = await business();
    await repository.saveHandoverInactivitySettings(target.organizationId, {
      handoverAutoCloseEnabled: false, handoverInactivityMinutes: 30,
    });
    const handover = await activeHandover(target, null);
    const replyAt = new Date('2026-10-01T13:00:00.000Z');
    expect(await inbound.persistVerifiedHumanBusinessAppMessage(humanEcho(target, replyAt)))
      .toMatchObject({ outcome: 'stored', handoverActive: true });
    const [updated] = await database.db.select().from(handoverAssignments).where(eq(handoverAssignments.id, handover.id));
    expect(updated).toMatchObject({ lastActivityAt: replyAt, lastHumanActivityAt: replyAt, autoCloseAt: null });
  });

  it('uses the latest customer or human provider timestamp and handles retries and older echoes idempotently', async () => {
    const target = await business();
    await repository.saveHandoverInactivitySettings(target.organizationId, { handoverAutoCloseEnabled: true, handoverInactivityMinutes: 1_440 });
    const handover = await activeHandover(target, new Date('2026-10-01T12:00:00.000Z'));
    const first = humanEcho(target, new Date('2026-10-01T12:30:00.000Z'));
    expect((await inbound.persistVerifiedHumanBusinessAppMessage(first)).outcome).toBe('stored');
    expect((await inbound.persistVerifiedHumanBusinessAppMessage(first)).outcome).toBe('duplicate');
    const customer = await inbound.persistVerifiedInboundMessage({
      provider: 'META', providerMessageId: `wamid.${randomUUID()}`, destinationPhoneNumberId: target.phoneNumberId,
      customerWhatsAppId: '27123456789', customerDisplayName: null, occurredAt: new Date('2026-10-01T13:00:00.000Z'),
      messageType: 'TEXT', textBody: 'Customer reply', interactiveOptionId: null,
    });
    expect(customer.outcome).toBe('stored');
    expect((await inbound.persistVerifiedHumanBusinessAppMessage(humanEcho(target,
      new Date('2026-10-01T13:10:00.000Z')))).outcome).toBe('stored');
    expect((await inbound.persistVerifiedHumanBusinessAppMessage(humanEcho(target,
      new Date('2026-10-01T12:45:00.000Z')))).outcome).toBe('stored');
    const [updated] = await database.db.select().from(handoverAssignments).where(eq(handoverAssignments.id, handover.id));
    expect(updated?.lastHumanActivityAt).toEqual(new Date('2026-10-01T13:10:00.000Z'));
    expect(updated?.lastActivityAt).toEqual(new Date('2026-10-01T13:10:00.000Z'));
    expect(updated?.autoCloseAt).toEqual(new Date('2026-10-02T13:10:00.000Z'));
    expect(await database.db.select().from(messages).where(eq(messages.organizationId, target.organizationId))).toHaveLength(4);
  });

  it('stores a matched human echo without creating or reopening a handover', async () => {
    const target = await business();
    const at = new Date('2026-10-01T13:00:00.000Z');
    expect(await inbound.persistVerifiedHumanBusinessAppMessage(humanEcho(target, at))).toMatchObject({
      outcome: 'stored', handoverActive: false,
    });
    expect(await database.db.select().from(handoverAssignments).where(eq(handoverAssignments.organizationId, target.organizationId))).toEqual([]);
    const handover = await activeHandover(target, new Date('2026-10-01T13:15:00.000Z'));
    expect(await repository.closeHandover({ organizationId: target.organizationId, handoverId: handover.id,
      reason: 'manual', actorUserId: null, now: at })).toBe('closed');
    expect(await inbound.persistVerifiedHumanBusinessAppMessage(humanEcho(target, new Date('2026-10-01T13:05:00.000Z'))))
      .toMatchObject({ outcome: 'stored', handoverActive: false });
    const [closed] = await database.db.select().from(handoverAssignments).where(eq(handoverAssignments.id, handover.id));
    expect(closed).toMatchObject({ status: 'CLOSED', lastHumanActivityAt: null, autoCloseAt: null });
    expect(await database.db.select().from(handoverAssignments).where(eq(handoverAssignments.organizationId, target.organizationId))).toHaveLength(1);
  });

  it('cannot route a foreign, mismatched WABA, or unmatched recipient echo to another tenant', async () => {
    const first = await business();
    const second = await business();
    const handover = await activeHandover(second, new Date('2026-10-01T12:15:00.000Z'));
    const at = new Date('2026-10-01T13:00:00.000Z');
    expect(await inbound.persistVerifiedHumanBusinessAppMessage({ ...humanEcho(first, at), wabaId: second.wabaId }))
      .toEqual({ outcome: 'unknown_connection' });
    expect(await inbound.persistVerifiedHumanBusinessAppMessage({ ...humanEcho(first, at), customerWhatsAppId: '27820000000' }))
      .toEqual({ outcome: 'unknown_conversation' });
    expect((await inbound.persistVerifiedHumanBusinessAppMessage(humanEcho(first, at))).outcome).toBe('stored');
    const [unaffected] = await database.db.select().from(handoverAssignments).where(eq(handoverAssignments.id, handover.id));
    expect(unaffected).toMatchObject({ lastActivityAt: new Date('2026-10-01T12:00:00.000Z'), lastHumanActivityAt: null });
    expect(await database.db.select().from(messages).where(eq(messages.organizationId, second.organizationId))).toEqual([]);
  });

  it('does not count a SlotlyFlow API outbound message as a human reply even on a conflicting echo ID', async () => {
    const target = await business();
    const handover = await activeHandover(target, new Date('2026-10-01T12:15:00.000Z'));
    const providerMessageId = `wamid.${randomUUID()}`;
    await database.db.insert(messages).values({ organizationId: target.organizationId,
      conversationId: target.conversationId, whatsappConnectionId: target.connectionId,
      provider: 'META', providerMessageId, direction: 'OUTBOUND', origin: 'SLOTLYFLOW_API_OUTBOUND',
      messageType: 'TEXT', textBody: 'Bot output', outboundStatus: 'ACCEPTED',
      outboundStatusUpdatedAt: new Date('2026-10-01T12:01:00.000Z'),
      providerTimestamp: new Date('2026-10-01T12:01:00.000Z'),
    });
    expect(await inbound.persistVerifiedHumanBusinessAppMessage(humanEcho(target,
      new Date('2026-10-01T13:00:00.000Z'), providerMessageId))).toEqual({ outcome: 'duplicate' });
    const [unchanged] = await database.db.select().from(handoverAssignments).where(eq(handoverAssignments.id, handover.id));
    expect(unchanged).toMatchObject({ lastActivityAt: new Date('2026-10-01T12:00:00.000Z'), lastHumanActivityAt: null });
  });

  it('serializes a human echo and expiry so an extended deadline cannot be closed by a stale attempt', async () => {
    const target = await business();
    await repository.saveHandoverInactivitySettings(target.organizationId, { handoverAutoCloseEnabled: true, handoverInactivityMinutes: 15 });
    const handover = await activeHandover(target, new Date(Date.now() - 1_000));
    const [message, closure] = await Promise.all([
      inbound.persistVerifiedHumanBusinessAppMessage(humanEcho(target, new Date())),
      repository.closeHandover({ organizationId: target.organizationId, handoverId: handover.id,
        reason: 'inactivity_timeout', actorUserId: null, now: new Date() }),
    ]);
    if (message.outcome !== 'stored') throw new Error('Expected persisted Business App echo.');
    if (message.handoverActive) {
      expect(closure).toBe('not_due');
      expect(await repository.hasHandoverForConversation(target.organizationId, target.conversationId)).toBe(true);
    } else {
      expect(closure).toBe('closed');
      expect(await repository.hasHandoverForConversation(target.organizationId, target.conversationId)).toBe(false);
    }
  });
});

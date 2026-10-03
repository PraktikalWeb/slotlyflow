import { createHmac, randomUUID } from 'node:crypto';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { MetaWhatsAppConfig } from '@slotlyflow/config';
import { loadApiConfig, loadAuthenticationConfig, loadDatabaseConfig } from '@slotlyflow/config';
import {
  contacts,
  conversations,
  createDatabaseConnection,
  messages,
  organizationMembers,
  organizations,
  sessions,
  users,
  whatsappConnections,
} from '@slotlyflow/database';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../src/application.js';
import { DrizzleInboundWhatsAppMessageRepository } from '../src/whatsapp/inbound-whatsapp-message.repository.js';

const databaseUrl = process.env.DATABASE_URL;
const databaseName = databaseUrl === undefined ? '' : new URL(databaseUrl).pathname.replace(/^\//, '');
const describeDatabase = databaseUrl !== undefined && databaseName.endsWith('_test') ? describe : describe.skip;

const metaConfig: MetaWhatsAppConfig = {
  appId: '1234567890',
  appSecret: 'server-only-meta-webhook-test-secret',
  embeddedSignupConfigurationId: '9876543210',
  graphApiVersion: 'v25.0',
  webhookVerifyToken: 'meta-webhook-verify-token-fixture',
  credentialEncryptionKey: Buffer.alloc(32, 6),
};

describeDatabase('M3.1 Meta WhatsApp webhook ingress', () => {
  let application: NestFastifyApplication;
  let database: ReturnType<typeof createDatabaseConnection>;
  const organizationIds = new Set<string>();
  const userIds = new Set<string>();

  beforeAll(async () => {
    database = createDatabaseConnection(loadDatabaseConfig());
    application = await createApplication(
      { ...loadApiConfig(), environment: 'test', cors: { enabled: false, origins: [] } },
      database,
      undefined,
      loadAuthenticationConfig(),
      undefined,
      metaConfig,
    );
    await application.init();
  });

  afterEach(async () => {
    const organizationsToDelete = [...organizationIds];
    const usersToDelete = [...userIds];
    organizationIds.clear();
    userIds.clear();
    if (organizationsToDelete.length > 0) {
      await database.db.delete(messages).where(inArray(messages.organizationId, organizationsToDelete));
      await database.db.delete(contacts).where(inArray(contacts.organizationId, organizationsToDelete));
      await database.db.delete(conversations).where(inArray(conversations.organizationId, organizationsToDelete));
      await database.db.delete(whatsappConnections).where(inArray(whatsappConnections.organizationId, organizationsToDelete));
      await database.db.delete(organizationMembers).where(inArray(organizationMembers.organizationId, organizationsToDelete));
      await database.db.delete(organizations).where(inArray(organizations.id, organizationsToDelete));
    }
    if (usersToDelete.length > 0) {
      await database.db.delete(sessions).where(inArray(sessions.userId, usersToDelete));
      await database.db.delete(users).where(inArray(users.id, usersToDelete));
    }
  });

  afterAll(async () => {
    await application?.close();
    await database?.close();
  });

  async function business(phoneNumberId = `phone-${randomUUID()}`) {
    const user = (await database.db.insert(users).values({
      emailNormalized: `webhook-${randomUUID()}@test.local`, passwordHash: 'not-used-by-webhook-tests', emailVerifiedAt: new Date(),
    }).returning())[0];
    if (user === undefined) throw new Error('Expected test user.');
    const organization = (await database.db.insert(organizations).values({
      name: `Webhook Business ${randomUUID()}`, slug: `webhook-business-${randomUUID()}`,
    }).returning())[0];
    if (organization === undefined) throw new Error('Expected test Business.');
    await database.db.insert(organizationMembers).values({ organizationId: organization.id, userId: user.id, role: 'OWNER', status: 'active' });
    await database.db.insert(whatsappConnections).values({
      organizationId: organization.id, provider: 'META', connectionSource: 'EXISTING_BUSINESS_APP', connectionStatus: 'CONNECTED',
      externalWabaId: `waba-${randomUUID()}`, externalPhoneNumberId: phoneNumberId, credentialReference: `credential-${randomUUID()}`,
    });
    userIds.add(user.id);
    organizationIds.add(organization.id);
    return { organization, phoneNumberId };
  }

  function payload(phoneNumberId: string, providerMessageId = `wamid.${randomUUID()}`, customer = '16505551234', type: string = 'text'): string {
    return JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ id: '102290129340398', changes: [{ field: 'messages', value: {
        messaging_product: 'whatsapp', metadata: { phone_number_id: phoneNumberId },
        contacts: [{ profile: { name: 'Webhook Customer' }, wa_id: customer }],
        messages: [{ from: customer, id: providerMessageId, timestamp: '1749416383', type, ...(type === 'text' ? { text: { body: 'Inbound hello' } } : { image: { id: 'media-id' } }) }],
      } }] }],
    });
  }

  function headers(raw: string): Record<string, string> {
    return {
      'content-type': 'application/json',
      'x-hub-signature-256': `sha256=${createHmac('sha256', metaConfig.appSecret).update(raw).digest('hex')}`,
    };
  }

  async function post(raw: string, suppliedHeaders = headers(raw)) {
    return application.getHttpAdapter().getInstance().inject({
      method: 'POST', url: '/webhooks/meta/whatsapp', headers: suppliedHeaders, payload: raw,
    });
  }

  it('performs Meta verification and rejects an incorrect secret token', async () => {
    const server = application.getHttpAdapter().getInstance();
    const accepted = await server.inject({
      method: 'GET', url: `/webhooks/meta/whatsapp?hub.mode=subscribe&hub.verify_token=${metaConfig.webhookVerifyToken}&hub.challenge=challenge-value`,
    });
    const rejected = await server.inject({
      method: 'GET', url: '/webhooks/meta/whatsapp?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=challenge-value',
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.body).toBe('challenge-value');
    expect(rejected.statusCode).toBe(400);
    expect(rejected.body).not.toContain(metaConfig.webhookVerifyToken);
  });

  it('verifies the raw signature before persistence and never exposes a secret in failures', async () => {
    const target = await business();
    const raw = payload(target.phoneNumberId);
    const accepted = await post(raw);
    const altered = await post(`${raw} `, headers(raw));
    const unsigned = await post(raw, { 'content-type': 'application/json' });
    const stored = await database.db.select().from(messages).where(eq(messages.organizationId, target.organization.id));

    expect(accepted.statusCode).toBe(200);
    expect([altered.statusCode, unsigned.statusCode]).toEqual([400, 400]);
    expect(stored).toHaveLength(1);
    expect(`${altered.body}${unsigned.body}`).not.toContain(metaConfig.appSecret);
  });

  it('fails malformed signed input safely, acknowledges status/unsupported events, and never assigns an unknown connection', async () => {
    const target = await business();
    const malformed = '{"object":"whatsapp_business_account","entry":"not-an-array"}';
    const unsupported = payload(target.phoneNumberId, `wamid.${randomUUID()}`, '16505551234', 'image');
    const statusOnly = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: target.phoneNumberId }, statuses: [{ id: 'wamid.status', status: 'delivered', timestamp: '1749416383' }] } }] }] });
    const unknown = payload('unknown-phone-id');

    expect((await post(malformed)).statusCode).toBe(400);
    expect((await post(unsupported)).statusCode).toBe(200);
    expect((await post(statusOnly)).statusCode).toBe(200);
    expect((await post(unknown)).statusCode).toBe(200);
    const stored = await database.db.select().from(messages).where(eq(messages.organizationId, target.organization.id));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ direction: 'INBOUND', messageType: 'UNSUPPORTED', textBody: null });
  });

  it('keeps the same customer isolated per Business and makes retries/concurrent first messages durable', async () => {
    const first = await business();
    const second = await business();
    const duplicateRaw = payload(first.phoneNumberId, 'wamid.duplicate');
    const secondTenantRaw = payload(second.phoneNumberId, 'wamid.second-tenant');
    const concurrentOne = payload(first.phoneNumberId, 'wamid.concurrent-one', '27820000000');
    const concurrentTwo = payload(first.phoneNumberId, 'wamid.concurrent-two', '27820000000');

    await post(duplicateRaw);
    await post(duplicateRaw);
    await post(secondTenantRaw);
    await Promise.all([post(concurrentOne), post(concurrentTwo)]);

    const firstConversations = await database.db.select().from(conversations).where(eq(conversations.organizationId, first.organization.id));
    const secondConversations = await database.db.select().from(conversations).where(eq(conversations.organizationId, second.organization.id));
    const firstMessages = await database.db.select().from(messages).where(eq(messages.organizationId, first.organization.id));
    const scopedRepository = application.get(DrizzleInboundWhatsAppMessageRepository);
    const firstConversation = firstConversations[0];
    if (firstConversation === undefined) throw new Error('Expected the first Business conversation.');
    const crossTenantConversation = await scopedRepository.findConversationForOrganization(second.organization.id, firstConversation.id);
    const crossTenantMessages = await scopedRepository.findMessagesForConversation(second.organization.id, firstConversation.id);

    expect(firstConversations.filter((item) => item.customerWhatsAppId === '27820000000')).toHaveLength(1);
    expect(firstMessages).toHaveLength(3);
    expect(secondConversations).toHaveLength(1);
    expect(crossTenantConversation).toBeUndefined();
    expect(crossTenantMessages).toEqual([]);
  });

  it('accepts a signed Coexistence Business App echo through the existing webhook and deduplicates it', async () => {
    const target = await business();
    const [connection] = await database.db.select().from(whatsappConnections)
      .where(eq(whatsappConnections.organizationId, target.organization.id));
    if (connection === undefined || connection.externalWabaId === null) throw new Error('Expected Coexistence connection.');
    const [conversation] = await database.db.insert(conversations).values({
      organizationId: target.organization.id, whatsappConnectionId: connection.id,
      customerWhatsAppId: '16505551234', lastMessageAt: new Date('2025-02-11T00:00:00.000Z'),
    }).returning();
    if (conversation === undefined) throw new Error('Expected conversation.');
    const raw = JSON.stringify({ object: 'whatsapp_business_account', entry: [{
      id: connection.externalWabaId, changes: [{ field: 'smb_message_echoes', value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: '15550783881', phone_number_id: target.phoneNumberId },
        message_echoes: [{ from: '15550783881', to: '+16505551234', id: `wamid.${randomUUID()}`,
          timestamp: '1739321024', type: 'text', text: { body: 'Business App reply' } }],
      } }],
    }] });
    expect((await post(raw)).statusCode).toBe(200);
    expect((await post(raw)).statusCode).toBe(200);
    expect((await post(raw, { 'content-type': 'application/json' })).statusCode).toBe(400);
    const stored = await database.db.select().from(messages).where(eq(messages.organizationId, target.organization.id));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ conversationId: conversation.id, direction: 'OUTBOUND',
      origin: 'BUSINESS_APP_OUTBOUND', textBody: 'Business App reply', outboundStatus: null });
  });
});

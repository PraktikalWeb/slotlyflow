import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { MetaWhatsAppConfig } from '@slotlyflow/config';
import { loadApiConfig, loadAuthenticationConfig, loadDatabaseConfig } from '@slotlyflow/config';
import {
  conversations,
  createDatabaseConnection,
  messages,
  organizationMembers,
  organizations,
  outboundMessageRequests,
  sessions,
  users,
  whatsappConnections,
} from '@slotlyflow/database';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApplication } from '../src/application.js';
import { providerCredentialReference, type CredentialStore } from '../src/whatsapp/credential-store.js';
import { WhatsAppMessagingProviderError, type OutboundWhatsAppTextMessage, type WhatsAppMessagingProvider } from '../src/whatsapp/whatsapp-messaging-provider.js';

const databaseUrl = process.env.DATABASE_URL;
const databaseName = databaseUrl === undefined ? '' : new URL(databaseUrl).pathname.replace(/^\//, '');
const describeDatabase = databaseUrl !== undefined && databaseName.endsWith('_test') ? describe : describe.skip;

const metaConfig: MetaWhatsAppConfig = {
  appId: '1234567890', appSecret: 'server-only-m3-outbound-test-secret', embeddedSignupConfigurationId: '9876543210',
  graphApiVersion: 'v25.0', webhookVerifyToken: 'm3-outbound-webhook-verify-token', credentialEncryptionKey: Buffer.alloc(32, 7),
};

function inserted<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`Expected ${label}.`);
  return value;
}

describeDatabase('M3.2 outbound WhatsApp text messages', () => {
  let application: NestFastifyApplication;
  let database: ReturnType<typeof createDatabaseConnection>;
  const organizationIds = new Set<string>();
  const userIds = new Set<string>();
  const sendText = vi.fn<(message: OutboundWhatsAppTextMessage) => Promise<{ providerMessageId: string; acceptedAt: Date }>>();
  const messagingProvider: WhatsAppMessagingProvider = { provider: 'META', sendText };
  const credentials: CredentialStore = {
    prepare: vi.fn(),
    retrieve: vi.fn(async () => ({ provider: 'META' as const, accessToken: 'test-token-not-a-real-secret', expiresAt: null })),
    rotate: vi.fn(),
    revoke: vi.fn(),
  };
  const authConfig = {
    ...loadAuthenticationConfig(),
    email: {
      provider: 'smtp' as const,
      webAppUrl: 'http://localhost:3000/',
      from: { address: 'no-reply@slotlyflow.local', name: 'SlotlyFlow' },
      smtp: { host: '127.0.0.1', port: 1025, secure: false },
    },
  };

  beforeAll(async () => {
    database = createDatabaseConnection(loadDatabaseConfig());
    application = await createApplication(
      { ...loadApiConfig(), environment: 'test', cors: { enabled: false, origins: [] } },
      database,
      undefined,
      authConfig,
      undefined,
      metaConfig,
      undefined,
      messagingProvider,
      credentials,
    );
    await application.init();
  });

  afterEach(async () => {
    sendText.mockReset();
    const organizationsToDelete = [...organizationIds];
    const usersToDelete = [...userIds];
    organizationIds.clear();
    userIds.clear();
    if (organizationsToDelete.length > 0) {
      await database.db.delete(outboundMessageRequests).where(inArray(outboundMessageRequests.organizationId, organizationsToDelete));
      await database.db.delete(messages).where(inArray(messages.organizationId, organizationsToDelete));
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

  afterAll(async () => { await application?.close(); await database?.close(); });

  async function actor() {
    const user = inserted((await database.db.insert(users).values({
      emailNormalized: `outbound-${randomUUID()}@test.local`, passwordHash: 'not-used-by-outbound-tests', emailVerifiedAt: new Date(),
    }).returning())[0], 'test user');
    const sessionToken = randomBytes(32).toString('base64url');
    await database.db.insert(sessions).values({
      userId: user.id,
      tokenHash: createHash('sha256').update(sessionToken).digest('base64url'),
      expiresAt: new Date(Date.now() + 60_000),
    });
    userIds.add(user.id);
    return { user, sessionToken };
  }

  async function business(
    role: 'OWNER' | 'ADMIN' | 'AGENT' = 'OWNER',
    membershipStatus: 'active' | 'disabled' = 'active',
    connectionStatus: 'CONNECTED' | 'DISCONNECTED' = 'CONNECTED',
  ) {
    const owner = await actor();
    const organization = inserted((await database.db.insert(organizations).values({
      name: `Outbound Business ${randomUUID()}`, slug: `outbound-business-${randomUUID()}`,
    }).returning())[0], 'test organization');
    await database.db.insert(organizationMembers).values({ organizationId: organization.id, userId: owner.user.id, role, status: membershipStatus });
    const connection = inserted((await database.db.insert(whatsappConnections).values({
      organizationId: organization.id, provider: 'META', connectionSource: 'EXISTING_BUSINESS_APP', connectionStatus,
      ...(connectionStatus === 'CONNECTED' ? {
        externalWabaId: `waba-${randomUUID()}`,
        externalPhoneNumberId: `1065403522${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
        credentialReference: providerCredentialReference(randomUUID()),
      } : {}),
    }).returning())[0], 'test connection');
    const conversation = inserted((await database.db.insert(conversations).values({
      organizationId: organization.id, whatsappConnectionId: connection.id, customerWhatsAppId: '16505551234', lastMessageAt: new Date(),
    }).returning())[0], 'test conversation');
    organizationIds.add(organization.id);
    return { ...owner, organization, connection, conversation };
  }

  function cookie(token: string): string { return `${authConfig.session.cookieName}=${token}`; }
  async function csrf(token: string): Promise<Record<string, string>> {
    const response = await application.getHttpAdapter().getInstance().inject({ method: 'GET', url: '/auth/csrf' });
    const csrfToken = (response.json() as { csrfToken: string }).csrfToken;
    return { cookie: `${cookie(token)}; slotlyflow_csrf=${csrfToken}`, 'x-csrf-token': csrfToken };
  }
  async function send(target: Awaited<ReturnType<typeof business>>, key = `outbound-${randomUUID()}`, body: Record<string, unknown> | string = { text: 'Hello customer' }) {
    return application.getHttpAdapter().getInstance().inject({
      method: 'POST',
      url: `/organizations/${target.organization.id}/conversations/${target.conversation.id}/messages`,
      headers: { ...(await csrf(target.sessionToken)), 'idempotency-key': key },
      payload: body as Record<string, unknown> | string,
    });
  }
  function signedStatus(phoneNumberId: string, providerMessageId: string, status: string): { payload: string; headers: Record<string, string> } {
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: {
      metadata: { phone_number_id: phoneNumberId },
      statuses: [{ id: providerMessageId, status, timestamp: '1749416383', recipient_id: '16505551234' }],
    } }] }] });
    return { payload, headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${createHmac('sha256', metaConfig.appSecret).update(payload).digest('hex')}` } };
  }

  it('lets OWNER, ADMIN, and AGENT send only through their own trusted Business conversation', async () => {
    for (const role of ['OWNER', 'ADMIN', 'AGENT'] as const) {
      const target = await business(role);
      sendText.mockResolvedValueOnce({ providerMessageId: `wamid.${role}`, acceptedAt: new Date('2025-06-08T20:59:43.000Z') });
      const response = await send(target);
      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ message: { direction: 'OUTBOUND', messageType: 'TEXT', status: 'ACCEPTED' } });
    }
    expect(sendText).toHaveBeenCalledTimes(3);
  });

  it('derives sender and recipient from trusted persistence, not extra browser fields', async () => {
    const target = await business();
    sendText.mockResolvedValueOnce({ providerMessageId: 'wamid.trusted-routing', acceptedAt: new Date() });
    const response = await send(target, `outbound-${randomUUID()}`, {
      text: '  Trusted reply  ', senderPhoneNumberId: 'browser-controlled', to: '99999999999', accessToken: 'browser-controlled',
    });
    expect(response.statusCode).toBe(201);
    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({
      senderPhoneNumberId: target.connection.externalPhoneNumberId,
      recipientWhatsAppId: target.conversation.customerWhatsAppId,
      credentialReference: target.connection.credentialReference,
      text: 'Trusted reply',
    }));
    const stored = await database.db.select().from(messages).where(eq(messages.organizationId, target.organization.id));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ direction: 'OUTBOUND', providerMessageId: 'wamid.trusted-routing', outboundStatus: 'ACCEPTED', textBody: 'Trusted reply' });
    expect(response.body).not.toContain(String(target.connection.credentialReference));
  });

  it('enforces CSRF, tenant scope, active membership, connection state, and text validation without provider sends', async () => {
    const owner = await business();
    const outsider = await business();
    const inactive = await business('AGENT', 'disabled');
    const disconnected = await business('OWNER', 'active', 'DISCONNECTED');
    const server = application.getHttpAdapter().getInstance();
    const crossTenant = await server.inject({
      method: 'POST', url: `/organizations/${outsider.organization.id}/conversations/${owner.conversation.id}/messages`,
      headers: { ...(await csrf(outsider.sessionToken)), 'idempotency-key': `outbound-${randomUUID()}` }, payload: { text: 'Nope' },
    });
    const inactiveResponse = await send(inactive);
    const disconnectedResponse = await send(disconnected);
    const invalid = await send(owner, `outbound-${randomUUID()}`, { text: '   ' });
    const oversized = await send(owner, `outbound-${randomUUID()}`, { text: 'x'.repeat(4097) });
    const missingCsrf = await server.inject({
      method: 'POST', url: `/organizations/${owner.organization.id}/conversations/${owner.conversation.id}/messages`,
      headers: { cookie: cookie(owner.sessionToken), 'idempotency-key': `outbound-${randomUUID()}` }, payload: { text: 'No CSRF' },
    });
    expect([crossTenant.statusCode, inactiveResponse.statusCode]).toEqual([404, 404]);
    expect(disconnectedResponse.statusCode).toBe(409);
    expect([invalid.statusCode, oversized.statusCode, missingCsrf.statusCode]).toEqual([400, 400, 403]);
    expect(sendText).not.toHaveBeenCalled();
  });

  it('persists one accepted outbound Message and never repeats an idempotent completed request', async () => {
    const target = await business();
    const key = `outbound-${randomUUID()}`;
    sendText.mockResolvedValueOnce({ providerMessageId: 'wamid.idempotent', acceptedAt: new Date() });
    const first = await send(target, key);
    const second = await send(target, key);
    expect([first.statusCode, second.statusCode]).toEqual([201, 201]);
    expect(sendText).toHaveBeenCalledTimes(1);
    const stored = await database.db.select().from(messages).where(eq(messages.organizationId, target.organization.id));
    expect(stored).toHaveLength(1);
    const reused = await send(target, key, { text: 'Different logical message' });
    expect(reused.statusCode).toBe(409);
  });

  it('does not create a false successful outbound message for a provider rejection or outcome-unknown transport failure', async () => {
    const rejected = await business();
    sendText.mockRejectedValueOnce(new WhatsAppMessagingProviderError('REJECTED'));
    const rejectedResponse = await send(rejected);
    expect(rejectedResponse.statusCode).toBe(400);
    expect(await database.db.select().from(messages).where(eq(messages.organizationId, rejected.organization.id))).toEqual([]);

    const ambiguous = await business();
    sendText.mockRejectedValueOnce(new WhatsAppMessagingProviderError('OUTCOME_UNKNOWN'));
    const ambiguousResponse = await send(ambiguous);
    expect(ambiguousResponse.statusCode).toBe(503);
    expect(ambiguousResponse.body).not.toContain('test-token-not-a-real-secret');
    expect(await database.db.select().from(messages).where(eq(messages.organizationId, ambiguous.organization.id))).toEqual([]);
  });

  it('updates outbound statuses idempotently and never regresses a later status through a signed webhook', async () => {
    const target = await business();
    sendText.mockResolvedValueOnce({ providerMessageId: 'wamid.status-loop', acceptedAt: new Date('2025-06-08T20:58:00.000Z') });
    await send(target);
    const server = application.getHttpAdapter().getInstance();
    for (const status of ['sent', 'delivered', 'read', 'delivered', 'read'] as const) {
      const event = signedStatus(target.connection.externalPhoneNumberId as string, 'wamid.status-loop', status);
      expect((await server.inject({ method: 'POST', url: '/webhooks/meta/whatsapp', headers: event.headers, payload: event.payload })).statusCode).toBe(200);
    }
    const [stored] = await database.db.select().from(messages).where(and(
      eq(messages.organizationId, target.organization.id), eq(messages.providerMessageId, 'wamid.status-loop'),
    ));
    expect(stored).toMatchObject({ direction: 'OUTBOUND', outboundStatus: 'READ' });

    const failedTarget = await business();
    sendText.mockResolvedValueOnce({ providerMessageId: 'wamid.failed-loop', acceptedAt: new Date('2025-06-08T20:58:00.000Z') });
    await send(failedTarget);
    const failedEvent = signedStatus(failedTarget.connection.externalPhoneNumberId as string, 'wamid.failed-loop', 'failed');
    expect((await server.inject({ method: 'POST', url: '/webhooks/meta/whatsapp', headers: failedEvent.headers, payload: failedEvent.payload })).statusCode).toBe(200);
    const [failed] = await database.db.select().from(messages).where(and(
      eq(messages.organizationId, failedTarget.organization.id), eq(messages.providerMessageId, 'wamid.failed-loop'),
    ));
    expect(failed).toMatchObject({ outboundStatus: 'FAILED' });

    const unknown = signedStatus(target.connection.externalPhoneNumberId as string, 'wamid.unknown', 'failed');
    const invalid = await server.inject({ method: 'POST', url: '/webhooks/meta/whatsapp', headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=invalid' }, payload: unknown.payload });
    expect(invalid.statusCode).toBe(400);
    expect((await server.inject({ method: 'POST', url: '/webhooks/meta/whatsapp', headers: unknown.headers, payload: unknown.payload })).statusCode).toBe(200);
    expect((await database.db.select().from(messages).where(eq(messages.organizationId, target.organization.id)))).toHaveLength(1);
  });
});

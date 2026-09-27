import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { MetaWhatsAppConfig } from '@slotlyflow/config';
import { loadApiConfig, loadAuthenticationConfig, loadDatabaseConfig } from '@slotlyflow/config';
import {
  auditLogs,
  createDatabaseConnection,
  organizationMembers,
  organizations,
  sessions,
  users,
  whatsappConnections,
  whatsappOnboardingTransactions,
} from '@slotlyflow/database';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../src/application.js';

const databaseUrl = process.env.DATABASE_URL;
const databaseName = databaseUrl === undefined ? '' : new URL(databaseUrl).pathname.replace(/^\//, '');
const describeDatabase = databaseUrl !== undefined && databaseName.endsWith('_test') ? describe : describe.skip;

const metaConfig: MetaWhatsAppConfig = {
  appId: '1234567890',
  appSecret: 'server-only-meta-test-secret',
  embeddedSignupConfigurationId: '9876543210',
  graphApiVersion: 'v25.0',
  webhookVerifyToken: 'meta-webhook-verify-token-fixture',
  credentialEncryptionKey: Buffer.alloc(32, 2),
};

function requireInserted<T>(value: T | undefined, description: string): T {
  if (value === undefined) throw new Error(`Expected ${description}.`);
  return value;
}

describeDatabase('M2.1 WhatsApp onboarding transactions', () => {
  let application: NestFastifyApplication;
  let database: ReturnType<typeof createDatabaseConnection>;
  const createdUserIds = new Set<string>();
  const createdOrganizationIds = new Set<string>();
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
    );
    await application.init();
  });

  afterEach(async () => {
    const organizationIds = [...createdOrganizationIds];
    const userIds = [...createdUserIds];
    createdOrganizationIds.clear();
    createdUserIds.clear();
    if (organizationIds.length > 0) {
      await database.db.delete(auditLogs).where(inArray(auditLogs.organizationId, organizationIds));
      await database.db.delete(whatsappOnboardingTransactions).where(inArray(whatsappOnboardingTransactions.organizationId, organizationIds));
      await database.db.delete(whatsappConnections).where(inArray(whatsappConnections.organizationId, organizationIds));
      await database.db.delete(organizationMembers).where(inArray(organizationMembers.organizationId, organizationIds));
      await database.db.delete(organizations).where(inArray(organizations.id, organizationIds));
    }
    if (userIds.length > 0) {
      await database.db.delete(sessions).where(inArray(sessions.userId, userIds));
      await database.db.delete(users).where(inArray(users.id, userIds));
    }
  });

  afterAll(async () => {
    await application?.close();
    await database?.close();
  });

  async function actor() {
    const user = requireInserted(
      (await database.db.insert(users).values({
        emailNormalized: `whatsapp-onboarding-${randomUUID()}@test.local`,
        passwordHash: 'not-used-by-whatsapp-onboarding-tests',
        emailVerifiedAt: new Date(),
      }).returning())[0],
      'onboarding test user',
    );
    const sessionToken = randomBytes(32).toString('base64url');
    await database.db.insert(sessions).values({
      userId: user.id,
      tokenHash: createHash('sha256').update(sessionToken).digest('base64url'),
      expiresAt: new Date(Date.now() + 60_000),
    });
    createdUserIds.add(user.id);
    return { user, sessionToken };
  }

  async function business(ownerRole: 'OWNER' | 'ADMIN' | 'AGENT' = 'OWNER', status: 'active' | 'disabled' = 'active') {
    const owner = await actor();
    const organization = requireInserted(
      (await database.db.insert(organizations).values({
        name: `Onboarding Business ${randomUUID()}`,
        slug: `onboarding-business-${randomUUID()}`,
      }).returning())[0],
      'onboarding test Organization',
    );
    await database.db.insert(organizationMembers).values({ organizationId: organization.id, userId: owner.user.id, role: ownerRole, status });
    createdOrganizationIds.add(organization.id);
    return { ...owner, organization };
  }

  async function addMember(organizationId: string, role: 'OWNER' | 'ADMIN' | 'AGENT', status: 'active' | 'disabled' = 'active') {
    const member = await actor();
    await database.db.insert(organizationMembers).values({ organizationId, userId: member.user.id, role, status });
    return member;
  }

  function sessionCookie(sessionToken: string): string {
    return `${authConfig.session.cookieName}=${sessionToken}`;
  }

  async function csrfHeaders(sessionToken: string): Promise<Record<string, string>> {
    const server = application.getHttpAdapter().getInstance();
    const response = await server.inject({ method: 'GET', url: '/auth/csrf' });
    const csrfToken = (response.json() as { csrfToken: string }).csrfToken;
    return {
      cookie: `${sessionCookie(sessionToken)}; slotlyflow_csrf=${csrfToken}`,
      'x-csrf-token': csrfToken,
    };
  }

  async function start(organizationId: string, sessionToken: string, source: unknown = 'EXISTING_BUSINESS_APP') {
    return application.getHttpAdapter().getInstance().inject({
      method: 'POST',
      url: `/organizations/${organizationId}/whatsapp-connection/onboarding`,
      headers: await csrfHeaders(sessionToken),
      payload: { source },
    });
  }

  it('starts one auditable, actor-bound transaction and returns only allow-listed Meta configuration', async () => {
    const owner = await business();
    const first = await start(owner.organization.id, owner.sessionToken);
    const second = await start(owner.organization.id, owner.sessionToken);

    expect([first.statusCode, second.statusCode]).toEqual([201, 201]);
    const firstPayload = first.json() as { onboarding: { transactionId: string; expiresAt: string }; meta: Record<string, string> };
    const secondPayload = second.json() as { onboarding: { transactionId: string } };
    expect(secondPayload.onboarding.transactionId).toBe(firstPayload.onboarding.transactionId);
    expect(firstPayload).toMatchObject({
      onboarding: { provider: 'META', source: 'EXISTING_BUSINESS_APP', transactionId: expect.any(String), expiresAt: expect.any(String) },
      meta: { appId: metaConfig.appId, embeddedSignupConfigurationId: metaConfig.embeddedSignupConfigurationId, graphApiVersion: metaConfig.graphApiVersion },
    });
    expect(first.body).not.toContain(metaConfig.appSecret);

    const transactions = await database.db.select().from(whatsappOnboardingTransactions)
      .where(eq(whatsappOnboardingTransactions.organizationId, owner.organization.id));
    const audits = await database.db.select().from(auditLogs).where(and(
      eq(auditLogs.organizationId, owner.organization.id),
      eq(auditLogs.action, 'whatsapp.onboarding.started'),
    ));
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      id: firstPayload.onboarding.transactionId,
      organizationId: owner.organization.id,
      actorUserId: owner.user.id,
      provider: 'META',
      connectionSource: 'EXISTING_BUSINESS_APP',
      status: 'STARTED',
      expiresAt: expect.any(Date),
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorUserId: owner.user.id,
      targetType: 'whatsapp_onboarding_transaction',
      targetId: firstPayload.onboarding.transactionId,
      metadata: { provider: 'META', source: 'EXISTING_BUSINESS_APP' },
    });
    expect(JSON.stringify(audits[0])).not.toContain(metaConfig.appSecret);
  });

  it('enforces trusted context, centralized RBAC, CSRF, source validation, and non-disclosing tenant denial', async () => {
    const owner = await business();
    const admin = await addMember(owner.organization.id, 'ADMIN');
    const agent = await addMember(owner.organization.id, 'AGENT');
    const inactive = await addMember(owner.organization.id, 'OWNER', 'disabled');
    const outsider = await actor();
    const server = application.getHttpAdapter().getInstance();

    const adminResponse = await start(owner.organization.id, admin.sessionToken);
    const agentResponse = await start(owner.organization.id, agent.sessionToken);
    const inactiveResponse = await start(owner.organization.id, inactive.sessionToken);
    const crossTenantResponse = await start(owner.organization.id, outsider.sessionToken);
    const malformedResponse = await server.inject({
      method: 'POST',
      url: '/organizations/not-an-organization-id/whatsapp-connection/onboarding',
      headers: await csrfHeaders(outsider.sessionToken),
      payload: { source: 'EXISTING_BUSINESS_APP' },
    });
    const missingCsrf = await server.inject({
      method: 'POST',
      url: `/organizations/${owner.organization.id}/whatsapp-connection/onboarding`,
      headers: { cookie: sessionCookie(owner.sessionToken) },
      payload: { source: 'EXISTING_BUSINESS_APP' },
    });
    const csrfOnly = await csrfHeaders(owner.sessionToken);
    const csrfCookie = csrfOnly.cookie;
    if (csrfCookie === undefined) throw new Error('Expected CSRF cookie header.');
    csrfOnly.cookie = csrfCookie.split('; ')[1] as string;
    const unauthenticated = await server.inject({
      method: 'POST',
      url: `/organizations/${owner.organization.id}/whatsapp-connection/onboarding`,
      headers: csrfOnly,
      payload: { source: 'EXISTING_BUSINESS_APP' },
    });
    const invalidSource = await start(owner.organization.id, admin.sessionToken, 'NEW_NUMBER');

    expect(adminResponse.statusCode).toBe(201);
    expect(agentResponse.statusCode).toBe(403);
    expect([inactiveResponse.statusCode, crossTenantResponse.statusCode, malformedResponse.statusCode]).toEqual([404, 404, 404]);
    expect(inactiveResponse.json().error).toEqual(crossTenantResponse.json().error);
    expect(crossTenantResponse.json().error).toEqual(malformedResponse.json().error);
    expect([missingCsrf.statusCode, unauthenticated.statusCode, invalidSource.statusCode]).toEqual([403, 401, 400]);
    expect(invalidSource.json()).toMatchObject({ error: { code: 'WHATSAPP_ONBOARDING_SOURCE_INVALID' } });
    expect(crossTenantResponse.body).not.toContain(owner.organization.id);
  });

  it('expires stale attempts, rejects a different actor from reusing one, and rejects every existing connection state', async () => {
    const owner = await business();
    const admin = await addMember(owner.organization.id, 'ADMIN');
    const stale = requireInserted(
      (await database.db.insert(whatsappOnboardingTransactions).values({
        organizationId: owner.organization.id,
        actorUserId: owner.user.id,
        provider: 'META',
        connectionSource: 'EXISTING_BUSINESS_APP',
        status: 'STARTED',
        createdAt: new Date(Date.now() - 120_000),
        updatedAt: new Date(Date.now() - 120_000),
        expiresAt: new Date(Date.now() - 60_000),
      }).returning())[0],
      'stale transaction',
    );
    const renewed = await start(owner.organization.id, owner.sessionToken);
    const renewedId = (renewed.json() as { onboarding: { transactionId: string } }).onboarding.transactionId;
    const otherActorAttempt = await start(owner.organization.id, admin.sessionToken);
    const stored = await database.db.select().from(whatsappOnboardingTransactions)
      .where(eq(whatsappOnboardingTransactions.organizationId, owner.organization.id));
    expect(renewed.statusCode).toBe(201);
    expect(otherActorAttempt.statusCode).toBe(409);
    expect(otherActorAttempt.body).not.toContain(renewedId);
    expect(stored).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: stale.id, status: 'EXPIRED' }),
      expect.objectContaining({ id: renewedId, status: 'STARTED', actorUserId: owner.user.id }),
    ]));

    for (const connectionStatus of ['PENDING', 'VERIFYING', 'CONNECTED', 'FAILED', 'DISCONNECTED'] as const) {
      const connectedBusiness = await business();
      await database.db.insert(whatsappConnections).values({
        organizationId: connectedBusiness.organization.id,
        provider: 'META',
        connectionSource: 'EXISTING_BUSINESS_APP',
        connectionStatus,
        ...(connectionStatus === 'CONNECTED' ? {
          externalWabaId: `waba-${randomUUID()}`,
          externalPhoneNumberId: `phone-${randomUUID()}`,
          credentialReference: `credential-${randomUUID()}`,
        } : {}),
      });
      const rejected = await start(connectedBusiness.organization.id, connectedBusiness.sessionToken);
      expect(rejected.statusCode).toBe(409);
      expect(await database.db.select().from(whatsappOnboardingTransactions)
        .where(eq(whatsappOnboardingTransactions.organizationId, connectedBusiness.organization.id))).toEqual([]);
    }
  });
});

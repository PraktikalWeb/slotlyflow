import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { loadApiConfig, loadAuthenticationConfig, loadDatabaseConfig } from '@slotlyflow/config';
import {
  auditLogs,
  createDatabaseConnection,
  organizationMembers,
  organizations,
  sessions,
  users,
  whatsappConnections,
} from '@slotlyflow/database';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../src/application.js';
import { providerCredentialReference } from '../src/whatsapp/credential-store.js';
import { WhatsAppConnectionService } from '../src/whatsapp/whatsapp-connection.service.js';
import { OrganizationContextService } from '../src/organizations/organization-context.service.js';
import type { TrustedOrganizationContext } from '../src/organizations/organization.types.js';
import type { VerifiedWhatsAppConnectionResult } from '../src/whatsapp/whatsapp-connection.types.js';

const databaseUrl = process.env.DATABASE_URL;
const databaseName = databaseUrl === undefined ? '' : new URL(databaseUrl).pathname.replace(/^\//, '');
const describeDatabase = databaseUrl !== undefined && databaseName.endsWith('_test') ? describe : describe.skip;

function requireInserted<T>(value: T | undefined, description: string): T {
  if (value === undefined) throw new Error(`Expected ${description}.`);
  return value;
}

describeDatabase('M1 WhatsApp connection core', () => {
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
    googleOidc: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3001/auth/google/callback',
      webAppUrl: 'http://localhost:3000/',
    },
  };

  beforeAll(async () => {
    database = createDatabaseConnection(loadDatabaseConfig());
    application = await createApplication(
      { ...loadApiConfig(), environment: 'test', cors: { enabled: false, origins: [] } },
      database,
      undefined,
      authConfig,
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

  async function tenant(role: 'OWNER' | 'ADMIN' | 'AGENT' = 'OWNER', status: 'active' | 'disabled' = 'active') {
    const user = requireInserted(
      (await database.db.insert(users).values({
        emailNormalized: `whatsapp-${randomUUID()}@test.local`,
        passwordHash: 'not-used-by-whatsapp-tests',
        emailVerifiedAt: new Date(),
      }).returning())[0],
      'WhatsApp test user',
    );
    const organization = requireInserted(
      (await database.db.insert(organizations).values({
        name: `Business ${randomUUID()}`,
        slug: `business-${randomUUID()}`,
      }).returning())[0],
      'WhatsApp test Organization',
    );
    await database.db.insert(organizationMembers).values({ organizationId: organization.id, userId: user.id, role, status });
    const sessionToken = randomBytes(32).toString('base64url');
    await database.db.insert(sessions).values({
      userId: user.id,
      tokenHash: createHash('sha256').update(sessionToken).digest('base64url'),
      expiresAt: new Date(Date.now() + 60_000),
    });
    createdUserIds.add(user.id);
    createdOrganizationIds.add(organization.id);
    return { user, organization, sessionToken };
  }

  function sessionCookie(sessionToken: string): string {
    return `${authConfig.session.cookieName}=${sessionToken}`;
  }

  function verifiedResult(phoneSuffix: string = randomUUID()): VerifiedWhatsAppConnectionResult {
    return {
      provider: 'META',
      source: 'EXISTING_BUSINESS_APP',
      externalWabaId: `waba-${phoneSuffix}`,
      externalPhoneNumberId: `phone-${phoneSuffix}`,
      displayPhoneNumber: '+27000000000',
      credentialReference: providerCredentialReference(`credential-reference-${phoneSuffix}`),
    };
  }

  async function contextFor(userId: string, organizationId: string): Promise<TrustedOrganizationContext> {
    return application.get(OrganizationContextService).resolveForPermission(userId, organizationId, 'whatsapp.manage');
  }

  it('keeps Organizations valid with no connection, permits OWNER/ADMIN reads, and never exposes a credential reference', async () => {
    const owner = await tenant('OWNER');
    const admin = await tenant('ADMIN');
    await database.db.insert(organizationMembers).values({ organizationId: owner.organization.id, userId: admin.user.id, role: 'ADMIN', status: 'active' });

    const server = application.getHttpAdapter().getInstance();
    const beforeConnection = await server.inject({
      method: 'GET',
      url: `/organizations/${owner.organization.id}/whatsapp-connection`,
      headers: { cookie: sessionCookie(owner.sessionToken) },
    });
    expect(beforeConnection.statusCode).toBe(404);

    const result = verifiedResult();
    await application.get(WhatsAppConnectionService).recordVerifiedProviderConnection(
      await contextFor(owner.user.id, owner.organization.id),
      result,
    );
    for (const sessionToken of [owner.sessionToken, admin.sessionToken]) {
      const response = await server.inject({
        method: 'GET',
        url: `/organizations/${owner.organization.id}/whatsapp-connection`,
        headers: { cookie: sessionCookie(sessionToken) },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        connection: expect.objectContaining({
          provider: 'META',
          connectionSource: 'EXISTING_BUSINESS_APP',
          connectionStatus: 'CONNECTED',
          displayPhoneNumber: '+27000000000',
        }),
      });
      expect(response.body).not.toContain(result.credentialReference);
      expect(response.body).not.toContain(result.externalWabaId);
      expect(response.body).not.toContain(result.externalPhoneNumberId);
    }
  });

  it('denies AGENT and inactive/cross-tenant callers without disclosing connection state', async () => {
    const owner = await tenant('OWNER');
    const agent = await tenant('AGENT');
    const inactive = await tenant('OWNER', 'disabled');
    const otherOwner = await tenant('OWNER');
    await database.db.insert(organizationMembers).values({ organizationId: owner.organization.id, userId: agent.user.id, role: 'AGENT', status: 'active' });
    await application.get(WhatsAppConnectionService).recordVerifiedProviderConnection(
      await contextFor(owner.user.id, owner.organization.id),
      verifiedResult(),
    );
    const server = application.getHttpAdapter().getInstance();
    const agentResponse = await server.inject({ method: 'GET', url: `/organizations/${owner.organization.id}/whatsapp-connection`, headers: { cookie: sessionCookie(agent.sessionToken) } });
    const crossTenantResponse = await server.inject({ method: 'GET', url: `/organizations/${owner.organization.id}/whatsapp-connection`, headers: { cookie: sessionCookie(otherOwner.sessionToken) } });
    const inactiveResponse = await server.inject({ method: 'GET', url: `/organizations/${inactive.organization.id}/whatsapp-connection`, headers: { cookie: sessionCookie(inactive.sessionToken) } });
    const malformedResponse = await server.inject({ method: 'GET', url: '/organizations/not-an-id/whatsapp-connection', headers: { cookie: sessionCookie(otherOwner.sessionToken) } });

    expect(agentResponse.statusCode).toBe(403);
    expect([crossTenantResponse.statusCode, inactiveResponse.statusCode, malformedResponse.statusCode]).toEqual([404, 404, 404]);
    expect(crossTenantResponse.json().error).toEqual(inactiveResponse.json().error);
    expect(crossTenantResponse.json().error).toEqual(malformedResponse.json().error);
    expect(crossTenantResponse.body).not.toContain(owner.organization.name);
  });

  it('records verified provider results atomically, idempotently, and with safe audit metadata', async () => {
    const owner = await tenant('OWNER');
    const service = application.get(WhatsAppConnectionService);
    const context = await contextFor(owner.user.id, owner.organization.id);
    const result = verifiedResult();
    const first = await service.recordVerifiedProviderConnection(context, result);
    const repeat = await service.recordVerifiedProviderConnection(context, result);
    const connectionRows = await database.db.select().from(whatsappConnections).where(eq(whatsappConnections.organizationId, owner.organization.id));
    const audits = await database.db.select().from(auditLogs).where(and(
      eq(auditLogs.organizationId, owner.organization.id),
      eq(auditLogs.action, 'whatsapp.connection.created'),
    ));

    expect(repeat.id).toBe(first.id);
    expect(connectionRows).toHaveLength(1);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ targetType: 'whatsapp_connection', targetId: first.id, metadata: { provider: 'META', source: 'EXISTING_BUSINESS_APP', status: 'CONNECTED' } });
    expect(JSON.stringify(audits[0]?.metadata)).not.toContain(result.credentialReference);
    expect(JSON.stringify(audits[0]?.metadata)).not.toContain(result.externalWabaId);
    expect(JSON.stringify(audits[0]?.metadata)).not.toContain(result.externalPhoneNumberId);
  });

  it('permits verified completion only from VERIFYING and atomically audits that status transition', async () => {
    const verifyingOwner = await tenant('OWNER');
    const pendingOwner = await tenant('OWNER');
    const service = application.get(WhatsAppConnectionService);
    const verifyingResult = verifiedResult('verifying-connection');
    const pendingResult = verifiedResult('pending-connection');
    await database.db.insert(whatsappConnections).values({
      organizationId: verifyingOwner.organization.id,
      provider: verifyingResult.provider,
      connectionSource: verifyingResult.source,
      connectionStatus: 'VERIFYING',
      externalWabaId: verifyingResult.externalWabaId,
      externalPhoneNumberId: verifyingResult.externalPhoneNumberId,
      credentialReference: verifyingResult.credentialReference,
    });
    await database.db.insert(whatsappConnections).values({
      organizationId: pendingOwner.organization.id,
      provider: pendingResult.provider,
      connectionSource: pendingResult.source,
      connectionStatus: 'PENDING',
      externalWabaId: pendingResult.externalWabaId,
      externalPhoneNumberId: pendingResult.externalPhoneNumberId,
      credentialReference: pendingResult.credentialReference,
    });

    const completed = await service.recordVerifiedProviderConnection(
      await contextFor(verifyingOwner.user.id, verifyingOwner.organization.id),
      verifyingResult,
    );
    await expect(service.recordVerifiedProviderConnection(
      await contextFor(pendingOwner.user.id, pendingOwner.organization.id),
      pendingResult,
    )).rejects.toMatchObject({ status: 400, response: { code: 'WHATSAPP_CONNECTION_STATUS_TRANSITION_INVALID' } });

    const statusAudit = requireInserted(
      (await database.db.select().from(auditLogs).where(and(
        eq(auditLogs.organizationId, verifyingOwner.organization.id),
        eq(auditLogs.action, 'whatsapp.connection.status_changed'),
      )))[0],
      'WhatsApp connection status audit',
    );
    expect(completed.connectionStatus).toBe('CONNECTED');
    expect(statusAudit).toMatchObject({
      targetId: completed.id,
      metadata: { provider: 'META', source: 'EXISTING_BUSINESS_APP', previousStatus: 'VERIFYING', status: 'CONNECTED' },
    });
  });

  it('rejects duplicate external phones, unsupported sources, invalid provider data, and browser-manufactured connection state', async () => {
    const firstOwner = await tenant('OWNER');
    const secondOwner = await tenant('OWNER');
    const service = application.get(WhatsAppConnectionService);
    const firstResult = verifiedResult('shared-phone');
    await service.recordVerifiedProviderConnection(await contextFor(firstOwner.user.id, firstOwner.organization.id), firstResult);
    await expect(service.recordVerifiedProviderConnection(
      await contextFor(secondOwner.user.id, secondOwner.organization.id),
      firstResult,
    )).rejects.toMatchObject({ status: 409, response: { code: 'WHATSAPP_CONNECTION_CONFLICT' } });
    await expect(service.recordVerifiedProviderConnection(
      await contextFor(secondOwner.user.id, secondOwner.organization.id),
      { ...verifiedResult(), source: 'NEW_NUMBER' },
    )).rejects.toMatchObject({ status: 400, response: { code: 'WHATSAPP_CONNECTION_INPUT_INVALID' } });
    await expect(service.recordVerifiedProviderConnection(
      await contextFor(secondOwner.user.id, secondOwner.organization.id),
      { ...verifiedResult(), externalPhoneNumberId: 'invalid phone identifier' },
    )).rejects.toMatchObject({ status: 400, response: { code: 'WHATSAPP_CONNECTION_INPUT_INVALID' } });

    const server = application.getHttpAdapter().getInstance();
    const publicWriteAttempt = await server.inject({
      method: 'POST',
      url: `/organizations/${secondOwner.organization.id}/whatsapp-connection`,
      headers: { cookie: sessionCookie(secondOwner.sessionToken) },
      payload: { connectionStatus: 'CONNECTED', externalPhoneNumberId: 'browser-supplied' },
    });
    expect(publicWriteAttempt.statusCode).toBe(404);
    expect(await database.db.select().from(whatsappConnections).where(eq(whatsappConnections.organizationId, secondOwner.organization.id))).toEqual([]);
  });
});

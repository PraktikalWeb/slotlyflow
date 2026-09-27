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
} from '@slotlyflow/database';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../src/application.js';
import { OrganizationContextService } from '../src/organizations/organization-context.service.js';
import { DrizzleOrganizationRepository } from '../src/organizations/organization.repository.js';
import { OrganizationService } from '../src/organizations/organization.service.js';

const databaseUrl = process.env.DATABASE_URL;
const databaseName = databaseUrl === undefined ? '' : new URL(databaseUrl).pathname.replace(/^\//, '');
const describeDatabase = databaseUrl !== undefined && databaseName.endsWith('_test') ? describe : describe.skip;

function requireInserted<T>(value: T | undefined, description: string): T {
  if (value === undefined) throw new Error(`Expected ${description}.`);
  return value;
}

describeDatabase('01D-A organization creation and membership resolution', () => {
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
    const userIds = [...createdUserIds];
    const organizationIds = [...createdOrganizationIds];
    createdUserIds.clear();
    createdOrganizationIds.clear();

    if (organizationIds.length > 0 || userIds.length > 0) {
      const auditConditions = [];
      if (organizationIds.length > 0) auditConditions.push(inArray(auditLogs.organizationId, organizationIds));
      if (userIds.length > 0) auditConditions.push(inArray(auditLogs.actorUserId, userIds));
      if (auditConditions.length === 1) await database.db.delete(auditLogs).where(auditConditions[0]);
      if (auditConditions.length === 2) await database.db.delete(auditLogs).where(or(auditConditions[0], auditConditions[1]));
    }
    if (organizationIds.length > 0 || userIds.length > 0) {
      const membershipConditions = [];
      if (organizationIds.length > 0) membershipConditions.push(inArray(organizationMembers.organizationId, organizationIds));
      if (userIds.length > 0) membershipConditions.push(inArray(organizationMembers.userId, userIds));
      if (membershipConditions.length === 1) await database.db.delete(organizationMembers).where(membershipConditions[0]);
      if (membershipConditions.length === 2) await database.db.delete(organizationMembers).where(or(membershipConditions[0], membershipConditions[1]));
    }
    if (organizationIds.length > 0) await database.db.delete(organizations).where(inArray(organizations.id, organizationIds));
    if (userIds.length > 0) {
      await database.db.delete(sessions).where(inArray(sessions.userId, userIds));
      await database.db.delete(users).where(inArray(users.id, userIds));
    }
  });

  afterAll(async () => {
    await application?.close();
    await database?.close();
  });

  async function actor(): Promise<{ id: string; sessionToken: string }> {
    const email = `organization-${randomUUID()}@test.local`;
    const user = requireInserted(
      (await database.db.insert(users).values({
        emailNormalized: email,
        passwordHash: 'not-used-by-organization-tests',
        emailVerifiedAt: new Date(),
      }).returning())[0],
      'organization test user',
    );
    const sessionToken = randomBytes(32).toString('base64url');
    await database.db.insert(sessions).values({
      userId: user.id,
      tokenHash: createHash('sha256').update(sessionToken).digest('base64url'),
      expiresAt: new Date(Date.now() + 60_000),
    });
    createdUserIds.add(user.id);
    return { id: user.id, sessionToken };
  }

  async function csrf(): Promise<{ cookie: string; token: string }> {
    const response = await application.getHttpAdapter().getInstance().inject({ method: 'GET', url: '/auth/csrf' });
    const payload = response.json() as { csrfToken?: unknown };
    const header = response.headers['set-cookie'];
    const cookies = header === undefined ? [] : Array.isArray(header) ? header.map(String) : [String(header)];
    const csrfCookie = cookies.find((cookie) => cookie.startsWith('slotlyflow_csrf='));
    const token = payload.csrfToken;
    if (typeof token !== 'string' || csrfCookie === undefined) throw new Error('Expected CSRF proof.');
    const csrfCookiePair = csrfCookie.split(';')[0];
    if (csrfCookiePair === undefined) throw new Error('Expected CSRF cookie pair.');
    return { token, cookie: csrfCookiePair };
  }

  function sessionCookie(sessionToken: string): string {
    return `${authConfig.session.cookieName}=${sessionToken}`;
  }

  function csrfHeaders(sessionToken: string, proof: { cookie: string; token: string }) {
    return {
      cookie: `${sessionCookie(sessionToken)}; ${proof.cookie}`,
      'x-csrf-token': proof.token,
    };
  }

  function recordOrganization(id: string): void {
    createdOrganizationIds.add(id);
  }

  async function createOrganization(sessionToken: string, name: string, slug: string) {
    const proof = await csrf();
    const response = await application.getHttpAdapter().getInstance().inject({
      method: 'POST',
      url: '/organizations',
      headers: csrfHeaders(sessionToken, proof),
      payload: { name, slug },
    });
    if (response.statusCode === 201) {
      const payload = response.json() as { organization?: { id?: unknown } };
      if (typeof payload.organization?.id === 'string') recordOrganization(payload.organization.id);
    }
    return response;
  }

  it('creates an organization atomically with the authenticated creator as its active OWNER and audits it', async () => {
    const creator = await actor();
    const spoofedUser = await actor();
    const response = await application.getHttpAdapter().getInstance().inject({
      method: 'POST',
      url: '/organizations',
      headers: csrfHeaders(creator.sessionToken, await csrf()),
      payload: { name: '  Example Studio  ', slug: '  EXAMPLE-STUDIO  ', userId: spoofedUser.id },
    });

    expect(response.statusCode).toBe(201);
    const payload = response.json() as {
      organization: { id: string; name: string; slug: string };
      membership: { organization: { id: string }; role: string; status: string };
    };
    recordOrganization(payload.organization.id);
    expect(payload).toEqual({
      organization: { id: payload.organization.id, name: 'Example Studio', slug: 'example-studio' },
      membership: {
        organization: { id: payload.organization.id, name: 'Example Studio', slug: 'example-studio' },
        role: 'OWNER',
        status: 'active',
      },
    });

    const member = requireInserted(
      (await database.db.select().from(organizationMembers).where(eq(organizationMembers.organizationId, payload.organization.id)))[0],
      'initial owner membership',
    );
    expect(member).toMatchObject({ userId: creator.id, role: 'OWNER', status: 'active' });
    expect(member.userId).not.toBe(spoofedUser.id);
    const audit = requireInserted(
      (await database.db.select().from(auditLogs).where(and(eq(auditLogs.organizationId, payload.organization.id), eq(auditLogs.action, 'organization.created'))))[0],
      'organization creation audit event',
    );
    expect(audit).toMatchObject({ actorUserId: creator.id, targetType: 'organization', targetId: payload.organization.id });
  });

  it('requires a real authenticated session and CSRF proof, validates input, and returns safe conflicts', async () => {
    const creator = await actor();
    const server = application.getHttpAdapter().getInstance();
    const unauthenticated = await server.inject({ method: 'POST', url: '/organizations', payload: { name: 'No Session', slug: 'no-session' } });
    expect(unauthenticated.statusCode).toBe(401);
    expect(unauthenticated.body).not.toContain('Postgres');

    const csrfRejected = await server.inject({
      method: 'POST',
      url: '/organizations',
      headers: { cookie: sessionCookie(creator.sessionToken) },
      payload: { name: 'No CSRF', slug: 'no-csrf' },
    });
    expect(csrfRejected.statusCode).toBe(403);

    const invalid = await server.inject({
      method: 'POST',
      url: '/organizations',
      headers: csrfHeaders(creator.sessionToken, await csrf()),
      payload: { name: 'Valid name', slug: 'not a slug' },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.body).not.toContain('Postgres');

    const first = await createOrganization(creator.sessionToken, 'Unique Studio', 'unique-studio');
    expect(first.statusCode).toBe(201);
    const duplicate = await createOrganization(creator.sessionToken, 'Other Studio', 'UNIQUE-STUDIO');
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ error: { code: 'ORGANIZATION_SLUG_UNAVAILABLE', message: 'The request could not be completed.' } });
    expect(duplicate.body).not.toContain('Postgres');
  });

  it('resolves zero, multiple, and inactive memberships without mixing unrelated users', async () => {
    const userA = await actor();
    const userB = await actor();
    const noOrganizations = await actor();
    const server = application.getHttpAdapter().getInstance();

    expect((await server.inject({ method: 'GET', url: '/organizations', headers: { cookie: sessionCookie(noOrganizations.sessionToken) } })).json())
      .toEqual({ organizations: [] });

    const organizationA = await createOrganization(userA.sessionToken, 'Alpha Studio', 'alpha-studio');
    const organizationASecond = await createOrganization(userA.sessionToken, 'Bravo Studio', 'bravo-studio');
    const organizationB = await createOrganization(userB.sessionToken, 'Charlie Studio', 'charlie-studio');
    expect([organizationA.statusCode, organizationASecond.statusCode, organizationB.statusCode]).toEqual([201, 201, 201]);

    const inactiveOrganization = requireInserted(
      (await database.db.insert(organizations).values({ name: 'Disabled Studio', slug: `disabled-${randomUUID()}` }).returning())[0],
      'inactive organization',
    );
    recordOrganization(inactiveOrganization.id);
    await database.db.insert(organizationMembers).values({
      organizationId: inactiveOrganization.id,
      userId: userA.id,
      role: 'AGENT',
      status: 'disabled',
    });

    const membershipsA = (await server.inject({ method: 'GET', url: '/organizations', headers: { cookie: sessionCookie(userA.sessionToken) } })).json() as {
      organizations: Array<{ organization: { slug: string }; role: string; status: string }>;
    };
    expect(membershipsA.organizations).toEqual(expect.arrayContaining([
      expect.objectContaining({ organization: expect.objectContaining({ slug: 'alpha-studio' }), role: 'OWNER', status: 'active' }),
      expect.objectContaining({ organization: expect.objectContaining({ slug: 'bravo-studio' }), role: 'OWNER', status: 'active' }),
      expect.objectContaining({ organization: expect.objectContaining({ id: inactiveOrganization.id }), role: 'AGENT', status: 'disabled' }),
    ]));
    expect(membershipsA.organizations).toHaveLength(3);

    const membershipsB = (await server.inject({ method: 'GET', url: '/organizations', headers: { cookie: sessionCookie(userB.sessionToken) } })).json() as {
      organizations: Array<{ organization: { slug: string } }>;
    };
    expect(membershipsB).toEqual({ organizations: [expect.objectContaining({ organization: expect.objectContaining({ slug: 'charlie-studio' }) })] });
    expect(JSON.stringify(membershipsB)).not.toContain('alpha-studio');
    expect(JSON.stringify(membershipsB)).not.toContain(inactiveOrganization.id);
  });

  it('relies on database constraints for duplicate membership integrity and rolls back an orphaned organization transaction', async () => {
    const creator = await actor();
    const service = application.get(OrganizationService);
    const created = await service.createForAuthenticatedUser(creator.id, { name: 'Integrity Studio', slug: 'integrity-studio' });
    recordOrganization(created.organization.id);

    await expect(database.db.insert(organizationMembers).values({
      organizationId: created.organization.id,
      userId: creator.id,
      role: 'OWNER',
      status: 'active',
    })).rejects.toThrow();

    const rollbackSlug = `rollback-${randomUUID()}`;
    await expect(service.createForAuthenticatedUser(randomUUID(), { name: 'Rollback Studio', slug: rollbackSlug })).rejects.toThrow();
    const rollbackRows = await database.db.select().from(organizations).where(eq(organizations.slug, rollbackSlug));
    expect(rollbackRows).toEqual([]);
  });

  it('derives the protected organization context from the session and persisted membership rather than request-supplied identity claims', async () => {
    const owner = await actor();
    const spoofedUser = await actor();
    const created = await createOrganization(owner.sessionToken, 'Context Studio', 'context-studio');
    await createOrganization(spoofedUser.sessionToken, 'Spoofed Studio', 'spoofed-studio');
    const organizationId = (created.json() as { organization: { id: string } }).organization.id;
    const spoofedMembership = requireInserted(
      (await database.db.select().from(organizationMembers).where(eq(organizationMembers.userId, spoofedUser.id)))[0],
      'spoofed membership',
    );

    const response = await application.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: `/organizations/${organizationId}`,
      headers: {
        cookie: sessionCookie(owner.sessionToken),
        'x-user-id': spoofedUser.id,
        'x-membership-id': spoofedMembership.id,
        'x-organization-role': 'AGENT',
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      organization: { id: organizationId, name: 'Context Studio', slug: 'context-studio' },
      membership: { role: 'OWNER', status: 'active' },
    });
  });

  it('returns indistinguishable non-disclosing denial for cross-tenant, guessed, inactive, and malformed organization access', async () => {
    const userA = await actor();
    const userB = await actor();
    const organizationA = await createOrganization(userA.sessionToken, 'Tenant Alpha', 'tenant-alpha');
    const organizationB = await createOrganization(userB.sessionToken, 'Tenant Bravo', 'tenant-bravo');
    const organizationAId = (organizationA.json() as { organization: { id: string } }).organization.id;
    const organizationBId = (organizationB.json() as { organization: { id: string } }).organization.id;
    const membershipB = requireInserted(
      (await database.db.select().from(organizationMembers).where(and(eq(organizationMembers.organizationId, organizationBId), eq(organizationMembers.userId, userB.id))))[0],
      'organization B membership',
    );
    const server = application.getHttpAdapter().getInstance();

    expect((await server.inject({ method: 'GET', url: `/organizations/${organizationAId}`, headers: { cookie: sessionCookie(userA.sessionToken) } })).statusCode).toBe(200);
    expect((await server.inject({ method: 'GET', url: `/organizations/${organizationBId}`, headers: { cookie: sessionCookie(userB.sessionToken) } })).statusCode).toBe(200);

    const crossTenant = await server.inject({
      method: 'GET',
      url: `/organizations/${organizationBId}`,
      headers: { cookie: sessionCookie(userA.sessionToken), 'x-membership-id': membershipB.id, 'x-user-id': userB.id, 'x-organization-role': 'OWNER' },
    });
    const guessed = await server.inject({ method: 'GET', url: `/organizations/${randomUUID()}`, headers: { cookie: sessionCookie(userA.sessionToken) } });
    const malformed = await server.inject({ method: 'GET', url: '/organizations/not-an-organization-id', headers: { cookie: sessionCookie(userA.sessionToken) } });
    expect([crossTenant.statusCode, guessed.statusCode, malformed.statusCode]).toEqual([404, 404, 404]);
    expect(crossTenant.json().error).toEqual(guessed.json().error);
    expect(crossTenant.json().error).toEqual(malformed.json().error);
    expect(crossTenant.body).not.toContain('Tenant Bravo');
    expect(crossTenant.body).not.toContain('Postgres');

    await database.db.update(organizationMembers).set({ status: 'disabled' }).where(and(
      eq(organizationMembers.organizationId, organizationAId),
      eq(organizationMembers.userId, userA.id),
    ));
    const inactive = await server.inject({ method: 'GET', url: `/organizations/${organizationAId}`, headers: { cookie: sessionCookie(userA.sessionToken) } });
    expect(inactive.statusCode).toBe(404);
    expect(inactive.json().error).toEqual(crossTenant.json().error);
  });

  it('uses the documented centralized role policy for active persisted memberships', async () => {
    const owner = await actor();
    const admin = await actor();
    const agent = await actor();
    const created = await createOrganization(owner.sessionToken, 'Roles Studio', 'roles-studio');
    const organizationId = (created.json() as { organization: { id: string } }).organization.id;
    await database.db.insert(organizationMembers).values([
      { organizationId, userId: admin.id, role: 'ADMIN', status: 'active' },
      { organizationId, userId: agent.id, role: 'AGENT', status: 'active' },
    ]);
    const server = application.getHttpAdapter().getInstance();

    for (const [actorRecord, expectedRole] of [[owner, 'OWNER'], [admin, 'ADMIN'], [agent, 'AGENT']] as const) {
      const response = await server.inject({ method: 'GET', url: `/organizations/${organizationId}`, headers: { cookie: sessionCookie(actorRecord.sessionToken) } });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ membership: { role: expectedRole, status: 'active' } });
    }

    const contexts = application.get(OrganizationContextService);
    await expect(contexts.resolveForPermission(agent.id, organizationId, 'organization.update')).rejects.toMatchObject({
      status: 403, response: { code: 'ORGANIZATION_PERMISSION_DENIED' },
    });
    await expect(contexts.resolveForPermission(admin.id, organizationId, 'organization.update')).resolves.toMatchObject({ role: 'ADMIN' });
    await expect(contexts.resolveForPermission(owner.id, organizationId, 'billing.manage')).resolves.toMatchObject({ role: 'OWNER' });
  });

  it('lists memberships only through an active persisted OWNER or ADMIN context and keeps membership lookup tenant-scoped', async () => {
    const ownerA = await actor();
    const adminA = await actor();
    const agentA = await actor();
    const inactiveA = await actor();
    const ownerB = await actor();
    const organizationA = await createOrganization(ownerA.sessionToken, 'Membership Alpha', `membership-alpha-${randomUUID()}`);
    const organizationB = await createOrganization(ownerB.sessionToken, 'Membership Bravo', `membership-bravo-${randomUUID()}`);
    const organizationAId = (organizationA.json() as { organization: { id: string } }).organization.id;
    const organizationBId = (organizationB.json() as { organization: { id: string } }).organization.id;

    await database.db.insert(organizationMembers).values([
      { organizationId: organizationAId, userId: adminA.id, role: 'ADMIN', status: 'active' },
      { organizationId: organizationAId, userId: agentA.id, role: 'AGENT', status: 'active' },
      { organizationId: organizationAId, userId: inactiveA.id, role: 'ADMIN', status: 'disabled' },
    ]);
    const membershipB = requireInserted(
      (await database.db.select().from(organizationMembers).where(and(
        eq(organizationMembers.organizationId, organizationBId),
        eq(organizationMembers.userId, ownerB.id),
      )))[0],
      'organization B owner membership',
    );
    const server = application.getHttpAdapter().getInstance();

    const ownerList = await server.inject({
      method: 'GET',
      url: `/organizations/${organizationAId}/memberships`,
      headers: { cookie: sessionCookie(ownerA.sessionToken) },
    });
    expect(ownerList.statusCode).toBe(200);
    expect(ownerList.json()).toMatchObject({
      memberships: expect.arrayContaining([
        expect.objectContaining({ user: expect.objectContaining({ id: ownerA.id }), role: 'OWNER', status: 'active' }),
        expect.objectContaining({ user: expect.objectContaining({ id: adminA.id }), role: 'ADMIN', status: 'active' }),
        expect.objectContaining({ user: expect.objectContaining({ id: agentA.id }), role: 'AGENT', status: 'active' }),
        expect.objectContaining({ user: expect.objectContaining({ id: inactiveA.id }), role: 'ADMIN', status: 'disabled' }),
      ]),
    });
    expect(ownerList.body).not.toContain('password_hash');

    const adminList = await server.inject({
      method: 'GET',
      url: `/organizations/${organizationAId}/memberships`,
      headers: { cookie: sessionCookie(adminA.sessionToken) },
    });
    expect(adminList.statusCode).toBe(200);

    const agentDenied = await server.inject({
      method: 'GET',
      url: `/organizations/${organizationAId}/memberships`,
      headers: {
        cookie: sessionCookie(agentA.sessionToken),
        'x-user-id': ownerA.id,
        'x-organization-role': 'OWNER',
        'x-organization-permission': 'membership.read',
      },
    });
    expect(agentDenied).toMatchObject({ statusCode: 403 });
    expect(agentDenied.json()).toMatchObject({ error: { code: 'ORGANIZATION_PERMISSION_DENIED' } });

    const crossTenant = await server.inject({
      method: 'GET',
      url: `/organizations/${organizationBId}/memberships`,
      headers: { cookie: sessionCookie(ownerA.sessionToken), 'x-membership-id': membershipB.id, 'x-user-id': ownerB.id },
    });
    const guessed = await server.inject({
      method: 'GET',
      url: `/organizations/${randomUUID()}/memberships`,
      headers: { cookie: sessionCookie(ownerA.sessionToken) },
    });
    const malformed = await server.inject({
      method: 'GET',
      url: '/organizations/not-an-organization-id/memberships',
      headers: { cookie: sessionCookie(ownerA.sessionToken) },
    });
    const inactive = await server.inject({
      method: 'GET',
      url: `/organizations/${organizationAId}/memberships`,
      headers: { cookie: sessionCookie(inactiveA.sessionToken) },
    });
    expect([crossTenant.statusCode, guessed.statusCode, malformed.statusCode, inactive.statusCode]).toEqual([404, 404, 404, 404]);
    expect(crossTenant.json().error).toEqual(guessed.json().error);
    expect(crossTenant.json().error).toEqual(malformed.json().error);
    expect(crossTenant.json().error).toEqual(inactive.json().error);
    expect(crossTenant.body).not.toContain('Membership Bravo');

    const repository = application.get(DrizzleOrganizationRepository);
    await expect(repository.findMembershipForOrganization(organizationAId, membershipB.id)).resolves.toBeUndefined();
    await expect(repository.findMembershipForOrganization(organizationBId, membershipB.id)).resolves.toMatchObject({
      id: membershipB.id,
      organizationId: organizationBId,
      user: { id: ownerB.id },
    });
  });

  it('protects the final active OWNER while allowing valid multiple-owner changes and limited ADMIN changes', async () => {
    const ownerA = await actor();
    const ownerB = await actor();
    const ownerC = await actor();
    const admin = await actor();
    const agent = await actor();
    const organization = await createOrganization(ownerA.sessionToken, 'Owner Safety', `owner-safety-${randomUUID()}`);
    const organizationId = (organization.json() as { organization: { id: string } }).organization.id;
    await database.db.insert(organizationMembers).values([
      { organizationId, userId: ownerB.id, role: 'OWNER', status: 'disabled' },
      { organizationId, userId: admin.id, role: 'ADMIN', status: 'active' },
      { organizationId, userId: agent.id, role: 'AGENT', status: 'active' },
    ]);
    const [ownerAMembership, ownerBMembership, adminMembership, agentMembership] = await Promise.all([
      database.db.select().from(organizationMembers).where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, ownerA.id))),
      database.db.select().from(organizationMembers).where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, ownerB.id))),
      database.db.select().from(organizationMembers).where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, admin.id))),
      database.db.select().from(organizationMembers).where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, agent.id))),
    ]);
    const ownerAId = requireInserted(ownerAMembership[0], 'active owner membership').id;
    const ownerBId = requireInserted(ownerBMembership[0], 'disabled owner membership').id;
    const adminId = requireInserted(adminMembership[0], 'admin membership').id;
    const agentId = requireInserted(agentMembership[0], 'agent membership').id;
    const server = application.getHttpAdapter().getInstance();

    const finalOwnerDemotion = await server.inject({
      method: 'PATCH',
      url: `/organizations/${organizationId}/memberships/${ownerAId}/role`,
      headers: csrfHeaders(ownerA.sessionToken, await csrf()),
      payload: { role: 'ADMIN' },
    });
    const finalOwnerDeactivation = await server.inject({
      method: 'PATCH',
      url: `/organizations/${organizationId}/memberships/${ownerAId}/deactivate`,
      headers: csrfHeaders(ownerA.sessionToken, await csrf()),
    });
    expect([finalOwnerDemotion.statusCode, finalOwnerDeactivation.statusCode]).toEqual([409, 409]);
    expect(finalOwnerDemotion.json()).toMatchObject({ error: { code: 'ORGANIZATION_LAST_ACTIVE_OWNER_REQUIRED' } });
    expect(finalOwnerDeactivation.json()).toMatchObject({ error: { code: 'ORGANIZATION_LAST_ACTIVE_OWNER_REQUIRED' } });

    await database.db.update(organizationMembers).set({ status: 'active' }).where(eq(organizationMembers.id, ownerBId));
    const permittedSelfDemotion = await server.inject({
      method: 'PATCH',
      url: `/organizations/${organizationId}/memberships/${ownerAId}/role`,
      headers: csrfHeaders(ownerA.sessionToken, await csrf()),
      payload: { role: 'ADMIN' },
    });
    expect(permittedSelfDemotion.statusCode).toBe(200);
    expect(permittedSelfDemotion.json()).toMatchObject({ membership: { id: ownerAId, role: 'ADMIN', status: 'active' } });

    await database.db.insert(organizationMembers).values({ organizationId, userId: ownerC.id, role: 'OWNER', status: 'active' });
    const permittedSelfDeactivation = await server.inject({
      method: 'PATCH',
      url: `/organizations/${organizationId}/memberships/${ownerBId}/deactivate`,
      headers: csrfHeaders(ownerB.sessionToken, await csrf()),
    });
    expect(permittedSelfDeactivation.statusCode).toBe(200);
    expect(permittedSelfDeactivation.json()).toMatchObject({ membership: { id: ownerBId, role: 'OWNER', status: 'disabled' } });

    const adminOwnerMutation = await server.inject({
      method: 'PATCH',
      url: `/organizations/${organizationId}/memberships/${ownerBId}/deactivate`,
      headers: csrfHeaders(admin.sessionToken, await csrf()),
    });
    const adminAgentPromotion = await server.inject({
      method: 'PATCH',
      url: `/organizations/${organizationId}/memberships/${agentId}/role`,
      headers: csrfHeaders(admin.sessionToken, await csrf()),
      payload: { role: 'OWNER' },
    });
    const adminSelfPromotion = await server.inject({
      method: 'PATCH',
      url: `/organizations/${organizationId}/memberships/${adminId}/role`,
      headers: csrfHeaders(admin.sessionToken, await csrf()),
      payload: { role: 'OWNER' },
    });
    const adminAgentChange = await server.inject({
      method: 'PATCH',
      url: `/organizations/${organizationId}/memberships/${agentId}/role`,
      headers: csrfHeaders(admin.sessionToken, await csrf()),
      payload: { role: 'ADMIN' },
    });
    expect([adminOwnerMutation.statusCode, adminAgentPromotion.statusCode, adminSelfPromotion.statusCode, adminAgentChange.statusCode]).toEqual([403, 403, 403, 200]);

    const foreignOwner = await actor();
    const foreignOrganization = await createOrganization(foreignOwner.sessionToken, 'Foreign Members', `foreign-members-${randomUUID()}`);
    const foreignOrganizationId = (foreignOrganization.json() as { organization: { id: string } }).organization.id;
    const foreignMembership = requireInserted(
      (await database.db.select().from(organizationMembers).where(and(
        eq(organizationMembers.organizationId, foreignOrganizationId),
        eq(organizationMembers.userId, foreignOwner.id),
      )))[0],
      'foreign owner membership',
    );
    const crossTenantMutation = await server.inject({
      method: 'PATCH',
      url: `/organizations/${foreignOrganizationId}/memberships/${foreignMembership.id}/role`,
      headers: {
        ...csrfHeaders(admin.sessionToken, await csrf()),
        'x-user-id': foreignOwner.id,
        'x-organization-role': 'OWNER',
      },
      payload: { role: 'ADMIN' },
    });
    expect(crossTenantMutation.statusCode).toBe(404);
    expect(crossTenantMutation.body).not.toContain('Foreign Members');
  });

  it('persists safe membership role-change and deactivation audit records in the mutation transaction', async () => {
    const ownerA = await actor();
    const ownerB = await actor();
    const targetUser = await actor();
    const organization = await createOrganization(ownerA.sessionToken, 'Audited Members', `audited-members-${randomUUID()}`);
    const organizationId = (organization.json() as { organization: { id: string } }).organization.id;
    await database.db.insert(organizationMembers).values([
      { organizationId, userId: ownerB.id, role: 'OWNER', status: 'active' },
      { organizationId, userId: targetUser.id, role: 'AGENT', status: 'active' },
    ]);
    const target = requireInserted(
      (await database.db.select().from(organizationMembers).where(and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, targetUser.id),
      )))[0],
      'audited target membership',
    );
    const server = application.getHttpAdapter().getInstance();

    const roleChange = await server.inject({
      method: 'PATCH',
      url: `/organizations/${organizationId}/memberships/${target.id}/role`,
      headers: csrfHeaders(ownerA.sessionToken, await csrf()),
      payload: { role: 'ADMIN' },
    });
    const deactivation = await server.inject({
      method: 'PATCH',
      url: `/organizations/${organizationId}/memberships/${target.id}/deactivate`,
      headers: csrfHeaders(ownerB.sessionToken, await csrf()),
    });
    expect([roleChange.statusCode, deactivation.statusCode]).toEqual([200, 200]);

    const audits = await database.db.select().from(auditLogs).where(and(
      eq(auditLogs.organizationId, organizationId),
      inArray(auditLogs.action, ['membership.role_changed', 'membership.deactivated']),
    ));
    const roleAudit = requireInserted(audits.find((audit) => audit.action === 'membership.role_changed'), 'role change audit event');
    const deactivationAudit = requireInserted(audits.find((audit) => audit.action === 'membership.deactivated'), 'deactivation audit event');
    expect(roleAudit).toMatchObject({
      organizationId,
      actorUserId: ownerA.id,
      targetType: 'organization_membership',
      targetId: target.id,
      metadata: {
        action: 'membership.role_changed',
        organizationId,
        actorUserId: ownerA.id,
        targetMembershipId: target.id,
        targetUserId: targetUser.id,
        previous: { role: 'AGENT', status: 'active' },
        resulting: { role: 'ADMIN', status: 'active' },
      },
    });
    expect(deactivationAudit).toMatchObject({
      organizationId,
      actorUserId: ownerB.id,
      targetType: 'organization_membership',
      targetId: target.id,
      metadata: {
        action: 'membership.deactivated',
        organizationId,
        actorUserId: ownerB.id,
        targetMembershipId: target.id,
        targetUserId: targetUser.id,
        previous: { role: 'ADMIN', status: 'active' },
        resulting: { role: 'ADMIN', status: 'disabled' },
      },
    });
    const persisted = requireInserted(
      (await database.db.select().from(organizationMembers).where(eq(organizationMembers.id, target.id)))[0],
      'persisted audited membership',
    );
    expect(persisted).toMatchObject({ role: 'ADMIN', status: 'disabled' });
    expect(JSON.stringify(audits)).not.toContain(ownerA.sessionToken);
    expect(JSON.stringify(audits)).not.toContain(ownerB.sessionToken);
    expect(JSON.stringify(audits)).not.toContain(targetUser.sessionToken);
    expect(JSON.stringify(roleAudit.metadata)).not.toContain('@test.local');
  });

  it('rolls back a membership mutation when its required audit insert fails', async () => {
    const ownerA = await actor();
    const ownerB = await actor();
    const targetUser = await actor();
    const organization = await createOrganization(ownerA.sessionToken, 'Audit Rollback', `audit-rollback-${randomUUID()}`);
    const organizationId = (organization.json() as { organization: { id: string } }).organization.id;
    await database.db.insert(organizationMembers).values([
      { organizationId, userId: ownerB.id, role: 'OWNER', status: 'active' },
      { organizationId, userId: targetUser.id, role: 'AGENT', status: 'active' },
    ]);
    const target = requireInserted(
      (await database.db.select().from(organizationMembers).where(and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, targetUser.id),
      )))[0],
      'rollback target membership',
    );
    const constraintName = 'audit_logs_reject_membership_role_changed_test';
    await database.db.execute(sql.raw(`alter table audit_logs drop constraint if exists ${constraintName}`));
    // Existing suite rows may legitimately contain this action. NOT VALID still
    // enforces the temporary failure condition for the new mutation audit row.
    await database.db.execute(sql.raw(`alter table audit_logs add constraint ${constraintName} check (action <> 'membership.role_changed') not valid`));
    try {
      const response = await application.getHttpAdapter().getInstance().inject({
        method: 'PATCH',
        url: `/organizations/${organizationId}/memberships/${target.id}/role`,
        headers: csrfHeaders(ownerA.sessionToken, await csrf()),
        payload: { role: 'ADMIN' },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'The request could not be completed.' } });
      expect(response.body).not.toContain('Postgres');

      const persisted = requireInserted(
        (await database.db.select().from(organizationMembers).where(eq(organizationMembers.id, target.id)))[0],
        'rolled back target membership',
      );
      expect(persisted).toMatchObject({ role: 'AGENT', status: 'active' });
      const mutationAudits = await database.db.select().from(auditLogs).where(and(
        eq(auditLogs.organizationId, organizationId),
        eq(auditLogs.targetId, target.id),
      ));
      expect(mutationAudits).toEqual([]);
    } finally {
      await database.db.execute(sql.raw(`alter table audit_logs drop constraint if exists ${constraintName}`));
    }
  });

  it('requires session, CSRF, active membership, and trusted permissions for membership mutation', async () => {
    const owner = await actor();
    const agent = await actor();
    const organization = await createOrganization(owner.sessionToken, 'Mutation Security', `mutation-security-${randomUUID()}`);
    const organizationId = (organization.json() as { organization: { id: string } }).organization.id;
    await database.db.insert(organizationMembers).values({ organizationId, userId: agent.id, role: 'AGENT', status: 'active' });
    const agentMembership = requireInserted(
      (await database.db.select().from(organizationMembers).where(and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, agent.id),
      )))[0],
      'agent membership for mutation security',
    );
    const server = application.getHttpAdapter().getInstance();
    const endpoint = `/organizations/${organizationId}/memberships/${agentMembership.id}/role`;

    const unauthenticated = await server.inject({ method: 'PATCH', url: endpoint, payload: { role: 'ADMIN' } });
    const missingCsrf = await server.inject({
      method: 'PATCH', url: endpoint, headers: { cookie: sessionCookie(owner.sessionToken) }, payload: { role: 'ADMIN' },
    });
    const spoofedAgent = await server.inject({
      method: 'PATCH',
      url: endpoint,
      headers: {
        ...csrfHeaders(agent.sessionToken, await csrf()),
        'x-user-id': owner.id,
        'x-organization-role': 'OWNER',
        'x-organization-permission': 'membership.update_role',
      },
      payload: { role: 'OWNER' },
    });
    const invalidRole = await server.inject({
      method: 'PATCH',
      url: endpoint,
      headers: csrfHeaders(owner.sessionToken, await csrf()),
      payload: { role: 'UNTRUSTED_OWNER' },
    });
    expect([unauthenticated.statusCode, missingCsrf.statusCode, spoofedAgent.statusCode, invalidRole.statusCode]).toEqual([401, 403, 403, 400]);
    expect(spoofedAgent.json()).toMatchObject({ error: { code: 'ORGANIZATION_PERMISSION_DENIED' } });
    expect(spoofedAgent.body).not.toContain(owner.id);

    await database.db.update(organizationMembers).set({ status: 'disabled' }).where(eq(organizationMembers.id, agentMembership.id));
    const inactive = await server.inject({
      method: 'PATCH',
      url: endpoint,
      headers: csrfHeaders(agent.sessionToken, await csrf()),
      payload: { role: 'ADMIN' },
    });
    expect(inactive.statusCode).toBe(404);

    await database.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, owner.id));
    const revoked = await server.inject({
      method: 'PATCH',
      url: endpoint,
      headers: csrfHeaders(owner.sessionToken, await csrf()),
      payload: { role: 'ADMIN' },
    });
    expect(revoked.statusCode).toBe(401);
    const persisted = requireInserted(
      (await database.db.select().from(organizationMembers).where(eq(organizationMembers.id, agentMembership.id)))[0],
      'security-checked membership',
    );
    expect(persisted).toMatchObject({ role: 'AGENT', status: 'disabled' });
  });

  it('serializes concurrent owner demotions so at least one active OWNER remains committed', async () => {
    const ownerA = await actor();
    const ownerB = await actor();
    const organization = await createOrganization(ownerA.sessionToken, 'Concurrent Owners', `concurrent-owners-${randomUUID()}`);
    const organizationId = (organization.json() as { organization: { id: string } }).organization.id;
    await database.db.insert(organizationMembers).values({ organizationId, userId: ownerB.id, role: 'OWNER', status: 'active' });
    const [ownerAMembership, ownerBMembership] = await Promise.all([
      database.db.select().from(organizationMembers).where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, ownerA.id))),
      database.db.select().from(organizationMembers).where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, ownerB.id))),
    ]);
    const ownerAId = requireInserted(ownerAMembership[0], 'first concurrent owner membership').id;
    const ownerBId = requireInserted(ownerBMembership[0], 'second concurrent owner membership').id;
    const server = application.getHttpAdapter().getInstance();

    const [first, second] = await Promise.all([
      server.inject({
        method: 'PATCH',
        url: `/organizations/${organizationId}/memberships/${ownerAId}/role`,
        headers: csrfHeaders(ownerA.sessionToken, await csrf()),
        payload: { role: 'ADMIN' },
      }),
      server.inject({
        method: 'PATCH',
        url: `/organizations/${organizationId}/memberships/${ownerBId}/role`,
        headers: csrfHeaders(ownerB.sessionToken, await csrf()),
        payload: { role: 'ADMIN' },
      }),
    ]);
    expect([first.statusCode, second.statusCode].sort()).toEqual([200, 409]);
    const losingResponse = first.statusCode === 409 ? first : second;
    expect(losingResponse.json()).toMatchObject({ error: { code: 'ORGANIZATION_LAST_ACTIVE_OWNER_REQUIRED' } });

    const activeOwners = await database.db.select().from(organizationMembers).where(and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.role, 'OWNER'),
      eq(organizationMembers.status, 'active'),
    ));
    expect(activeOwners).toHaveLength(1);
    const successful = first.statusCode === 200 ? first : second;
    const successfulMembershipId = (successful.json() as { membership: { id: string } }).membership.id;
    const successfulAudit = await database.db.select().from(auditLogs).where(and(
      eq(auditLogs.organizationId, organizationId),
      eq(auditLogs.action, 'membership.role_changed'),
      eq(auditLogs.targetId, successfulMembershipId),
    ));
    expect(successfulAudit).toHaveLength(1);
  });
});

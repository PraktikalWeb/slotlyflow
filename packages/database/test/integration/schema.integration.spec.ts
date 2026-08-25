import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  auditLogs,
  emailVerificationTokens,
  organizationMembers,
  organizations,
  passwordResetTokens,
  sessions,
  users,
} from '../../src/schema/index.js';

const databaseUrl = process.env.DATABASE_URL;
const databaseName = databaseUrl === undefined ? '' : new URL(databaseUrl).pathname.replace(/^\//, '');
const describeDatabase = databaseUrl !== undefined && databaseName.endsWith('_test') ? describe : describe.skip;

function requireInserted<T>(record: T | undefined): T {
  if (record === undefined) {
    throw new Error('Expected database insert to return a row.');
  }

  return record;
}

describeDatabase('initial Phase 01 schema', () => {
  const client = postgres(databaseUrl ?? '', { max: 1 });
  const db = drizzle({ client });
  const expiresAt = new Date('2030-01-01T00:00:00.000Z');

  beforeAll(async () => {
    await client.unsafe('drop schema public cascade');
    await client.unsafe('drop schema if exists drizzle cascade');
    await client.unsafe('create schema public');
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../src/migrations/', import.meta.url)) });
  });

  afterAll(async () => {
    await client.end({ timeout: 5 });
  });

  it('migrates an empty test database with all documented tables', async () => {
    const tables = await client<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
    `;

    expect(tables.map((table) => table.table_name)).toEqual(
      expect.arrayContaining([
        'users',
        'organizations',
        'organization_members',
        'sessions',
        'email_verification_tokens',
        'password_reset_tokens',
        'audit_logs',
      ]),
    );
  });

  it('uses timezone-aware timestamps and creates the required lookup indexes', async () => {
    const timestamps = await client<{ table_name: string; column_name: string }[]>`
      select table_name, column_name from information_schema.columns
      where table_schema = 'public'
        and data_type = 'timestamp with time zone'
    `;
    const indexes = await client<{ indexname: string }[]>`
      select indexname from pg_indexes where schemaname = 'public'
    `;

    expect(timestamps.map((column) => `${column.table_name}.${column.column_name}`)).toEqual(
      expect.arrayContaining([
        'users.created_at',
        'organizations.updated_at',
        'organization_members.created_at',
        'sessions.expires_at',
        'email_verification_tokens.used_at',
        'password_reset_tokens.used_at',
        'audit_logs.created_at',
      ]),
    );
    expect(indexes.map((index) => index.indexname)).toEqual(
      expect.arrayContaining([
        'users_email_normalized_unique',
        'organizations_slug_unique',
        'organization_members_organization_user_unique',
        'organization_members_organization_id_idx',
        'organization_members_user_id_idx',
        'sessions_user_id_idx',
        'sessions_expires_at_idx',
        'email_verification_tokens_token_hash_unique',
        'password_reset_tokens_token_hash_unique',
        'audit_logs_organization_created_at_idx',
      ]),
    );
  });

  it('enforces unique identifiers, membership role values, and foreign keys', async () => {
    const user = requireInserted(
      (await db
        .insert(users)
        .values({ emailNormalized: 'owner@example.test', passwordHash: 'test-password-hash' })
        .returning())[0],
    );
    const organization = requireInserted(
      (await db
        .insert(organizations)
        .values({ name: 'Example Organization', slug: 'example-organization' })
        .returning())[0],
    );

    await expect(
      db.insert(users).values({ emailNormalized: 'owner@example.test', passwordHash: 'other-hash' }),
    ).rejects.toThrow();
    await expect(
      db.insert(organizations).values({ name: 'Other Organization', slug: 'example-organization' }),
    ).rejects.toThrow();

    await db.insert(organizationMembers).values({ organizationId: organization.id, userId: user.id, role: 'OWNER' });
    await expect(
      db.insert(organizationMembers).values({ organizationId: organization.id, userId: user.id, role: 'OWNER' }),
    ).rejects.toThrow();
    await expect(
      client.unsafe(
        'insert into organization_members (organization_id, user_id, role) values ($1, $2, $3)',
        [organization.id, user.id, 'INVALID'],
      ),
    ).rejects.toThrow();
    await expect(
      client.unsafe(
        'insert into organization_members (organization_id, user_id, role) values ($1, $2, $3)',
        ['00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'OWNER'],
      ),
    ).rejects.toThrow();
    await expect(
      client.unsafe(
        'insert into organization_members (organization_id, user_id, role, status) values ($1, $2, $3, $4)',
        [organization.id, user.id, 'ADMIN', 'INVALID'],
      ),
    ).rejects.toThrow();
  });

  it('persists session lifecycle, one-time token, and audit reference fields', async () => {
    const user = requireInserted(
      (await db
        .insert(users)
        .values({ emailNormalized: 'audit@example.test', passwordHash: 'test-password-hash' })
        .returning())[0],
    );
    const organization = requireInserted(
      (await db
        .insert(organizations)
        .values({ name: 'Audit Organization', slug: 'audit-organization' })
        .returning())[0],
    );

    await db.insert(sessions).values({
      userId: user.id,
      tokenHash: 'session-token-hash',
      expiresAt,
      revokedAt: new Date('2029-01-01T00:00:00.000Z'),
      lastUsedAt: new Date('2029-01-02T00:00:00.000Z'),
    });
    await db.insert(emailVerificationTokens).values({
      userId: user.id,
      tokenHash: 'verification-token-hash',
      expiresAt,
      usedAt: new Date('2029-01-03T00:00:00.000Z'),
    });
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: 'reset-token-hash',
      expiresAt,
      usedAt: new Date('2029-01-04T00:00:00.000Z'),
    });
    await db.insert(auditLogs).values({
      organizationId: organization.id,
      actorUserId: user.id,
      action: 'test.action',
      targetType: 'test',
      targetId: user.id,
      metadata: { source: 'integration-test' },
    });

    const [storedSession] = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    const [storedVerificationToken] = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.id));
    const [storedResetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));
    const [storedAuditLog] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.organizationId, organization.id), eq(auditLogs.actorUserId, user.id)));

    expect(storedSession).toMatchObject({ tokenHash: 'session-token-hash', expiresAt, revokedAt: expect.any(Date) });
    expect(storedVerificationToken).toMatchObject({ tokenHash: 'verification-token-hash', usedAt: expect.any(Date) });
    expect(storedResetToken).toMatchObject({ tokenHash: 'reset-token-hash', usedAt: expect.any(Date) });
    expect(storedAuditLog).toMatchObject({ action: 'test.action', metadata: { source: 'integration-test' } });
    await expect(
      db.insert(auditLogs).values({
        organizationId: '00000000-0000-0000-0000-000000000000',
        actorUserId: user.id,
        action: 'test.invalid-reference',
        targetType: 'test',
        metadata: {},
      }),
    ).rejects.toThrow();
  });
});

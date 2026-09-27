import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  auditLogs,
  conversations,
  emailVerificationTokens,
  organizationMembers,
  organizations,
  passwordResetTokens,
  sessions,
  messages,
  outboundMessageRequests,
  users,
  whatsappConnections,
  whatsappOnboardingTransactions,
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
        'whatsapp_connections',
        'whatsapp_onboarding_transactions',
        'conversations',
        'messages',
        'outbound_message_requests',
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
        'whatsapp_onboarding_transactions.expires_at',
        'conversations.last_message_at',
        'messages.provider_timestamp',
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
        'whatsapp_connections_organization_id_unique',
        'whatsapp_connections_provider_phone_number_unique',
        'whatsapp_connections_organization_status_idx',
        'whatsapp_onboarding_transactions_active_organization_unique',
        'whatsapp_onboarding_tx_org_status_expires_idx',
        'whatsapp_onboarding_transactions_actor_user_id_idx',
        'conversations_org_connection_customer_unique',
        'conversations_organization_last_message_idx',
        'messages_provider_message_id_unique',
        'messages_organization_conversation_created_idx',
        'messages_outbound_provider_status_idx',
        'outbound_message_requests_organization_idempotency_unique',
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

  it('enforces organization-owned WhatsApp connection integrity without storing credentials', async () => {
    const organization = requireInserted(
      (await db.insert(organizations).values({ name: 'Connected Business', slug: 'connected-business' }).returning())[0],
    );
    const otherOrganization = requireInserted(
      (await db.insert(organizations).values({ name: 'Other Business', slug: 'other-business' }).returning())[0],
    );
    const connected = requireInserted(
      (await db.insert(whatsappConnections).values({
        organizationId: organization.id,
        provider: 'META',
        connectionSource: 'EXISTING_BUSINESS_APP',
        connectionStatus: 'CONNECTED',
        externalWabaId: 'waba-integration-test',
        externalPhoneNumberId: 'phone-integration-test',
        displayPhoneNumber: '+27000000000',
        credentialReference: 'credential-reference-integration-test',
      }).returning())[0],
    );

    expect(connected).toMatchObject({
      organizationId: organization.id,
      provider: 'META',
      connectionSource: 'EXISTING_BUSINESS_APP',
      connectionStatus: 'CONNECTED',
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    await expect(db.insert(whatsappConnections).values({
      organizationId: organization.id,
      provider: 'META',
      connectionSource: 'EXISTING_BUSINESS_APP',
      connectionStatus: 'PENDING',
    })).rejects.toThrow();
    await expect(db.insert(whatsappConnections).values({
      organizationId: otherOrganization.id,
      provider: 'META',
      connectionSource: 'EXISTING_BUSINESS_APP',
      connectionStatus: 'CONNECTED',
      externalWabaId: 'another-waba',
      externalPhoneNumberId: 'phone-integration-test',
      credentialReference: 'another-credential-reference',
    })).rejects.toThrow();
    await expect(client.unsafe(
      'insert into whatsapp_connections (organization_id, provider, connection_source, connection_status) values ($1, $2, $3, $4)',
      [otherOrganization.id, 'META', 'UNKNOWN_SOURCE', 'PENDING'],
    )).rejects.toThrow();
    await expect(client.unsafe(
      'insert into whatsapp_connections (organization_id, provider, connection_source, connection_status) values ($1, $2, $3, $4)',
      [otherOrganization.id, 'META', 'EXISTING_BUSINESS_APP', 'CONNECTED'],
    )).rejects.toThrow();
    await expect(db.insert(whatsappConnections).values({
      organizationId: '00000000-0000-0000-0000-000000000000',
      provider: 'META',
      connectionSource: 'EXISTING_BUSINESS_APP',
      connectionStatus: 'PENDING',
    })).rejects.toThrow();
  });

  it('keeps WhatsApp onboarding attempts durable, scoped, expiring, and single-active per Business', async () => {
    const user = requireInserted(
      (await db.insert(users).values({ emailNormalized: 'onboarding-owner@example.test', passwordHash: 'test-password-hash' }).returning())[0],
    );
    const otherUser = requireInserted(
      (await db.insert(users).values({ emailNormalized: 'onboarding-other@example.test', passwordHash: 'test-password-hash' }).returning())[0],
    );
    const organization = requireInserted(
      (await db.insert(organizations).values({ name: 'Onboarding Business', slug: 'onboarding-business' }).returning())[0],
    );
    const expiresAt = new Date(Date.now() + 60_000);
    const started = requireInserted(
      (await db.insert(whatsappOnboardingTransactions).values({
        organizationId: organization.id,
        actorUserId: user.id,
        provider: 'META',
        connectionSource: 'EXISTING_BUSINESS_APP',
        status: 'STARTED',
        expiresAt,
      }).returning())[0],
    );

    expect(started).toMatchObject({
      organizationId: organization.id,
      actorUserId: user.id,
      provider: 'META',
      connectionSource: 'EXISTING_BUSINESS_APP',
      status: 'STARTED',
      expiresAt,
    });
    await expect(db.insert(whatsappOnboardingTransactions).values({
      organizationId: organization.id,
      actorUserId: user.id,
      provider: 'META',
      connectionSource: 'EXISTING_BUSINESS_APP',
      status: 'STARTED',
      expiresAt: new Date(Date.now() + 120_000),
    })).rejects.toThrow();
    await expect(db.insert(whatsappOnboardingTransactions).values({
      organizationId: organization.id,
      actorUserId: otherUser.id,
      provider: 'META',
      connectionSource: 'EXISTING_BUSINESS_APP',
      status: 'EXPIRED',
      expiresAt: new Date(Date.now() + 180_000),
    })).resolves.toBeDefined();
    await expect(db.insert(whatsappOnboardingTransactions).values({
      organizationId: '00000000-0000-0000-0000-000000000000',
      actorUserId: user.id,
      provider: 'META',
      connectionSource: 'EXISTING_BUSINESS_APP',
      status: 'STARTED',
      expiresAt: new Date(Date.now() + 240_000),
    })).rejects.toThrow();
    await expect(db.insert(whatsappOnboardingTransactions).values({
      organizationId: organization.id,
      actorUserId: user.id,
      provider: 'META',
      connectionSource: 'EXISTING_BUSINESS_APP',
      status: 'CANCELLED',
      expiresAt: new Date(0),
    })).rejects.toThrow();
  });

  it('keeps outbound message idempotency and provider status lifecycle tenant-scoped', async () => {
    const organization = requireInserted(
      (await db.insert(organizations).values({ name: 'Outbound Business', slug: 'outbound-business' }).returning())[0],
    );
    const connection = requireInserted(
      (await db.insert(whatsappConnections).values({
        organizationId: organization.id,
        provider: 'META',
        connectionSource: 'EXISTING_BUSINESS_APP',
        connectionStatus: 'CONNECTED',
        externalWabaId: 'outbound-waba',
        externalPhoneNumberId: 'outbound-phone',
        credentialReference: 'outbound-credential',
      }).returning())[0],
    );
    const conversation = requireInserted(
      (await db.insert(conversations).values({
        organizationId: organization.id,
        whatsappConnectionId: connection.id,
        customerWhatsAppId: '16505551234',
        lastMessageAt: new Date(),
      }).returning())[0],
    );
    const message = requireInserted(
      (await db.insert(messages).values({
        organizationId: organization.id,
        conversationId: conversation.id,
        whatsappConnectionId: connection.id,
        provider: 'META',
        providerMessageId: 'wamid.outbound-integration',
        direction: 'OUTBOUND',
        messageType: 'TEXT',
        textBody: 'Reply',
        outboundStatus: 'ACCEPTED',
        outboundStatusUpdatedAt: new Date(),
        providerTimestamp: new Date(),
      }).returning())[0],
    );
    await db.insert(outboundMessageRequests).values({
      organizationId: organization.id,
      conversationId: conversation.id,
      whatsappConnectionId: connection.id,
      idempotencyKey: 'outbound-integration-key',
      textBody: 'Reply',
      state: 'COMPLETED',
      messageId: message.id,
      completedAt: new Date(),
    });
    await expect(db.insert(outboundMessageRequests).values({
      organizationId: organization.id,
      conversationId: conversation.id,
      whatsappConnectionId: connection.id,
      idempotencyKey: 'outbound-integration-key',
      textBody: 'Duplicate',
    })).rejects.toThrow();
    await expect(client.unsafe(
      'update messages set outbound_status = $1, outbound_status_updated_at = now() where id = $2',
      ['SENT', message.id],
    )).resolves.toBeDefined();
    const inbound = requireInserted(
      (await db.insert(messages).values({
        organizationId: organization.id,
        conversationId: conversation.id,
        whatsappConnectionId: connection.id,
        provider: 'META',
        providerMessageId: 'wamid.inbound-integration',
        direction: 'INBOUND',
        messageType: 'TEXT',
        textBody: 'Inbound',
        providerTimestamp: new Date(),
      }).returning())[0],
    );
    await expect(client.unsafe(
      'update messages set outbound_status = $1, outbound_status_updated_at = now() where id = $2',
      ['DELIVERED', inbound.id],
    )).rejects.toThrow();
  });
});

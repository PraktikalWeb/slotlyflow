import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL;
const databaseName = databaseUrl === undefined ? '' : new URL(databaseUrl).pathname.replace(/^\//, '');
const describeDatabase = databaseUrl !== undefined && databaseName.endsWith('_test') ? describe : describe.skip;
const hash = (value: string): string => createHash('sha256').update(value).digest('base64url');

function requireInserted<T>(record: T | undefined): T {
  if (record === undefined) throw new Error('Expected database insert to return a row.');
  return record;
}

describeDatabase('Phase 01C authentication persistence', () => {
  const client = postgres(databaseUrl ?? '', { max: 1 });
  const db = drizzle({ client });

  beforeAll(async () => {
    await client.unsafe('drop schema public cascade');
    await client.unsafe('drop schema if exists drizzle cascade');
    await client.unsafe('create schema public');
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../src/migrations/', import.meta.url)) });
  });
  afterAll(async () => { await client.end({ timeout: 5 }); });

  it('persists provider-capable users, identities, OAuth state, and only safe token hashes', async () => {
    const rawSession = 'raw-session-token'; const rawVerification = 'raw-verification-token'; const rawReset = 'raw-reset-token';
    const user = requireInserted((await client<{ id: string; email_normalized: string; password_hash: string }[]>`
      insert into users (email_normalized, password_hash) values ('member@example.test', '$argon2id$v=19$fixture') returning id, email_normalized, password_hash`)[0]);
    expect(user).toMatchObject({ email_normalized: 'member@example.test' });
    expect(user.password_hash).toMatch(/^\$argon2id\$/);
    expect(user.password_hash).not.toContain('correct horse battery staple');
    await client`insert into authentication_identities (user_id, provider, provider_subject, provider_email) values (${user.id}, 'PASSWORD', 'member@example.test', 'member@example.test')`;
    await client`insert into oauth_authorization_states (provider, state_hash, nonce_hash, code_verifier_hash, redirect_uri, expires_at) values ('GOOGLE', ${hash('state')}, ${hash('nonce')}, ${hash('verifier')}, 'http://localhost/callback', now() + interval '5 minutes')`;
    await client`insert into sessions (user_id, token_hash, expires_at) values (${user.id}, ${hash(rawSession)}, now() + interval '1 day')`;
    await client`insert into email_verification_tokens (user_id, token_hash, expires_at) values (${user.id}, ${hash(rawVerification)}, now() + interval '1 day')`;
    await client`insert into password_reset_tokens (user_id, token_hash, expires_at) values (${user.id}, ${hash(rawReset)}, now() + interval '1 hour')`;
    await client`insert into audit_logs (actor_user_id, action, target_type, target_id, metadata) values (${user.id}, 'auth.registered', 'user', ${user.id}, ${JSON.stringify({})}::jsonb)`;
    const values = await client<{ value: string }[]>`select token_hash as value from sessions union all select token_hash from email_verification_tokens union all select token_hash from password_reset_tokens`;
    expect(values.map(({ value }) => value)).toEqual(expect.arrayContaining([hash(rawSession), hash(rawVerification), hash(rawReset)]));
    expect(values.map(({ value }) => value)).not.toEqual(expect.arrayContaining([rawSession, rawVerification, rawReset]));
    await expect(client`insert into authentication_identities (user_id, provider, provider_subject) values (${user.id}, 'PASSWORD', 'member@example.test')`).rejects.toThrow();
    const [audit] = await client<{ action: string; metadata: Record<string, unknown> }[]>`select action, metadata from audit_logs where actor_user_id = ${user.id}`;
    expect(audit).toEqual({ action: 'auth.registered', metadata: {} });
  });

  it('allows provider-only users and persists single-use token/session revocation lifecycle', async () => {
    const user = requireInserted((await client<{ id: string; password_hash: string | null }[]>`insert into users (email_normalized) values ('google@example.test') returning id, password_hash`)[0]);
    expect(user).toEqual({ id: expect.any(String), password_hash: null });
    const verification = requireInserted((await client<{ id: string }[]>`insert into email_verification_tokens (user_id, token_hash, expires_at) values (${user.id}, ${hash('once')}, now() + interval '1 day') returning id`)[0]);
    const reset = requireInserted((await client<{ id: string }[]>`insert into password_reset_tokens (user_id, token_hash, expires_at) values (${user.id}, ${hash('reset-once')}, now() + interval '1 day') returning id`)[0]);
    await client`update email_verification_tokens set used_at = now() where id = ${verification.id} and used_at is null`;
    await client`update password_reset_tokens set used_at = now() where id = ${reset.id} and used_at is null`;
    const verificationReplay = await client`update email_verification_tokens set used_at = now() where id = ${verification.id} and used_at is null`;
    const resetReplay = await client`update password_reset_tokens set used_at = now() where id = ${reset.id} and used_at is null`;
    expect(verificationReplay.count).toBe(0);
    expect(resetReplay.count).toBe(0);
    await client`insert into sessions (user_id, token_hash, expires_at) values (${user.id}, ${hash('one')}, now() + interval '1 day'), (${user.id}, ${hash('two')}, now() + interval '1 day')`;
    await client`update sessions set revoked_at = now() where user_id = ${user.id} and revoked_at is null`;
    const active = await client<{ count: string }[]>`select count(*) from sessions where user_id = ${user.id} and revoked_at is null`;
    expect(active[0]?.count).toBe('0');
  });

  it('enforces Google provider-subject uniqueness and durable single-use OAuth authorization state', async () => {
    const user = requireInserted((await client<{ id: string }[]>`insert into users (email_normalized, email_verified_at) values ('google-identity@example.test', now()) returning id`)[0]);
    await client`insert into authentication_identities (user_id, provider, provider_subject, provider_email) values (${user.id}, 'GOOGLE', 'google-stable-subject', 'google-identity@example.test')`;
    await expect(client`insert into authentication_identities (user_id, provider, provider_subject) values (${user.id}, 'GOOGLE', 'google-stable-subject')`).rejects.toThrow();
    const state = requireInserted((await client<{ id: string; code_verifier_hash: string }[]>`
      insert into oauth_authorization_states (provider, state_hash, nonce_hash, code_verifier_hash, redirect_uri, expires_at)
      values ('GOOGLE', ${hash('google-state')}, ${hash('google-nonce')}, ${hash('google-verifier')}, 'http://localhost/callback', now() + interval '5 minutes')
      returning id, code_verifier_hash`)[0]);
    expect(state.code_verifier_hash).toBe(hash('google-verifier'));
    const firstUse = await client`update oauth_authorization_states set used_at = now() where id = ${state.id} and used_at is null and expires_at > now()`;
    const replay = await client`update oauth_authorization_states set used_at = now() where id = ${state.id} and used_at is null and expires_at > now()`;
    expect(firstUse.count).toBe(1);
    expect(replay.count).toBe(0);
    const expired = requireInserted((await client<{ id: string }[]>`
      insert into oauth_authorization_states (provider, state_hash, nonce_hash, code_verifier_hash, redirect_uri, expires_at)
      values ('GOOGLE', ${hash('expired-state')}, ${hash('expired-nonce')}, ${hash('expired-verifier')}, 'http://localhost/callback', now() - interval '1 second') returning id`)[0]);
    const expiredUse = await client`update oauth_authorization_states set used_at = now() where id = ${expired.id} and used_at is null and expires_at > now()`;
    expect(expiredUse.count).toBe(0);
  });
});

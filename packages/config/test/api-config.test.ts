import { describe, expect, it } from 'vitest';

import { loadApiConfig, loadAuthenticationConfig, loadDatabaseConfig } from '../src/index.js';

describe('loadApiConfig', () => {
  it('uses safe local defaults without requiring an environment file', () => {
    expect(loadApiConfig({})).toMatchObject({
      environment: 'development',
      host: '127.0.0.1',
      port: 3001,
      cors: { enabled: false, origins: [] },
    });
  });

  it('rejects invalid public configuration formats', () => {
    expect(() => loadApiConfig({ PORT: 'not-a-port' })).toThrow('PORT must be');
    expect(() => loadApiConfig({ CORS_ORIGINS: 'ftp://example.com' })).toThrow('CORS_ORIGINS');
  });

  it('normalizes the exact local browser origin for credentialed CORS', () => {
    expect(loadApiConfig({ CORS_ORIGINS: 'http://localhost:3000/' }).cors).toEqual({
      enabled: true,
      origins: ['http://localhost:3000'],
    });
  });
});

describe('loadDatabaseConfig', () => {
  it('requires a PostgreSQL connection URL and validates optional pool size', () => {
    expect(() => loadDatabaseConfig({})).toThrow('DATABASE_URL is required');
    expect(() => loadDatabaseConfig({ DATABASE_URL: 'https://example.com' })).toThrow('protocol');
    expect(
      loadDatabaseConfig({ DATABASE_URL: 'postgresql://example.test/slotlyflow', DATABASE_POOL_MAX: '12' }),
    ).toEqual({
      url: 'postgresql://example.test/slotlyflow',
      pool: { maxConnections: 12 },
    });
  });
});

describe('loadAuthenticationConfig', () => {
  it('keeps Google OIDC disabled when no Google configuration is supplied and rejects partial configuration', () => {
    expect(loadAuthenticationConfig({}).googleOidc).toBeUndefined();
    expect(loadAuthenticationConfig({}).email).toEqual({ provider: 'disabled' });
    expect(() => loadAuthenticationConfig({ GOOGLE_OIDC_CLIENT_ID: 'test-client-id' })).toThrow('must be configured together');
  });

  it('requires absolute HTTP(S) callback and web application URLs when Google OIDC is enabled', () => {
    const base = {
      GOOGLE_OIDC_CLIENT_ID: 'test-client-id',
      GOOGLE_OIDC_CLIENT_SECRET: 'test-only-fixture',
      GOOGLE_OIDC_REDIRECT_URI: 'https://api.example.test/auth/google/callback',
      WEB_APP_URL: 'https://app.example.test/',
    };
    expect(loadAuthenticationConfig(base).googleOidc).toMatchObject({
      clientId: 'test-client-id',
      redirectUri: 'https://api.example.test/auth/google/callback',
      webAppUrl: 'https://app.example.test/',
    });
    expect(() => loadAuthenticationConfig({ ...base, WEB_APP_URL: 'file:///not-allowed' })).toThrow('WEB_APP_URL');
  });

  it('validates provider-neutral SMTP configuration and optional paired credentials', () => {
    const base = {
      EMAIL_PROVIDER: 'smtp',
      WEB_APP_URL: 'http://localhost:3000',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: '1025',
      SMTP_SECURE: 'false',
      EMAIL_FROM_ADDRESS: 'no-reply@slotlyflow.local',
      EMAIL_FROM_NAME: 'SlotlyFlow',
    };
    expect(loadAuthenticationConfig(base).email).toEqual({
      provider: 'smtp',
      webAppUrl: 'http://localhost:3000/',
      from: { address: 'no-reply@slotlyflow.local', name: 'SlotlyFlow' },
      smtp: { host: '127.0.0.1', port: 1025, secure: false },
    });
    expect(() => loadAuthenticationConfig({ ...base, SMTP_PORT: '70000' })).toThrow('SMTP_PORT');
    expect(() => loadAuthenticationConfig({ ...base, SMTP_USER: 'only-a-user' })).toThrow('configured together');
    expect(() => loadAuthenticationConfig({ ...base, EMAIL_FROM_ADDRESS: 'invalid' })).toThrow('EMAIL_FROM_ADDRESS');
    expect(() => loadAuthenticationConfig({ NODE_ENV: 'production' })).toThrow('EMAIL_PROVIDER');
  });
});

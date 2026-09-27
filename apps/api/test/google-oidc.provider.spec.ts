import { beforeEach, describe, expect, it, vi } from 'vitest';

const openidClient = vi.hoisted(() => ({
  authorizationCodeGrant: vi.fn(),
  discovery: vi.fn(),
}));

vi.mock('openid-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('openid-client')>();
  return {
    ...actual,
    authorizationCodeGrant: openidClient.authorizationCodeGrant,
    discovery: openidClient.discovery,
  };
});

import { GoogleOidcIdentityProvider } from '../src/auth/oidc/google-oidc.provider.js';

describe('GoogleOidcIdentityProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openidClient.discovery.mockResolvedValue({});
    openidClient.authorizationCodeGrant.mockResolvedValue({
      claims: () => ({
        sub: 'google-subject',
        email: 'person@example.test',
        email_verified: true,
        name: 'Test Person',
      }),
    });
  });

  it('preserves Google iss while retaining state, PKCE, and nonce validation inputs', async () => {
    const diagnostics = vi.fn();
    const provider = new GoogleOidcIdentityProvider({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3001/auth/google/callback',
      webAppUrl: 'http://localhost:3000/',
    });

    await expect(provider.exchangeAuthorizationCode({
      code: 'provider-code',
      state: 'state-value',
      nonce: 'nonce-value',
      codeVerifier: 'pkce-verifier',
      authorizationResponseIssuer: 'https://accounts.google.com',
    }, diagnostics)).resolves.toMatchObject({
      provider: 'GOOGLE',
      providerSubject: 'google-subject',
      email: 'person@example.test',
      emailVerified: true,
      issuer: 'https://accounts.google.com',
    });

    expect(openidClient.authorizationCodeGrant).toHaveBeenCalledOnce();
    const [, authorizationResponse, checks] = openidClient.authorizationCodeGrant.mock.calls[0] ?? [];
    expect(authorizationResponse).toBeInstanceOf(URL);
    if (!(authorizationResponse instanceof URL)) throw new Error('Expected an authorization response URL.');
    expect(authorizationResponse.searchParams.get('iss')).toBe('https://accounts.google.com');
    expect(authorizationResponse.searchParams.get('code')).toBe('provider-code');
    expect(authorizationResponse.searchParams.get('state')).toBe('state-value');
    expect(checks).toEqual({
      expectedState: 'state-value',
      expectedNonce: 'nonce-value',
      pkceCodeVerifier: 'pkce-verifier',
    });
    expect(diagnostics).toHaveBeenCalledWith({ stage: 'google_authorization_code_exchange', outcome: 'success' });
    expect(diagnostics).toHaveBeenCalledWith({ stage: 'issuer_validation', outcome: 'success' });
    expect(diagnostics).toHaveBeenCalledWith({ stage: 'nonce_validation', outcome: 'success' });
    expect(diagnostics).toHaveBeenCalledWith({ stage: 'identity_normalization', outcome: 'success' });
  });
});

import { describe, expect, it } from 'vitest';

import { AesGcmCredentialStore, CredentialEncryptionError } from '../src/whatsapp/credential-store.js';

describe('AesGcmCredentialStore', () => {
  it('uses authenticated encryption and never treats a credential reference as material', () => {
    const store = new AesGcmCredentialStore(Buffer.alloc(32, 9));
    const prepared = store.prepare({ provider: 'META', accessToken: 'test-access-token', expiresAt: null });
    expect(prepared.reference).not.toContain('test-access-token');
    expect(prepared.ciphertext).not.toContain('test-access-token');
    expect(prepared.nonce).not.toContain('test-access-token');
    expect(store.decrypt(prepared)).toBe('test-access-token');
  });

  it('fails closed when ciphertext/authentication data is tampered with or key material is invalid', () => {
    const store = new AesGcmCredentialStore(Buffer.alloc(32, 3));
    const prepared = store.prepare({ provider: 'META', accessToken: 'test-access-token', expiresAt: null });
    expect(() => store.decrypt({ ...prepared, authenticationTag: 'tampered' })).toThrow(CredentialEncryptionError);
    expect(() => new AesGcmCredentialStore(Buffer.alloc(31))).toThrow(CredentialEncryptionError);
  });
});

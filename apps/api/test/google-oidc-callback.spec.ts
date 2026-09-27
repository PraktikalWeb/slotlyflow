import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { parseGoogleOidcCallback } from '../src/auth/oidc/oidc-authentication.service.js';

const state = 'a'.repeat(43);

describe('Google OIDC callback input', () => {
  it('preserves a supplied authorization-response issuer', () => {
    expect(parseGoogleOidcCallback({
      code: 'provider-code',
      state,
      iss: 'https://accounts.google.com',
    })).toEqual({
      code: 'provider-code',
      state,
      authorizationResponseIssuer: 'https://accounts.google.com',
    });
  });

  it.each([
    { state },
    { code: 'provider-code' },
    { code: '', state },
  ])('rejects a callback without valid required code and state values', (query) => {
    expect(() => parseGoogleOidcCallback(query)).toThrow(BadRequestException);
  });

  it('rejects a non-string issuer instead of coercing or trusting it', () => {
    expect(() => parseGoogleOidcCallback({
      code: 'provider-code',
      state,
      iss: ['https://accounts.google.com'],
    })).toThrow(BadRequestException);
  });
});

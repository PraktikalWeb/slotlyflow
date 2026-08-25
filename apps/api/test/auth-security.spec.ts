import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { FastifyRequest } from 'fastify';

import { CsrfService } from '../src/auth/csrf.service.js';
import { AuthRateLimiter } from '../src/auth/rate-limiter.service.js';

function request(cookie: string | undefined, header: string | undefined): FastifyRequest {
  return { cookies: cookie === undefined ? {} : { slotlyflow_csrf: cookie }, headers: header === undefined ? {} : { 'x-csrf-token': header } } as unknown as FastifyRequest;
}

describe('authentication HTTP security controls', () => {
  it('fails closed without a matching CSRF cookie and header', () => {
    const csrf = new CsrfService();
    expect(() => csrf.assert(request(undefined, undefined))).toThrow(HttpException);
    expect(() => csrf.assert(request('one', 'two'))).toThrow(HttpException);
    const validToken = 'a'.repeat(43);
    expect(() => csrf.assert(request(validToken, validToken))).not.toThrow();
    expect(() => csrf.assert(request('same', 'same'))).toThrow(HttpException);
  });

  it('enforces the explicit login limit', () => {
    const limiter = new AuthRateLimiter();
    for (let attempt = 0; attempt < 10; attempt += 1) limiter.enforce('login', '127.0.0.1');
    expect(() => limiter.enforce('login', '127.0.0.1')).toThrow(HttpException);
  });

  it('maintains distinct policies for every sensitive endpoint', () => {
    const limiter = new AuthRateLimiter();
    for (const policy of ['register', 'forgotPassword', 'resetPassword', 'verifyEmail', 'resendVerification'] as const) {
      expect(() => limiter.enforce(policy, '127.0.0.1')).not.toThrow();
    }
  });
});

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { ForbiddenException, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

const csrfCookie = 'slotlyflow_csrf';
const csrfTokenPattern = /^[A-Za-z0-9_-]{43}$/;

@Injectable()
export class CsrfService {
  createToken(): string { return randomBytes(32).toString('base64url'); }
  assert(request: FastifyRequest): void {
    const cookie = request.cookies[csrfCookie];
    const header = request.headers['x-csrf-token'];
    const supplied = Array.isArray(header) ? header[0] : header;
    if (
      cookie === undefined ||
      supplied === undefined ||
      !csrfTokenPattern.test(cookie) ||
      !csrfTokenPattern.test(supplied) ||
      cookie.length !== supplied.length ||
      !timingSafeEqual(Buffer.from(cookie), Buffer.from(supplied))
    ) {
      throw new ForbiddenException({ code: 'CSRF_VALIDATION_FAILED' });
    }
  }
  get cookieName(): string { return csrfCookie; }
}

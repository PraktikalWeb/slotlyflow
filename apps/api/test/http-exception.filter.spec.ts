import { ForbiddenException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { HttpExceptionFilter } from '../src/http-exception.filter.js';

function captureResponse(exception: unknown): { status: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> } {
  const send = vi.fn();
  const status = vi.fn(() => ({ send }));
  const request = { id: 'request-id', log: { error: vi.fn() } };
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => request,
    }),
  };
  new HttpExceptionFilter().catch(exception, host as never);
  return { status, send };
}

describe('HTTP exception filter', () => {
  it('preserves explicit safe client error codes', () => {
    const response = captureResponse(new ForbiddenException({ code: 'CSRF_VALIDATION_FAILED' }));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(response.send).toHaveBeenCalledWith({
      error: { code: 'CSRF_VALIDATION_FAILED', message: 'The request could not be completed.' },
      correlationId: 'request-id',
    });
  });

  it('uses the dependency-unavailable code only for service readiness failures', () => {
    const response = captureResponse(new ServiceUnavailableException());

    expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(response.send).toHaveBeenCalledWith({
      error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'An unexpected error occurred.' },
      correlationId: 'request-id',
    });
  });
});

import { describe, expect, it, vi } from 'vitest';

import { createOidcDiagnosticReporter, safeExceptionType } from '../src/auth/oidc/oidc-diagnostics.js';

describe('OIDC diagnostics', () => {
  it('logs only the safe stage fields for success and failure', () => {
    const log = { info: vi.fn(), error: vi.fn() };
    const report = createOidcDiagnosticReporter('correlation-id', log);

    report({ stage: 'state_lookup', outcome: 'success' });
    report({ stage: 'google_authorization_code_exchange', outcome: 'failure', exceptionType: 'GoogleClientAuthenticationError' });

    expect(log.info).toHaveBeenCalledWith({
      correlation_id: 'correlation-id', provider: 'GOOGLE', oidc_stage: 'state_lookup', oidc_outcome: 'success',
    }, 'OIDC stage completed');
    expect(log.error).toHaveBeenCalledWith({
      correlation_id: 'correlation-id', provider: 'GOOGLE', oidc_stage: 'google_authorization_code_exchange',
      oidc_outcome: 'failure', exception_type: 'GoogleClientAuthenticationError',
    }, 'OIDC stage failed');
  });

  it('uses only an exception class label and ignores attached sensitive values', () => {
    const error = new TypeError('authorization code and client secret must never be logged', {
      cause: { token: 'sensitive', cookie: 'sensitive' },
    });

    expect(safeExceptionType(error)).toBe('TypeError');
    expect(safeExceptionType({ message: 'sensitive' })).toBe('UnknownError');
  });
});

import { describe, expect, it, vi } from 'vitest';

import {
  authApiUrl,
  createRegistrationSubmitter,
  registrationSuccessRoute,
  submitCreateAccount,
  validateCreateAccount,
} from './create-account-flow';

const validFields = {
  email: 'person@example.test',
  password: 'correct horse battery staple',
  confirmPassword: 'correct horse battery staple',
};

describe('create account flow', () => {
  it('validates required fields, email format, the backend password policy, and confirmation matching', () => {
    expect(validateCreateAccount({ email: '', password: '', confirmPassword: '' })).toEqual({
      email: 'Enter your email address.',
      password: 'Enter a password.',
      confirmPassword: 'Confirm your password.',
    });
    expect(validateCreateAccount({ email: 'invalid', password: 'short', confirmPassword: 'different' })).toEqual({
      email: 'Enter a valid email address.',
      password: 'Use at least 12 characters.',
      confirmPassword: 'Passwords do not match.',
    });
    expect(validateCreateAccount({ ...validFields, password: 'a'.repeat(257), confirmPassword: 'a'.repeat(257) })).toEqual({
      password: 'Use no more than 256 characters.',
    });
    expect(validateCreateAccount(validFields)).toEqual({});
  });

  it('uses CSRF and browser credentials for the existing registration endpoint', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'csrf-proof' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'EMAIL_VERIFICATION_REQUIRED' }), { status: 201 }));

    await expect(submitCreateAccount({ ...validFields, email: ' person@example.test ' }, fetcher, 'https://api.example.test/')).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenNthCalledWith(1, 'https://api.example.test/auth/csrf', { credentials: 'include' });
    expect(fetcher).toHaveBeenNthCalledWith(2, 'https://api.example.test/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-csrf-token': 'csrf-proof' },
      body: JSON.stringify({ email: 'person@example.test', password: validFields.password }),
    });
  });

  it.each([
    [400, 'REQUEST_REJECTED', 'INVALID_DETAILS'],
    [403, 'CSRF_VALIDATION_FAILED', 'CSRF_REJECTED'],
    [409, 'REQUEST_REJECTED', 'EMAIL_ALREADY_REGISTERED'],
    [429, 'REQUEST_REJECTED', 'RATE_LIMITED'],
    [503, 'DEPENDENCY_UNAVAILABLE', 'UNAVAILABLE'],
    [500, 'INTERNAL_ERROR', 'UNEXPECTED'],
  ])('maps API status %i and safe code %s to %s', async (status, code, expectedIssue) => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'csrf-proof' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code } }), { status }));

    await expect(submitCreateAccount(validFields, fetcher, 'https://api.example.test')).resolves.toEqual({
      ok: false,
      issue: expectedIssue,
    });
  });

  it('rejects malformed success and CSRF responses without trusting them', async () => {
    const malformedCsrf = vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: 'wrong-shape' }), { status: 200 }));
    await expect(submitCreateAccount(validFields, malformedCsrf, 'https://api.example.test')).resolves.toEqual({ ok: false, issue: 'UNEXPECTED' });

    const malformedRegistration = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'csrf-proof' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'SIGNED_IN' }), { status: 201 }));
    await expect(submitCreateAccount(validFields, malformedRegistration, 'https://api.example.test')).resolves.toEqual({ ok: false, issue: 'UNEXPECTED' });
  });

  it('maps network failures safely', async () => {
    await expect(submitCreateAccount(validFields, vi.fn().mockRejectedValue(new Error('offline')), 'https://api.example.test')).resolves.toEqual({
      ok: false,
      issue: 'UNAVAILABLE',
    });
  });

  it('shares an in-flight registration request to prevent duplicate submissions', async () => {
    let resolveCsrf: ((response: Response) => void) | undefined;
    const csrfResponse = new Promise<Response>((resolve) => { resolveCsrf = resolve; });
    const fetcher = vi.fn()
      .mockReturnValueOnce(csrfResponse)
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'EMAIL_VERIFICATION_REQUIRED' }), { status: 201 }));
    const submit = createRegistrationSubmitter(fetcher, 'https://api.example.test');

    const first = submit(validFields);
    const second = submit(validFields);
    expect(first).toBe(second);
    expect(fetcher).toHaveBeenCalledTimes(1);

    if (resolveCsrf === undefined) throw new Error('Expected the deferred CSRF response resolver.');
    resolveCsrf(new Response(JSON.stringify({ csrfToken: 'csrf-proof' }), { status: 200 }));
    await expect(Promise.all([first, second])).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('uses the configured API origin for Google and the intended verification checkpoint after registration', () => {
    expect(authApiUrl('/auth/google', 'http://localhost:3001/')).toBe('http://localhost:3001/auth/google');
    expect(registrationSuccessRoute).toBe('/verify-email');
  });
});

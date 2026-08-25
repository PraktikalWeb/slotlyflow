import { describe, expect, it, vi } from 'vitest';

import { apiUrl, submitSignIn, validateSignIn } from './sign-in-flow';

describe('sign-in flow', () => {
  it('validates the required user-facing fields before contacting the API', () => {
    expect(validateSignIn({ email: '', password: '' })).toEqual({
      email: 'Enter your email address.',
      password: 'Enter your password.',
    });
    expect(validateSignIn({ email: 'not-an-email', password: 'present' })).toEqual({ email: 'Enter a valid email address.' });
  });

  it('uses the API CSRF flow and includes browser credentials without retaining a session token', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'csrf-proof' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: { id: 'user-id' } }), { status: 201 }));

    await expect(submitSignIn({ email: ' person@example.test ', password: 'safe password' }, fetcher, 'https://api.example.test/')).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenNthCalledWith(1, 'https://api.example.test/auth/csrf', { credentials: 'include' });
    expect(fetcher).toHaveBeenNthCalledWith(2, 'https://api.example.test/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-csrf-token': 'csrf-proof' },
      body: JSON.stringify({ email: 'person@example.test', password: 'safe password' }),
    });
  });

  it.each([
    [401, 'REQUEST_REJECTED', 'INVALID_CREDENTIALS'],
    [403, 'EMAIL_VERIFICATION_REQUIRED', 'EMAIL_VERIFICATION_REQUIRED'],
    [429, 'REQUEST_REJECTED', 'RATE_LIMITED'],
    [503, 'DEPENDENCY_UNAVAILABLE', 'UNAVAILABLE'],
  ])('maps API status %i to a safe %s state', async (status, code, expectedIssue) => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'csrf-proof' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code } }), { status }));
    await expect(submitSignIn({ email: 'person@example.test', password: 'safe password' }, fetcher, 'https://api.example.test')).resolves.toEqual({ ok: false, issue: expectedIssue });
  });

  it('uses the configured API origin for the Google authorization route and treats network failures safely', async () => {
    expect(apiUrl('/auth/google', 'https://api.example.test/')).toBe('https://api.example.test/auth/google');
    await expect(submitSignIn({ email: 'person@example.test', password: 'safe password' }, vi.fn().mockRejectedValue(new Error('offline')), 'https://api.example.test')).resolves.toEqual({ ok: false, issue: 'UNAVAILABLE' });
  });
});

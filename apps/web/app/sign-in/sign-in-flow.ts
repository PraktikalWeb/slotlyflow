export interface SignInFields {
  readonly email: string;
  readonly password: string;
}

export type SignInIssue =
  | 'INVALID_EMAIL'
  | 'PASSWORD_REQUIRED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'UNEXPECTED';

export interface SignInResult {
  readonly ok: boolean;
  readonly issue?: SignInIssue;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function validateSignIn(fields: SignInFields): Partial<Record<keyof SignInFields, string>> {
  const errors: Partial<Record<keyof SignInFields, string>> = {};
  if (fields.email.trim() === '') errors.email = 'Enter your email address.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) errors.email = 'Enter a valid email address.';
  if (fields.password === '') errors.password = 'Enter your password.';
  return errors;
}

export async function submitSignIn(fields: SignInFields, fetcher: FetchLike, apiBaseUrl: string): Promise<SignInResult> {
  try {
    const csrfResponse = await fetcher(apiUrl('/auth/csrf', apiBaseUrl), { credentials: 'include' });
    if (!csrfResponse.ok) return { ok: false, issue: issueFromStatus(csrfResponse.status) };
    const csrfPayload: unknown = await csrfResponse.json();
    if (!isCsrfPayload(csrfPayload)) return { ok: false, issue: 'UNEXPECTED' };

    const loginResponse = await fetcher(apiUrl('/auth/login', apiBaseUrl), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfPayload.csrfToken },
      body: JSON.stringify({ email: fields.email.trim(), password: fields.password }),
    });
    if (loginResponse.ok) return { ok: true };
    return { ok: false, issue: await issueFromResponse(loginResponse) };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE' };
  }
}

export function apiUrl(path: string, apiBaseUrl: string): string {
  return `${apiBaseUrl.replace(/\/$/, '')}${path}`;
}

function isCsrfPayload(value: unknown): value is { csrfToken: string } {
  return typeof value === 'object' && value !== null && 'csrfToken' in value && typeof value.csrfToken === 'string';
}

async function issueFromResponse(response: Response): Promise<SignInIssue> {
  const fallback = issueFromStatus(response.status);
  try {
    const payload: unknown = await response.json();
    if (typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'object' && payload.error !== null && 'code' in payload.error) {
      switch (payload.error.code) {
        case 'EMAIL_VERIFICATION_REQUIRED': return 'EMAIL_VERIFICATION_REQUIRED';
        case 'REQUEST_REJECTED': return response.status === 401 ? 'INVALID_CREDENTIALS' : fallback;
        default: return fallback;
      }
    }
  } catch {
    // The API may have no response body during an upstream outage; keep the safe status-derived message.
  }
  return fallback;
}

function issueFromStatus(status: number): SignInIssue {
  if (status === 401) return 'INVALID_CREDENTIALS';
  if (status === 403) return 'EMAIL_VERIFICATION_REQUIRED';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'UNAVAILABLE';
  return 'UNEXPECTED';
}

export interface CreateAccountFields {
  readonly email: string;
  readonly password: string;
  readonly confirmPassword: string;
}

export type CreateAccountIssue =
  | 'EMAIL_ALREADY_REGISTERED'
  | 'INVALID_DETAILS'
  | 'CSRF_REJECTED'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'UNEXPECTED';

export interface CreateAccountResult {
  readonly ok: boolean;
  readonly issue?: CreateAccountIssue;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type FieldErrors = Partial<Record<keyof CreateAccountFields, string>>;
type RegistrationSubmitter = (fields: CreateAccountFields) => Promise<CreateAccountResult>;

export const registrationSuccessRoute = '/verify-email';

export function validateCreateAccount(fields: CreateAccountFields): FieldErrors {
  const errors: FieldErrors = {};
  const email = fields.email.trim();

  if (email === '') errors.email = 'Enter your email address.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';

  if (fields.password === '') errors.password = 'Enter a password.';
  else if (fields.password.length < 12) errors.password = 'Use at least 12 characters.';
  else if (fields.password.length > 256) errors.password = 'Use no more than 256 characters.';

  if (fields.confirmPassword === '') errors.confirmPassword = 'Confirm your password.';
  else if (fields.confirmPassword !== fields.password) errors.confirmPassword = 'Passwords do not match.';

  return errors;
}

export function authApiUrl(path: string, apiBaseUrl: string): string {
  return `${apiBaseUrl.replace(/\/$/, '')}${path}`;
}

export async function submitCreateAccount(
  fields: CreateAccountFields,
  fetcher: FetchLike,
  apiBaseUrl: string,
): Promise<CreateAccountResult> {
  try {
    const csrfResponse = await fetcher(authApiUrl('/auth/csrf', apiBaseUrl), { credentials: 'include' });
    if (!csrfResponse.ok) return { ok: false, issue: issueFromStatus(csrfResponse.status) };

    const csrfPayload: unknown = await csrfResponse.json();
    if (!isCsrfPayload(csrfPayload)) return { ok: false, issue: 'UNEXPECTED' };

    const registrationResponse = await fetcher(authApiUrl('/auth/register', apiBaseUrl), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrfPayload.csrfToken,
      },
      body: JSON.stringify({ email: fields.email.trim(), password: fields.password }),
    });

    if (!registrationResponse.ok) {
      return { ok: false, issue: await issueFromResponse(registrationResponse) };
    }

    const payload: unknown = await registrationResponse.json();
    return isPendingVerificationResponse(payload)
      ? { ok: true }
      : { ok: false, issue: 'UNEXPECTED' };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE' };
  }
}

export function createRegistrationSubmitter(fetcher: FetchLike, apiBaseUrl: string): RegistrationSubmitter {
  let inFlight: Promise<CreateAccountResult> | undefined;

  return (fields) => {
    if (inFlight !== undefined) return inFlight;

    const request = submitCreateAccount(fields, fetcher, apiBaseUrl);
    inFlight = request;
    void request.finally(() => {
      if (inFlight === request) inFlight = undefined;
    });
    return request;
  };
}

function isCsrfPayload(value: unknown): value is { csrfToken: string } {
  return typeof value === 'object' && value !== null && 'csrfToken' in value && typeof value.csrfToken === 'string';
}

function isPendingVerificationResponse(value: unknown): value is { status: 'EMAIL_VERIFICATION_REQUIRED' } {
  return typeof value === 'object' && value !== null && 'status' in value && value.status === 'EMAIL_VERIFICATION_REQUIRED';
}

async function issueFromResponse(response: Response): Promise<CreateAccountIssue> {
  const fallback = issueFromStatus(response.status);
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'object' &&
      payload.error !== null &&
      'code' in payload.error &&
      payload.error.code === 'CSRF_VALIDATION_FAILED'
    ) {
      return 'CSRF_REJECTED';
    }
  } catch {
    // Preserve the safe status-derived issue when an upstream response has no valid JSON body.
  }
  return fallback;
}

function issueFromStatus(status: number): CreateAccountIssue {
  if (status === 400) return 'INVALID_DETAILS';
  if (status === 403) return 'CSRF_REJECTED';
  if (status === 409) return 'EMAIL_ALREADY_REGISTERED';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'UNAVAILABLE';
  return 'UNEXPECTED';
}

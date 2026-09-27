import { parsePublicApiBaseUrl } from '@/src/config/public-environment';

export const defaultPostAuthenticationPath = '/dashboard';
export const defaultAdminPostAuthenticationPath = '/admin';

const postAuthenticationOrigin = 'https://slotlyflow.invalid';

export type SignInIssue =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'UNEXPECTED';

export interface SignInFields {
  readonly email: string;
  readonly password: string;
}

export interface SignUpFields extends SignInFields {
  readonly firstName: string;
  readonly lastName: string;
}

export type SignUpIssue =
  | 'EMAIL_ALREADY_REGISTERED'
  | 'INVALID_DETAILS'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'UNEXPECTED';

export type VerificationIssue =
  | 'TOKEN_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'UNEXPECTED';

export type ResendVerificationIssue =
  | 'INVALID_EMAIL'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'UNEXPECTED';

export type PasswordResetRequestIssue =
  | 'INVALID_EMAIL'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'UNEXPECTED';

export type PasswordResetIssue =
  | 'TOKEN_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'UNEXPECTED';

export type SessionStatus = 'authenticated' | 'unauthenticated' | 'unavailable';

type AuthFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type LogoutResult = { readonly ok: true } | { readonly ok: false };

export type LogoutSubmitter = () => Promise<LogoutResult>;

export interface CurrentUserResponse {
  readonly id: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly passwordAuthenticationEnabled: boolean;
}

export type ProfileUpdateIssue = 'INVALID_DETAILS' | 'UNAUTHENTICATED' | 'RATE_LIMITED' | 'UNAVAILABLE' | 'UNEXPECTED';
export type PasswordChangeIssue = 'INVALID_CURRENT_PASSWORD' | 'INVALID_NEW_PASSWORD' | 'UNAVAILABLE_FOR_ACCOUNT' | 'UNAUTHENTICATED' | 'RATE_LIMITED' | 'UNAVAILABLE' | 'UNEXPECTED';

/** Only internal customer-dashboard destinations can influence customer post-authentication navigation. */
export function safePostAuthenticationPath(value: unknown): string {
  return safePostAuthenticationPathWithin(value, defaultPostAuthenticationPath, '/dashboard');
}

/** Only internal platform-admin destinations can influence platform-admin post-authentication navigation. */
export function safeAdminPostAuthenticationPath(value: unknown): string {
  return safePostAuthenticationPathWithin(value, defaultAdminPostAuthenticationPath, '/admin');
}

function safePostAuthenticationPathWithin(value: unknown, fallbackPath: string, allowedRoot: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048 || !value.startsWith('/')) {
    return fallbackPath;
  }

  try {
    const parsed = new URL(value, postAuthenticationOrigin);
    if (
      parsed.origin !== postAuthenticationOrigin ||
      parsed.pathname.includes('%') ||
      (parsed.pathname !== allowedRoot && !parsed.pathname.startsWith(`${allowedRoot}/`))
    ) {
      return fallbackPath;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallbackPath;
  }
}

export function configuredApiBaseUrl(): string {
  // Development HTTPS browser sessions use Next's same-origin API bridge.
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production' && window.location.protocol === 'https:') {
    return `${window.location.origin}/api`;
  }
  return parsePublicApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
}

export async function resolveBrowserSession(
  fetcher: AuthFetch = fetch,
  apiBaseUrl?: string,
): Promise<SessionStatus> {
  try {
    const response = await fetcher(authApiUrl('/auth/me', apiBaseUrl ?? configuredApiBaseUrl()), {
      credentials: 'include',
      cache: 'no-store',
    });
    if (response.ok) return 'authenticated';
    return response.status === 401 ? 'unauthenticated' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/** Resolves only an active, separately authorized platform-admin session. */
export async function resolveBrowserPlatformAdminSession(
  fetcher: AuthFetch = fetch,
  apiBaseUrl?: string,
): Promise<SessionStatus> {
  try {
    const response = await fetcher(authApiUrl('/admin/me', apiBaseUrl ?? configuredApiBaseUrl()), {
      credentials: 'include',
      cache: 'no-store',
    });
    if (response.ok) return 'authenticated';
    return response.status === 401 || response.status === 403 ? 'unauthenticated' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export async function submitSignIn(
  fields: SignInFields,
  fetcher: AuthFetch = fetch,
  apiBaseUrl?: string,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly issue: SignInIssue }> {
  try {
    const configuredApiUrl = apiBaseUrl ?? configuredApiBaseUrl();
    const csrf = await requestCsrfToken(fetcher, configuredApiUrl);
    if (csrf.ok === false) return { ok: false, issue: issueFromStatus(csrf.status) };

    const response = await fetcher(authApiUrl('/auth/login', configuredApiUrl), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrf.token,
      },
      body: JSON.stringify({
        email: fields.email.trim(),
        password: fields.password,
      }),
    });

    if (response.ok) return { ok: true };
    return { ok: false, issue: await issueFromResponse(response) };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE' };
  }
}

export async function submitSignUp(
  fields: SignUpFields,
  fetcher: AuthFetch = fetch,
  apiBaseUrl?: string,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly issue: SignUpIssue }> {
  try {
    const configuredApiUrl = apiBaseUrl ?? configuredApiBaseUrl();
    const csrf = await requestCsrfToken(fetcher, configuredApiUrl);
    if (csrf.ok === false) return { ok: false, issue: signUpIssueFromStatus(csrf.status) };

    const response = await fetcher(authApiUrl('/auth/register', configuredApiUrl), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrf.token,
      },
      body: JSON.stringify({
        firstName: fields.firstName.trim(),
        lastName: fields.lastName.trim(),
        email: fields.email.trim(),
        password: fields.password,
      }),
    });

    if (!response.ok) return { ok: false, issue: signUpIssueFromStatus(response.status) };
    const payload: unknown = await response.json();
    return isPendingVerificationResponse(payload)
      ? { ok: true }
      : { ok: false, issue: 'UNEXPECTED' };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE' };
  }
}

export function verificationTokenFromSearch(search: string): string | undefined {
  return secureEmailTokenFromSearch(search);
}

export function passwordResetTokenFromSearch(search: string): string | undefined {
  return secureEmailTokenFromSearch(search);
}

const inFlightVerificationRequests = new Map<string, Promise<VerificationResult>>();

type VerificationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly issue: VerificationIssue };

export function verifyEmailOnce(
  token: string,
  fetcher: AuthFetch = fetch,
  apiBaseUrl?: string,
): Promise<VerificationResult> {
  const existing = inFlightVerificationRequests.get(token);
  if (existing !== undefined) return existing;

  const request = submitEmailVerification(token, fetcher, apiBaseUrl);
  inFlightVerificationRequests.set(token, request);
  void request.finally(() => {
    if (inFlightVerificationRequests.get(token) === request) {
      inFlightVerificationRequests.delete(token);
    }
  });
  return request;
}

export async function submitEmailVerification(
  token: string,
  fetcher: AuthFetch = fetch,
  apiBaseUrl?: string,
): Promise<VerificationResult> {
  try {
    const configuredApiUrl = apiBaseUrl ?? configuredApiBaseUrl();
    const csrf = await requestCsrfToken(fetcher, configuredApiUrl);
    if (csrf.ok === false) return { ok: false, issue: verificationIssueFromStatus(csrf.status) };

    const response = await fetcher(authApiUrl('/auth/email/verify', configuredApiUrl), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrf.token,
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) return { ok: false, issue: verificationIssueFromStatus(response.status) };
    const payload: unknown = await response.json();
    return isVerifiedAuthenticationResponse(payload)
      ? { ok: true }
      : { ok: false, issue: 'UNEXPECTED' };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE' };
  }
}

export async function resendVerificationEmail(
  email: string,
  fetcher: AuthFetch = fetch,
  apiBaseUrl?: string,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly issue: ResendVerificationIssue }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { ok: false, issue: 'INVALID_EMAIL' };
  }

  try {
    const configuredApiUrl = apiBaseUrl ?? configuredApiBaseUrl();
    const csrf = await requestCsrfToken(fetcher, configuredApiUrl);
    if (csrf.ok === false) return { ok: false, issue: resendIssueFromStatus(csrf.status) };

    const response = await fetcher(authApiUrl('/auth/email/resend', configuredApiUrl), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrf.token,
      },
      body: JSON.stringify({ email: normalizedEmail }),
    });

    if (!response.ok) return { ok: false, issue: resendIssueFromStatus(response.status) };
    const payload: unknown = await response.json();
    return isAcceptedResponse(payload)
      ? { ok: true }
      : { ok: false, issue: 'UNEXPECTED' };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE' };
  }
}

export async function requestPasswordReset(
  email: string,
  fetcher: AuthFetch = fetch,
  apiBaseUrl?: string,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly issue: PasswordResetRequestIssue }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { ok: false, issue: 'INVALID_EMAIL' };
  }

  try {
    const configuredApiUrl = apiBaseUrl ?? configuredApiBaseUrl();
    const csrf = await requestCsrfToken(fetcher, configuredApiUrl);
    if (csrf.ok === false) return { ok: false, issue: passwordResetRequestIssueFromStatus(csrf.status) };

    const response = await fetcher(authApiUrl('/auth/password/forgot', configuredApiUrl), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrf.token,
      },
      body: JSON.stringify({ email: normalizedEmail }),
    });

    if (!response.ok) return { ok: false, issue: passwordResetRequestIssueFromStatus(response.status) };
    const payload: unknown = await response.json();
    return isAcceptedResponse(payload)
      ? { ok: true }
      : { ok: false, issue: 'UNEXPECTED' };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE' };
  }
}

export async function submitPasswordReset(
  fields: { readonly token: string; readonly password: string },
  fetcher: AuthFetch = fetch,
  apiBaseUrl?: string,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly issue: PasswordResetIssue }> {
  try {
    const configuredApiUrl = apiBaseUrl ?? configuredApiBaseUrl();
    const csrf = await requestCsrfToken(fetcher, configuredApiUrl);
    if (csrf.ok === false) return { ok: false, issue: passwordResetIssueFromStatus(csrf.status) };

    const response = await fetcher(authApiUrl('/auth/password/reset', configuredApiUrl), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrf.token,
      },
      body: JSON.stringify(fields),
    });

    return response.status === 204
      ? { ok: true }
      : { ok: false, issue: passwordResetIssueFromStatus(response.status) };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE' };
  }
}

/**
 * Ends the SlotlyFlow session using the existing double-submit CSRF contract.
 * Session material remains browser-managed: it is never read from, written to,
 * or cleared by JavaScript.
 */
export async function submitLogout(
  fetcher: AuthFetch = fetch,
  apiBaseUrl?: string,
): Promise<LogoutResult> {
  try {
    const configuredApiUrl = apiBaseUrl ?? configuredApiBaseUrl();
    const csrf = await requestCsrfToken(fetcher, configuredApiUrl);
    if (csrf.ok === false) return { ok: false };

    const response = await fetcher(authApiUrl('/auth/logout', configuredApiUrl), {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-csrf-token': csrf.token },
    });
    return response.status === 204 ? { ok: true } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function updateCurrentUserProfile(
  fields: { readonly firstName: string; readonly lastName: string },
  fetcher: AuthFetch = fetch,
  apiBaseUrl?: string,
): Promise<{ readonly ok: true; readonly user: CurrentUserResponse } | { readonly ok: false; readonly issue: ProfileUpdateIssue }> {
  try {
    const configuredApiUrl = apiBaseUrl ?? configuredApiBaseUrl();
    const csrf = await requestCsrfToken(fetcher, configuredApiUrl);
    if (csrf.ok === false) return { ok: false, issue: profileUpdateIssueFromStatus(csrf.status) };
    const response = await fetcher(authApiUrl('/auth/me', configuredApiUrl), {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrf.token,
      },
      body: JSON.stringify({
        firstName: fields.firstName.trim(),
        lastName: fields.lastName.trim(),
      }),
    });
    if (!response.ok) return { ok: false, issue: profileUpdateIssueFromStatus(response.status) };
    const user = authenticationUserFromPayload(await response.json());
    return user === undefined ? { ok: false, issue: 'UNEXPECTED' } : { ok: true, user };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE' };
  }
}

export async function changeCurrentUserPassword(
  fields: { readonly currentPassword: string; readonly newPassword: string },
  fetcher: AuthFetch = fetch,
  apiBaseUrl?: string,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly issue: PasswordChangeIssue }> {
  try {
    const configuredApiUrl = apiBaseUrl ?? configuredApiBaseUrl();
    const csrf = await requestCsrfToken(fetcher, configuredApiUrl);
    if (csrf.ok === false) return { ok: false, issue: passwordChangeIssueFromStatus(csrf.status) };
    const response = await fetcher(authApiUrl('/auth/password/change', configuredApiUrl), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrf.token,
      },
      body: JSON.stringify(fields),
    });
    if (!response.ok) return { ok: false, issue: await passwordChangeIssueFromResponse(response) };
    return authenticationUserFromPayload(await response.json()) === undefined
      ? { ok: false, issue: 'UNEXPECTED' }
      : { ok: true };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE' };
  }
}

/** Shares a single in-flight logout request across every control in one shell. */
export function createLogoutSubmitter(
  fetcher: AuthFetch = fetch,
  apiBaseUrl?: string,
): LogoutSubmitter {
  let inFlight: Promise<LogoutResult> | undefined;

  return () => {
    inFlight ??= submitLogout(fetcher, apiBaseUrl).finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  };
}

export function googleAuthorizationUrl(apiBaseUrl: string, returnTo: unknown): string {
  const authorizationUrl = new URL(authApiUrl('/auth/google', apiBaseUrl));
  authorizationUrl.searchParams.set('returnTo', safePostAuthenticationPath(returnTo));
  return authorizationUrl.toString();
}

function authApiUrl(path: string, apiBaseUrl: string): string {
  return `${apiBaseUrl.replace(/\/$/, '')}${path}`;
}

async function requestCsrfToken(
  fetcher: AuthFetch,
  apiBaseUrl: string,
): Promise<{ readonly ok: true; readonly token: string } | { readonly ok: false; readonly status: number }> {
  const response = await fetcher(authApiUrl('/auth/csrf', apiBaseUrl), {
    credentials: 'include',
  });
  if (!response.ok) return { ok: false, status: response.status };

  const payload: unknown = await response.json();
  return isCsrfPayload(payload)
    ? { ok: true, token: payload.csrfToken }
    : { ok: false, status: response.status };
}

function isCsrfPayload(value: unknown): value is { readonly csrfToken: string } {
  return typeof value === 'object' && value !== null && 'csrfToken' in value && typeof value.csrfToken === 'string';
}

function isPendingVerificationResponse(value: unknown): value is { readonly status: 'EMAIL_VERIFICATION_REQUIRED' } {
  return typeof value === 'object' && value !== null && 'status' in value && value.status === 'EMAIL_VERIFICATION_REQUIRED';
}

function isVerifiedAuthenticationResponse(value: unknown): value is { readonly user: { readonly emailVerified: true } } {
  if (typeof value !== 'object' || value === null || !('user' in value)) return false;
  const user = value.user;
  return typeof user === 'object' && user !== null && 'emailVerified' in user && user.emailVerified === true;
}

function authenticationUserFromPayload(value: unknown): CurrentUserResponse | undefined {
  if (typeof value !== 'object' || value === null || !('user' in value)) return undefined;
  const user = value.user;
  if (typeof user !== 'object' || user === null) return undefined;
  if (!('id' in user) || typeof user.id !== 'string' || user.id === '') return undefined;
  if (!('email' in user) || typeof user.email !== 'string' || user.email === '') return undefined;
  if (!('emailVerified' in user) || typeof user.emailVerified !== 'boolean') return undefined;
  if (!('passwordAuthenticationEnabled' in user) || typeof user.passwordAuthenticationEnabled !== 'boolean') return undefined;
  if (!('firstName' in user) || (typeof user.firstName !== 'string' && user.firstName !== null)) return undefined;
  if (!('lastName' in user) || (typeof user.lastName !== 'string' && user.lastName !== null)) return undefined;
  const firstName = user.firstName as string | null;
  const lastName = user.lastName as string | null;
  return {
    id: user.id,
    firstName,
    lastName,
    email: user.email,
    emailVerified: user.emailVerified,
    passwordAuthenticationEnabled: user.passwordAuthenticationEnabled,
  };
}

function isAcceptedResponse(value: unknown): value is { readonly status: 'ACCEPTED' } {
  return typeof value === 'object' && value !== null && 'status' in value && value.status === 'ACCEPTED';
}

function secureEmailTokenFromSearch(search: string): string | undefined {
  const token = new URLSearchParams(search).get('token')?.trim();
  return token !== undefined && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}

async function issueFromResponse(response: Response): Promise<SignInIssue> {
  const fallback = issueFromStatus(response.status);
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'object' &&
      payload.error !== null &&
      'code' in payload.error
    ) {
      if (payload.error.code === 'EMAIL_VERIFICATION_REQUIRED') {
        return 'EMAIL_VERIFICATION_REQUIRED';
      }
      if (payload.error.code === 'REQUEST_REJECTED' && response.status === 401) {
        return 'INVALID_CREDENTIALS';
      }
    }
  } catch {
    // Preserve the safe, status-derived result if an upstream response has no JSON body.
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

function signUpIssueFromStatus(status: number): SignUpIssue {
  if (status === 400 || status === 403) return 'INVALID_DETAILS';
  if (status === 409) return 'EMAIL_ALREADY_REGISTERED';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'UNAVAILABLE';
  return 'UNEXPECTED';
}

function verificationIssueFromStatus(status: number): VerificationIssue {
  if (status === 400) return 'TOKEN_UNAVAILABLE';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 403 || status === 503) return 'UNAVAILABLE';
  return 'UNEXPECTED';
}

function resendIssueFromStatus(status: number): ResendVerificationIssue {
  if (status === 400) return 'INVALID_EMAIL';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 403 || status === 503) return 'UNAVAILABLE';
  return 'UNEXPECTED';
}

function passwordResetRequestIssueFromStatus(status: number): PasswordResetRequestIssue {
  if (status === 400) return 'INVALID_EMAIL';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 403 || status === 503) return 'UNAVAILABLE';
  return 'UNEXPECTED';
}

function passwordResetIssueFromStatus(status: number): PasswordResetIssue {
  if (status === 400) return 'TOKEN_UNAVAILABLE';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 403 || status === 503) return 'UNAVAILABLE';
  return 'UNEXPECTED';
}

function profileUpdateIssueFromStatus(status: number): ProfileUpdateIssue {
  if (status === 400) return 'INVALID_DETAILS';
  if (status === 401 || status === 403) return 'UNAUTHENTICATED';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'UNAVAILABLE';
  return 'UNEXPECTED';
}

async function passwordChangeIssueFromResponse(response: Response): Promise<PasswordChangeIssue> {
  if (response.status === 429) return 'RATE_LIMITED';
  if (response.status === 503) return 'UNAVAILABLE';
  try {
    const payload: unknown = await response.json();
    const code = typeof payload === 'object' && payload !== null && 'error' in payload &&
      typeof payload.error === 'object' && payload.error !== null && 'code' in payload.error &&
      typeof payload.error.code === 'string'
      ? payload.error.code
      : undefined;
    if (code === 'CURRENT_PASSWORD_INVALID') return 'INVALID_CURRENT_PASSWORD';
    if (code === 'PASSWORD_CHANGE_UNAVAILABLE') return 'UNAVAILABLE_FOR_ACCOUNT';
  } catch {
    // Preserve status-based safe behavior when the response does not contain JSON.
  }
  return passwordChangeIssueFromStatus(response.status);
}

function passwordChangeIssueFromStatus(status: number): PasswordChangeIssue {
  if (status === 400) return 'INVALID_NEW_PASSWORD';
  if (status === 401 || status === 403) return 'UNAUTHENTICATED';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'UNAVAILABLE';
  return 'UNEXPECTED';
}

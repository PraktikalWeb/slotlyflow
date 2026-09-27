import { parsePublicApiBaseUrl } from '@/src/config/public-environment';
import type { DashboardBusinessMembership, DashboardUser } from './dashboard-types';

export type DashboardUserResolution =
  | { readonly status: 'authenticated'; readonly user: DashboardUser }
  | { readonly status: 'unauthenticated' }
  | { readonly status: 'unavailable' };

export type DashboardBusinessResolution =
  | { readonly status: 'ready'; readonly memberships: readonly DashboardBusinessMembership[] }
  | { readonly status: 'unauthenticated' }
  | { readonly status: 'unavailable' };

interface ServerDashboardRequest {
  readonly sessionToken: string | undefined;
}

/** Loads the API-authoritative user without exposing the opaque session to client code. */
export async function resolveDashboardUser({ sessionToken }: ServerDashboardRequest): Promise<DashboardUserResolution> {
  const response = await authenticatedServerFetch('/auth/me', sessionToken);
  if (response === 'unauthenticated' || response === 'unavailable') return { status: response };

  const payload: unknown = await response.json().catch(() => undefined);
  const user = dashboardUserFromPayload(payload);
  return user === undefined ? { status: 'unavailable' } : { status: 'authenticated', user };
}

/** Loads only the authenticated user's server-authorized Business memberships. */
export async function resolveDashboardBusinesses({ sessionToken }: ServerDashboardRequest): Promise<DashboardBusinessResolution> {
  const response = await authenticatedServerFetch('/organizations', sessionToken);
  if (response === 'unauthenticated' || response === 'unavailable') return { status: response };

  const payload: unknown = await response.json().catch(() => undefined);
  const memberships = dashboardMembershipsFromPayload(payload);
  return memberships === undefined ? { status: 'unavailable' } : { status: 'ready', memberships };
}

async function authenticatedServerFetch(
  path: '/auth/me' | '/organizations',
  sessionToken: string | undefined,
): Promise<Response | 'unauthenticated' | 'unavailable'> {
  if (sessionToken === undefined || sessionToken === '') return 'unauthenticated';

  const apiBaseUrl = parsePublicApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
  const cookieName = process.env.AUTH_SESSION_COOKIE_NAME ?? 'slotlyflow_session';
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      cache: 'no-store',
      headers: { cookie: `${cookieName}=${sessionToken}` },
    });
    if (response.status === 401 || response.status === 403) return 'unauthenticated';
    return response.ok ? response : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

function dashboardUserFromPayload(value: unknown): DashboardUser | undefined {
  if (typeof value !== 'object' || value === null || !('user' in value)) return undefined;
  const user = value.user;
  if (typeof user !== 'object' || user === null) return undefined;
  if (!('id' in user) || !('email' in user) || !('emailVerified' in user) || !('passwordAuthenticationEnabled' in user)) return undefined;
  if (typeof user.id !== 'string' || user.id === '' || typeof user.email !== 'string' || user.email === '') return undefined;
  if (typeof user.emailVerified !== 'boolean' || typeof user.passwordAuthenticationEnabled !== 'boolean') return undefined;

  const firstName = 'firstName' in user && typeof user.firstName === 'string' && user.firstName.trim() !== ''
    ? user.firstName.trim()
    : undefined;
  const lastName = 'lastName' in user && typeof user.lastName === 'string' && user.lastName.trim() !== ''
    ? user.lastName.trim()
    : undefined;
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    passwordAuthenticationEnabled: user.passwordAuthenticationEnabled,
    firstName,
    lastName,
  };
}

function dashboardMembershipsFromPayload(value: unknown): readonly DashboardBusinessMembership[] | undefined {
  if (typeof value !== 'object' || value === null || !('organizations' in value) || !Array.isArray(value.organizations)) {
    return undefined;
  }
  return value.organizations.every(isDashboardBusinessMembership) ? value.organizations : undefined;
}

function isDashboardBusinessMembership(value: unknown): value is DashboardBusinessMembership {
  if (typeof value !== 'object' || value === null || !('organization' in value) || !('role' in value) || !('status' in value)) {
    return false;
  }
  const organization = value.organization;
  return typeof organization === 'object' && organization !== null &&
    'id' in organization && typeof organization.id === 'string' && organization.id !== '' &&
    'name' in organization && typeof organization.name === 'string' && organization.name !== '' &&
    'slug' in organization && typeof organization.slug === 'string' && organization.slug !== '' &&
    (value.role === 'OWNER' || value.role === 'ADMIN' || value.role === 'AGENT') &&
    (value.status === 'active' || value.status === 'invited' || value.status === 'disabled');
}

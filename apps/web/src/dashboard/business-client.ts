import { configuredApiBaseUrl } from '@/src/auth/auth-client';

type BusinessFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type CreateBusinessResult =
  | { readonly ok: true; readonly organizationId: string }
  | { readonly ok: false; readonly issue: 'INVALID' | 'CONFLICT' | 'UNAUTHENTICATED' | 'UNAVAILABLE' | 'UNEXPECTED' };

export type BusinessDay =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export interface BusinessHourSettings {
  readonly day: BusinessDay;
  readonly enabled: boolean;
  readonly opensAt: string | null;
  readonly closesAt: string | null;
}

export interface BusinessSettings {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly businessEmail: string | null;
  readonly contactNumber: string | null;
  readonly website: string | null;
  readonly timezone: string;
  readonly businessHours: readonly BusinessHourSettings[];
}

type BusinessSettingsIssue = 'INVALID' | 'FORBIDDEN' | 'UNAUTHENTICATED' | 'UNAVAILABLE' | 'UNEXPECTED';
export type BusinessSettingsResult =
  | { readonly ok: true; readonly business: BusinessSettings }
  | { readonly ok: false; readonly issue: BusinessSettingsIssue };

/** Mirrors the existing server slug format; PostgreSQL remains authoritative for uniqueness. */
export function businessSlugFromName(name: string): string | undefined {
  const slug = name.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug.length > 0 && slug.length <= 120 ? slug : undefined;
}

export async function createBusiness(
  name: string,
  fetcher: BusinessFetch = fetch,
  apiBaseUrl = configuredApiBaseUrl(),
): Promise<CreateBusinessResult> {
  const trimmedName = name.trim();
  const slug = businessSlugFromName(trimmedName);
  if (trimmedName.length === 0 || trimmedName.length > 255 || slug === undefined) {
    return { ok: false, issue: 'INVALID' };
  }

  try {
    const csrf = await requestCsrfToken(fetcher, apiBaseUrl);
    if (csrf.ok === false) return createIssueFromStatus(csrf.status);

    const response = await fetcher(`${apiBaseUrl}/organizations`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrf.token,
      },
      body: JSON.stringify({ name: trimmedName, slug }),
    });
    if (!response.ok) return createIssueFromStatus(response.status);

    const payload: unknown = await response.json();
    return isCreateBusinessResponse(payload)
      ? { ok: true, organizationId: payload.organization.id }
      : { ok: false, issue: 'UNEXPECTED' };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE' };
  }
}

export async function getBusinessSettings(
  organizationId: string,
  fetcher: BusinessFetch = fetch,
  apiBaseUrl = configuredApiBaseUrl(),
): Promise<BusinessSettingsResult> {
  try {
    const response = await fetcher(`${apiBaseUrl}/organizations/${encodeURIComponent(organizationId)}`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!response.ok) return settingsIssueFromStatus(response.status);
    const payload: unknown = await response.json();
    const business = organizationSettingsFromEnvelope(payload);
    return business === undefined ? { ok: false, issue: 'UNEXPECTED' } : { ok: true, business };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE' };
  }
}

export async function updateBusinessSettings(
  organizationId: string,
  settings: Omit<BusinessSettings, 'id' | 'slug'>,
  fetcher: BusinessFetch = fetch,
  apiBaseUrl = configuredApiBaseUrl(),
): Promise<BusinessSettingsResult> {
  try {
    const csrf = await requestCsrfToken(fetcher, apiBaseUrl);
    if (csrf.ok === false) return settingsIssueFromStatus(csrf.status);
    const response = await fetcher(`${apiBaseUrl}/organizations/${encodeURIComponent(organizationId)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrf.token,
      },
      body: JSON.stringify(settings),
    });
    if (!response.ok) return settingsIssueFromStatus(response.status);
    const payload: unknown = await response.json();
    const business = organizationSettingsFromEnvelope(payload);
    return business === undefined ? { ok: false, issue: 'UNEXPECTED' } : { ok: true, business };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE' };
  }
}

async function requestCsrfToken(
  fetcher: BusinessFetch,
  apiBaseUrl: string,
): Promise<{ readonly ok: true; readonly token: string } | { readonly ok: false; readonly status: number }> {
  const response = await fetcher(`${apiBaseUrl}/auth/csrf`, { credentials: 'include' });
  if (!response.ok) return { ok: false, status: response.status };
  const payload: unknown = await response.json();
  return isCsrfPayload(payload)
    ? { ok: true, token: payload.csrfToken }
    : { ok: false, status: 500 };
}

function createIssueFromStatus(status: number): CreateBusinessResult {
  if (status === 400) return { ok: false, issue: 'INVALID' };
  if (status === 401 || status === 403) return { ok: false, issue: 'UNAUTHENTICATED' };
  if (status === 409) return { ok: false, issue: 'CONFLICT' };
  if (status === 503) return { ok: false, issue: 'UNAVAILABLE' };
  return { ok: false, issue: 'UNEXPECTED' };
}

function settingsIssueFromStatus(status: number): BusinessSettingsResult {
  if (status === 400) return { ok: false, issue: 'INVALID' };
  if (status === 401) return { ok: false, issue: 'UNAUTHENTICATED' };
  if (status === 403 || status === 404) return { ok: false, issue: 'FORBIDDEN' };
  if (status === 503) return { ok: false, issue: 'UNAVAILABLE' };
  return { ok: false, issue: 'UNEXPECTED' };
}

function isCsrfPayload(value: unknown): value is { readonly csrfToken: string } {
  return typeof value === 'object' && value !== null && 'csrfToken' in value && typeof value.csrfToken === 'string';
}

function isCreateBusinessResponse(value: unknown): value is { readonly organization: { readonly id: string } } {
  if (typeof value !== 'object' || value === null || !('organization' in value)) return false;
  const organization = value.organization;
  return typeof organization === 'object' && organization !== null &&
    'id' in organization && typeof organization.id === 'string' && organization.id !== '';
}

function organizationSettingsFromEnvelope(value: unknown): BusinessSettings | undefined {
  if (typeof value !== 'object' || value === null || !('organization' in value)) return undefined;
  const organization = value.organization;
  if (typeof organization !== 'object' || organization === null) return undefined;
  if (
    !('id' in organization) || typeof organization.id !== 'string' || organization.id === '' ||
    !('name' in organization) || typeof organization.name !== 'string' || organization.name === '' ||
    !('slug' in organization) || typeof organization.slug !== 'string' || organization.slug === '' ||
    !('businessEmail' in organization) || !isNullableString(organization.businessEmail) ||
    !('contactNumber' in organization) || !isNullableString(organization.contactNumber) ||
    !('website' in organization) || !isNullableString(organization.website) ||
    !('timezone' in organization) || typeof organization.timezone !== 'string' || organization.timezone === '' ||
    !('businessHours' in organization) || !Array.isArray(organization.businessHours) ||
    !organization.businessHours.every(isBusinessHourSettings)
  ) {
    return undefined;
  }
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    businessEmail: organization.businessEmail,
    contactNumber: organization.contactNumber,
    website: organization.website,
    timezone: organization.timezone,
    businessHours: organization.businessHours,
  };
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isBusinessHourSettings(value: unknown): value is BusinessHourSettings {
  if (typeof value !== 'object' || value === null) return false;
  return 'day' in value && isBusinessDay(value.day) &&
    'enabled' in value && typeof value.enabled === 'boolean' &&
    'opensAt' in value && isNullableString(value.opensAt) &&
    'closesAt' in value && isNullableString(value.closesAt);
}

function isBusinessDay(value: unknown): value is BusinessDay {
  return value === 'MONDAY' || value === 'TUESDAY' || value === 'WEDNESDAY' ||
    value === 'THURSDAY' || value === 'FRIDAY' || value === 'SATURDAY' || value === 'SUNDAY';
}

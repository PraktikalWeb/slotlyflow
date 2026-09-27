import { configuredApiBaseUrl } from '@/src/auth/auth-client';

const businessStatuses = ['ACTIVE', 'SUSPENDED'] as const;
const whatsappConnectionStatuses = ['PENDING', 'VERIFYING', 'CONNECTED', 'FAILED', 'DISCONNECTED', 'NEEDS_REAUTH', 'CONFLICT'] as const;
const whatsappConnectionVerificationStatuses = ['VERIFIED', 'CHECK_FAILED'] as const;
const whatsappConnectionSources = ['EXISTING_BUSINESS_APP', 'NEW_NUMBER', 'EXISTING_PLATFORM'] as const;

type PlatformAdminFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type PlatformBusinessStatus = (typeof businessStatuses)[number];
export type PlatformWhatsAppConnectionStatus = (typeof whatsappConnectionStatuses)[number];
export type PlatformWhatsAppConnectionVerificationStatus = (typeof whatsappConnectionVerificationStatuses)[number];
export type PlatformWhatsAppConnectionSource = (typeof whatsappConnectionSources)[number];

export interface PlatformBusinessListItem {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: PlatformBusinessStatus;
  readonly createdAt: string;
  readonly whatsappConnection: {
    readonly status: PlatformWhatsAppConnectionStatus;
    readonly displayPhoneNumber: string | null;
  } | undefined;
}

export interface PlatformBusinessesPage {
  readonly businesses: readonly PlatformBusinessListItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface PlatformBusinessDetail {
  readonly business: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly businessEmail: string | null;
    readonly contactNumber: string | null;
    readonly website: string | null;
    readonly timezone: string;
    readonly status: PlatformBusinessStatus;
    readonly createdAt: string;
    readonly updatedAt: string;
  };
  readonly members: readonly {
    readonly email: string;
    readonly role: 'OWNER' | 'ADMIN' | 'AGENT';
    readonly status: 'active' | 'invited' | 'disabled';
  }[];
  readonly whatsappConnection: {
    readonly id: string;
    readonly provider: 'META';
    readonly source: PlatformWhatsAppConnectionSource;
    readonly status: PlatformWhatsAppConnectionStatus;
    readonly displayPhoneNumber: string | null;
    readonly externalWabaId: string | null;
    readonly externalPhoneNumberId: string | null;
    readonly verificationStatus: PlatformWhatsAppConnectionVerificationStatus | null;
    readonly lastVerifiedAt: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
  } | undefined;
}

export type PlatformBusinessDetailResult =
  | { readonly status: 'ready'; readonly detail: PlatformBusinessDetail }
  | { readonly status: 'not-found' }
  | { readonly status: 'unavailable' };

export async function listPlatformBusinesses(
  input: { readonly page: number; readonly pageSize: number; readonly search: string },
  fetcher: PlatformAdminFetch = fetch,
  apiBaseUrl = configuredApiBaseUrl(),
  signal?: AbortSignal,
): Promise<PlatformBusinessesPage | undefined> {
  const query = new URLSearchParams({ page: String(input.page), pageSize: String(input.pageSize) });
  if (input.search.trim() !== '') query.set('search', input.search.trim());

  try {
    const response = await fetcher(`${apiBaseUrl}/admin/businesses?${query.toString()}`, {
      credentials: 'include',
      cache: 'no-store',
      signal,
    });
    if (!response.ok) return undefined;
    return platformBusinessesPageFromPayload(await response.json());
  } catch {
    return undefined;
  }
}

export async function getPlatformBusinessDetail(
  organizationId: string,
  fetcher: PlatformAdminFetch = fetch,
  apiBaseUrl = configuredApiBaseUrl(),
  signal?: AbortSignal,
): Promise<PlatformBusinessDetailResult> {
  try {
    const response = await fetcher(`${apiBaseUrl}/admin/businesses/${encodeURIComponent(organizationId)}`, {
      credentials: 'include',
      cache: 'no-store',
      signal,
    });
    if (response.status === 404) return { status: 'not-found' };
    if (!response.ok) return { status: 'unavailable' };
    const detail = platformBusinessDetailFromPayload(await response.json());
    return detail === undefined ? { status: 'unavailable' } : { status: 'ready', detail };
  } catch {
    return { status: 'unavailable' };
  }
}

function platformBusinessesPageFromPayload(value: unknown): PlatformBusinessesPage | undefined {
  if (!isRecord(value) || !Array.isArray(value.businesses) || !isPositiveInteger(value.page) || !isPositiveInteger(value.pageSize) || !isNonNegativeInteger(value.total)) {
    return undefined;
  }
  const businesses = value.businesses.map(platformBusinessFromPayload);
  return businesses.every((business): business is PlatformBusinessListItem => business !== undefined)
    ? { businesses, total: value.total, page: value.page, pageSize: value.pageSize }
    : undefined;
}

function platformBusinessFromPayload(value: unknown): PlatformBusinessListItem | undefined {
  if (!isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.name) ||
    !isNonEmptyString(value.slug) ||
    !isBusinessStatus(value.status) ||
    !isIsoDate(value.createdAt)) {
    return undefined;
  }

  const whatsappConnection = value.whatsappConnection === undefined || value.whatsappConnection === null
    ? undefined
    : platformWhatsAppConnectionFromPayload(value.whatsappConnection);
  if (value.whatsappConnection !== undefined && value.whatsappConnection !== null && whatsappConnection === undefined) return undefined;

  return {
    id: value.id,
    name: value.name,
    slug: value.slug,
    status: value.status,
    createdAt: value.createdAt,
    whatsappConnection,
  };
}

function platformBusinessDetailFromPayload(value: unknown): PlatformBusinessDetail | undefined {
  if (!isRecord(value) || !isRecord(value.business) || !isRecord(value.membershipSummary) || !Array.isArray(value.membershipSummary.members)) {
    return undefined;
  }
  const business = platformBusinessDetailRecordFromPayload(value.business);
  const members = value.membershipSummary.members.map(platformBusinessMemberFromPayload);
  const whatsappConnection = value.whatsappConnection === undefined || value.whatsappConnection === null
    ? undefined
    : platformBusinessDetailConnectionFromPayload(value.whatsappConnection);
  if (business === undefined || !members.every((member): member is PlatformBusinessDetail['members'][number] => member !== undefined)) return undefined;
  if (value.whatsappConnection !== undefined && value.whatsappConnection !== null && whatsappConnection === undefined) return undefined;
  return { business, members, whatsappConnection };
}

function platformBusinessDetailRecordFromPayload(value: Record<string, unknown>): PlatformBusinessDetail['business'] | undefined {
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.name) || !isNonEmptyString(value.slug) || !isBusinessStatus(value.status) ||
    !isNullableString(value.businessEmail) || !isNullableString(value.contactNumber) || !isNullableString(value.website) || !isNonEmptyString(value.timezone) ||
    !isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt)) {
    return undefined;
  }
  return {
    id: value.id,
    name: value.name,
    slug: value.slug,
    businessEmail: value.businessEmail,
    contactNumber: value.contactNumber,
    website: value.website,
    timezone: value.timezone,
    status: value.status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function platformBusinessMemberFromPayload(value: unknown): PlatformBusinessDetail['members'][number] | undefined {
  if (!isRecord(value) || !isNonEmptyString(value.email) || !isMemberRole(value.role) || !isMemberStatus(value.status)) return undefined;
  return { email: value.email, role: value.role, status: value.status };
}

function platformBusinessDetailConnectionFromPayload(value: unknown): PlatformBusinessDetail['whatsappConnection'] {
  if (!isRecord(value) || !isNonEmptyString(value.id) || value.provider !== 'META' || !isWhatsAppConnectionSource(value.source) ||
    !isWhatsAppConnectionStatus(value.status) || !isNullableString(value.displayPhoneNumber) || !isNullableString(value.externalWabaId) ||
    !isNullableString(value.externalPhoneNumberId) || !isNullableVerificationStatus(value.verificationStatus) ||
    !isNullableIsoDate(value.lastVerifiedAt) || !isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt)) {
    return undefined;
  }
  return {
    id: value.id,
    provider: value.provider,
    source: value.source,
    status: value.status,
    displayPhoneNumber: value.displayPhoneNumber,
    externalWabaId: value.externalWabaId,
    externalPhoneNumberId: value.externalPhoneNumberId,
    verificationStatus: value.verificationStatus,
    lastVerifiedAt: value.lastVerifiedAt,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function platformWhatsAppConnectionFromPayload(value: unknown): PlatformBusinessListItem['whatsappConnection'] {
  if (!isRecord(value) || !isWhatsAppConnectionStatus(value.status) || (value.displayPhoneNumber !== null && !isNonEmptyString(value.displayPhoneNumber))) {
    return undefined;
  }
  return { status: value.status, displayPhoneNumber: value.displayPhoneNumber };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isNonEmptyString(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isNullableIsoDate(value: unknown): value is string | null {
  return value === null || isIsoDate(value);
}

function isBusinessStatus(value: unknown): value is PlatformBusinessStatus {
  return typeof value === 'string' && businessStatuses.includes(value as PlatformBusinessStatus);
}

function isWhatsAppConnectionStatus(value: unknown): value is PlatformWhatsAppConnectionStatus {
  return typeof value === 'string' && whatsappConnectionStatuses.includes(value as PlatformWhatsAppConnectionStatus);
}

function isNullableVerificationStatus(value: unknown): value is PlatformWhatsAppConnectionVerificationStatus | null {
  return value === null || (typeof value === 'string' && whatsappConnectionVerificationStatuses.includes(value as PlatformWhatsAppConnectionVerificationStatus));
}

function isWhatsAppConnectionSource(value: unknown): value is PlatformWhatsAppConnectionSource {
  return typeof value === 'string' && whatsappConnectionSources.includes(value as PlatformWhatsAppConnectionSource);
}

function isMemberRole(value: unknown): value is PlatformBusinessDetail['members'][number]['role'] {
  return value === 'OWNER' || value === 'ADMIN' || value === 'AGENT';
}

function isMemberStatus(value: unknown): value is PlatformBusinessDetail['members'][number]['status'] {
  return value === 'active' || value === 'invited' || value === 'disabled';
}

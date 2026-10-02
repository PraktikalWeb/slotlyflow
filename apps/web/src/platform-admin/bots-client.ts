import { configuredApiBaseUrl } from '@/src/auth/auth-client';

import type {
  PlatformBusinessStatus,
  PlatformWhatsAppConnectionStatus,
  PlatformWhatsAppConnectionVerificationStatus,
} from './businesses-client';

const deploymentStatuses = ['ACTIVE', 'INACTIVE'] as const;
const publicationStatuses = ['PUBLISHED', 'UNPUBLISHED'] as const;
const definitionStatuses = ['ACTIVE', 'ARCHIVED'] as const;
const versionStatuses = ['PUBLISHED', 'RETIRED'] as const;

type PlatformAdminFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type PlatformBotDeploymentStatus = (typeof deploymentStatuses)[number];
export type PlatformBotPublicationStatus = (typeof publicationStatuses)[number];
export type PlatformBotDefinitionStatus = (typeof definitionStatuses)[number];
export type PlatformBotVersionStatus = (typeof versionStatuses)[number];
export type PlatformBotRequestIssue = 'INVALID' | 'NOT_FOUND' | 'CONFLICT' | 'FORBIDDEN' | 'UNAVAILABLE';

export interface PlatformBotCatalogueVersion {
  readonly id: string;
  readonly version: string;
  readonly status: PlatformBotVersionStatus;
  readonly implementationKey: string;
  readonly configurationSchema: Record<string, unknown> | null;
  readonly publishedAt: string;
  readonly createdAt: string;
}

export interface PlatformBotCatalogueDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: PlatformBotDefinitionStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly versions: readonly PlatformBotCatalogueVersion[];
}

export interface PlatformBotDeployment {
  readonly id: string;
  readonly status: PlatformBotDeploymentStatus;
  readonly activatedAt: string | null;
  readonly deactivatedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly business: {
    readonly id: string;
    readonly name: string;
    readonly status: PlatformBusinessStatus;
  };
  readonly whatsappConnection: {
    readonly id: string;
    readonly organizationId: string;
    readonly displayPhoneNumber: string | null;
    readonly provider: 'META';
    readonly status: PlatformWhatsAppConnectionStatus;
    readonly verificationStatus: PlatformWhatsAppConnectionVerificationStatus | null;
  };
  readonly bot: {
    readonly definitionId: string;
    readonly name: string;
  };
  readonly version: {
    readonly id: string;
    readonly version: string;
    readonly implementationKey: string;
  };
  readonly publication: {
    readonly status: PlatformBotPublicationStatus;
  };
}

export interface PlatformBotDeploymentsPage {
  readonly deployments: readonly PlatformBotDeployment[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export type PlatformBotReadResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly issue: 'UNAVAILABLE'; readonly requestId: string | undefined };

export type PlatformBotMutationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly issue: PlatformBotRequestIssue; readonly requestId: string | undefined };

export type PlatformBotDefinitionCreationResult =
  | { readonly ok: true; readonly definitionId: string }
  | { readonly ok: false; readonly issue: PlatformBotRequestIssue; readonly code: string | undefined; readonly requestId: string | undefined };

export type PlatformBotVersionCreationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly issue: PlatformBotRequestIssue; readonly code: string | undefined; readonly requestId: string | undefined };

export interface PlatformTrustedImplementation {
  readonly implementationKey: string;
}

export async function listBotCatalogue(
  fetcher: PlatformAdminFetch = fetch,
  apiBaseUrl = configuredApiBaseUrl(),
  signal?: AbortSignal,
): Promise<PlatformBotReadResult<readonly PlatformBotCatalogueDefinition[]>> {
  try {
    const response = await fetcher(`${apiBaseUrl}/admin/bots/catalogue`, {
      credentials: 'include',
      cache: 'no-store',
      signal,
    });
    if (!response.ok) return unavailable(response);
    const catalogue = catalogueFromPayload(await response.json());
    return catalogue === undefined ? unavailable(response) : { ok: true, value: catalogue };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE', requestId: undefined };
  }
}

export async function listBotDeployments(
  input: {
    readonly page: number;
    readonly pageSize: number;
    readonly organizationId?: string;
    readonly botDefinitionId?: string;
    readonly whatsappConnectionId?: string;
  },
  fetcher: PlatformAdminFetch = fetch,
  apiBaseUrl = configuredApiBaseUrl(),
  signal?: AbortSignal,
): Promise<PlatformBotReadResult<PlatformBotDeploymentsPage>> {
  const query = new URLSearchParams({ page: String(input.page), pageSize: String(input.pageSize) });
  if (input.organizationId !== undefined) query.set('organizationId', input.organizationId);
  if (input.botDefinitionId !== undefined) query.set('botDefinitionId', input.botDefinitionId);
  if (input.whatsappConnectionId !== undefined) query.set('whatsappConnectionId', input.whatsappConnectionId);

  try {
    const response = await fetcher(`${apiBaseUrl}/admin/bots/deployments?${query.toString()}`, {
      credentials: 'include',
      cache: 'no-store',
      signal,
    });
    if (!response.ok) return unavailable(response);
    const deployments = deploymentsPageFromPayload(await response.json());
    return deployments === undefined ? unavailable(response) : { ok: true, value: deployments };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE', requestId: undefined };
  }
}

export function createBotDeployment(
  input: { readonly organizationId: string; readonly whatsappConnectionId: string; readonly botVersionId: string },
  fetcher: PlatformAdminFetch = fetch,
  apiBaseUrl = configuredApiBaseUrl(),
): Promise<PlatformBotMutationResult> {
  return mutateBotAdministration('/admin/bots/deployments', { method: 'POST', body: JSON.stringify({ ...input, configuration: null }) }, fetcher, apiBaseUrl);
}

export function activateBotDeployment(deploymentId: string, fetcher: PlatformAdminFetch = fetch, apiBaseUrl = configuredApiBaseUrl()): Promise<PlatformBotMutationResult> {
  return mutateBotAdministration(`/admin/bots/deployments/${encodeURIComponent(deploymentId)}/activate`, { method: 'POST' }, fetcher, apiBaseUrl);
}

export function deactivateBotDeployment(deploymentId: string, fetcher: PlatformAdminFetch = fetch, apiBaseUrl = configuredApiBaseUrl()): Promise<PlatformBotMutationResult> {
  return mutateBotAdministration(`/admin/bots/deployments/${encodeURIComponent(deploymentId)}/deactivate`, { method: 'POST' }, fetcher, apiBaseUrl);
}

export function publishBotDeployment(deploymentId: string, fetcher: PlatformAdminFetch = fetch, apiBaseUrl = configuredApiBaseUrl()): Promise<PlatformBotMutationResult> {
  return mutateBotAdministration(`/admin/bots/deployments/${encodeURIComponent(deploymentId)}/publish`, { method: 'POST' }, fetcher, apiBaseUrl);
}

export function unpublishBotDeployment(deploymentId: string, fetcher: PlatformAdminFetch = fetch, apiBaseUrl = configuredApiBaseUrl()): Promise<PlatformBotMutationResult> {
  return mutateBotAdministration(`/admin/bots/deployments/${encodeURIComponent(deploymentId)}/unpublish`, { method: 'POST' }, fetcher, apiBaseUrl);
}

export async function listTrustedBotImplementations(
  fetcher: PlatformAdminFetch = fetch,
  apiBaseUrl = configuredApiBaseUrl(),
  signal?: AbortSignal,
): Promise<PlatformBotReadResult<readonly PlatformTrustedImplementation[]>> {
  try {
    const response = await fetcher(`${apiBaseUrl}/admin/bots/trusted-implementations`, {
      credentials: 'include',
      cache: 'no-store',
      signal,
    });
    if (!response.ok) return unavailable(response);
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.implementations)) return unavailable(response);
    const implementations: PlatformTrustedImplementation[] = [];
    for (const item of payload.implementations) {
      if (!isRecord(item) || !isNonEmptyString(item.implementationKey)) return unavailable(response);
      implementations.push({ implementationKey: item.implementationKey });
    }
    return { ok: true, value: implementations };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE', requestId: undefined };
  }
}

export async function createBotDefinition(
  input: { readonly definitionKey: string; readonly name: string; readonly description: string | null },
  fetcher: PlatformAdminFetch = fetch,
  apiBaseUrl = configuredApiBaseUrl(),
): Promise<PlatformBotDefinitionCreationResult> {
  try {
    const csrfToken = await requestCsrfToken(fetcher, apiBaseUrl);
    if (csrfToken === undefined) return { ok: false, issue: 'UNAVAILABLE', code: undefined, requestId: undefined };
    const response = await fetcher(`${apiBaseUrl}/admin/bots/definitions`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-csrf-token': csrfToken, 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const code = await extractErrorCode(response);
      return { ok: false, issue: mutationIssue(response.status), code, requestId: requestIdFrom(response) };
    }
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !isRecord(payload.definition) || !isNonEmptyString(payload.definition.id)) {
      return { ok: false, issue: 'UNAVAILABLE', code: undefined, requestId: requestIdFrom(response) };
    }
    return { ok: true, definitionId: payload.definition.id };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE', code: undefined, requestId: undefined };
  }
}

export async function createBotVersion(
  botDefinitionId: string,
  input: { readonly version: string; readonly implementationKey: string; readonly configurationSchema: null },
  fetcher: PlatformAdminFetch = fetch,
  apiBaseUrl = configuredApiBaseUrl(),
): Promise<PlatformBotVersionCreationResult> {
  try {
    const csrfToken = await requestCsrfToken(fetcher, apiBaseUrl);
    if (csrfToken === undefined) return { ok: false, issue: 'UNAVAILABLE', code: undefined, requestId: undefined };
    const response = await fetcher(`${apiBaseUrl}/admin/bots/definitions/${encodeURIComponent(botDefinitionId)}/versions`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-csrf-token': csrfToken, 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const code = await extractErrorCode(response);
      return { ok: false, issue: mutationIssue(response.status), code, requestId: requestIdFrom(response) };
    }
    return { ok: true };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE', code: undefined, requestId: undefined };
  }
}

async function mutateBotAdministration(
  path: string,
  init: Pick<RequestInit, 'method' | 'body'>,
  fetcher: PlatformAdminFetch,
  apiBaseUrl: string,
): Promise<PlatformBotMutationResult> {
  try {
    const csrfToken = await requestCsrfToken(fetcher, apiBaseUrl);
    if (csrfToken === undefined) return { ok: false, issue: 'UNAVAILABLE', requestId: undefined };
    const response = await fetcher(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'x-csrf-token': csrfToken,
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
    });
    return response.ok
      ? { ok: true }
      : { ok: false, issue: mutationIssue(response.status), requestId: requestIdFrom(response) };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE', requestId: undefined };
  }
}

async function requestCsrfToken(fetcher: PlatformAdminFetch, apiBaseUrl: string): Promise<string | undefined> {
  const response = await fetcher(`${apiBaseUrl}/auth/csrf`, { credentials: 'include' });
  if (!response.ok) return undefined;
  const payload: unknown = await response.json();
  return isRecord(payload) && isNonEmptyString(payload.csrfToken) ? payload.csrfToken : undefined;
}

function catalogueFromPayload(value: unknown): readonly PlatformBotCatalogueDefinition[] | undefined {
  if (!isRecord(value) || !Array.isArray(value.definitions)) return undefined;
  const definitions = value.definitions.map(catalogueDefinitionFromPayload);
  return definitions.every((definition): definition is PlatformBotCatalogueDefinition => definition !== undefined) ? definitions : undefined;
}

function catalogueDefinitionFromPayload(value: unknown): PlatformBotCatalogueDefinition | undefined {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.name) || !isNullableString(value.description) ||
    !isDefinitionStatus(value.status) || !isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt) || !Array.isArray(value.versions)) return undefined;
  const versions = value.versions.map(catalogueVersionFromPayload);
  if (!versions.every((version): version is PlatformBotCatalogueVersion => version !== undefined)) return undefined;
  return { id: value.id, name: value.name, description: value.description, status: value.status, createdAt: value.createdAt, updatedAt: value.updatedAt, versions };
}

function catalogueVersionFromPayload(value: unknown): PlatformBotCatalogueVersion | undefined {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.version) || !isVersionStatus(value.status) ||
    !isNonEmptyString(value.implementationKey) || !isNullableRecord(value.configurationSchema) || !isIsoDate(value.publishedAt) || !isIsoDate(value.createdAt)) return undefined;
  return {
    id: value.id,
    version: value.version,
    status: value.status,
    implementationKey: value.implementationKey,
    configurationSchema: value.configurationSchema,
    publishedAt: value.publishedAt,
    createdAt: value.createdAt,
  };
}

function deploymentsPageFromPayload(value: unknown): PlatformBotDeploymentsPage | undefined {
  if (!isRecord(value) || !Array.isArray(value.deployments) || !isNonNegativeInteger(value.total) || !isPositiveInteger(value.page) || !isPositiveInteger(value.pageSize)) return undefined;
  const deployments = value.deployments.map(deploymentFromPayload);
  return deployments.every((deployment): deployment is PlatformBotDeployment => deployment !== undefined)
    ? { deployments, total: value.total, page: value.page, pageSize: value.pageSize }
    : undefined;
}

function deploymentFromPayload(value: unknown): PlatformBotDeployment | undefined {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isDeploymentStatus(value.status) || !isNullableIsoDate(value.activatedAt) ||
    !isNullableIsoDate(value.deactivatedAt) || !isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt) || !isRecord(value.business) ||
    !isRecord(value.whatsappConnection) || !isRecord(value.bot) || !isRecord(value.version) || !isRecord(value.publication)) return undefined;
  const business = businessFromPayload(value.business);
  const whatsappConnection = whatsappConnectionFromPayload(value.whatsappConnection);
  const bot = botFromPayload(value.bot);
  const version = deploymentVersionFromPayload(value.version);
  const publication = publicationFromPayload(value.publication);
  if (business === undefined || whatsappConnection === undefined || bot === undefined || version === undefined || publication === undefined) return undefined;
  return {
    id: value.id,
    status: value.status,
    activatedAt: value.activatedAt,
    deactivatedAt: value.deactivatedAt,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    business,
    whatsappConnection,
    bot,
    version,
    publication,
  };
}

function businessFromPayload(value: Record<string, unknown>): PlatformBotDeployment['business'] | undefined {
  return isNonEmptyString(value.id) && isNonEmptyString(value.name) && isBusinessStatus(value.status)
    ? { id: value.id, name: value.name, status: value.status }
    : undefined;
}

function whatsappConnectionFromPayload(value: Record<string, unknown>): PlatformBotDeployment['whatsappConnection'] | undefined {
  return isNonEmptyString(value.id) && isNonEmptyString(value.organizationId) && value.provider === 'META' && isNullableString(value.displayPhoneNumber) &&
    isWhatsAppConnectionStatus(value.status) && isNullableVerificationStatus(value.verificationStatus)
    ? { id: value.id, organizationId: value.organizationId, displayPhoneNumber: value.displayPhoneNumber, provider: value.provider, status: value.status, verificationStatus: value.verificationStatus }
    : undefined;
}

function botFromPayload(value: Record<string, unknown>): PlatformBotDeployment['bot'] | undefined {
  return isNonEmptyString(value.definitionId) && isNonEmptyString(value.name)
    ? { definitionId: value.definitionId, name: value.name }
    : undefined;
}

function deploymentVersionFromPayload(value: Record<string, unknown>): PlatformBotDeployment['version'] | undefined {
  return isNonEmptyString(value.id) && isNonEmptyString(value.version) && isNonEmptyString(value.implementationKey)
    ? { id: value.id, version: value.version, implementationKey: value.implementationKey }
    : undefined;
}

function publicationFromPayload(value: Record<string, unknown>): PlatformBotDeployment['publication'] | undefined {
  return isPublicationStatus(value.status) ? { status: value.status } : undefined;
}

function unavailable(response: Response): PlatformBotReadResult<never> {
  return { ok: false, issue: 'UNAVAILABLE', requestId: requestIdFrom(response) };
}

function mutationIssue(status: number): PlatformBotRequestIssue {
  if (status === 400) return 'INVALID';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 401 || status === 403) return 'FORBIDDEN';
  return 'UNAVAILABLE';
}

function requestIdFrom(response: Response): string | undefined {
  const requestId = response.headers.get('x-request-id') ?? response.headers.get('x-correlation-id');
  return requestId === null || requestId.trim() === '' ? undefined : requestId;
}

async function extractErrorCode(response: Response): Promise<string | undefined> {
  try {
    const payload: unknown = await response.json();
    return isRecord(payload) && isNonEmptyString(payload.code) ? payload.code : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableRecord(value: unknown): value is Record<string, unknown> | null {
  return value === null || isRecord(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isNonEmptyString(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isNullableIsoDate(value: unknown): value is string | null {
  return value === null || isIsoDate(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isBusinessStatus(value: unknown): value is PlatformBusinessStatus {
  return value === 'ACTIVE' || value === 'SUSPENDED';
}

function isWhatsAppConnectionStatus(value: unknown): value is PlatformWhatsAppConnectionStatus {
  return value === 'PENDING' || value === 'VERIFYING' || value === 'CONNECTED' || value === 'FAILED' || value === 'DISCONNECTED' || value === 'NEEDS_REAUTH' || value === 'CONFLICT';
}

function isNullableVerificationStatus(value: unknown): value is PlatformWhatsAppConnectionVerificationStatus | null {
  return value === null || value === 'VERIFIED' || value === 'CHECK_FAILED';
}

function isDeploymentStatus(value: unknown): value is PlatformBotDeploymentStatus {
  return typeof value === 'string' && deploymentStatuses.includes(value as PlatformBotDeploymentStatus);
}

function isPublicationStatus(value: unknown): value is PlatformBotPublicationStatus {
  return typeof value === 'string' && publicationStatuses.includes(value as PlatformBotPublicationStatus);
}

function isDefinitionStatus(value: unknown): value is PlatformBotDefinitionStatus {
  return typeof value === 'string' && definitionStatuses.includes(value as PlatformBotDefinitionStatus);
}

function isVersionStatus(value: unknown): value is PlatformBotVersionStatus {
  return typeof value === 'string' && versionStatuses.includes(value as PlatformBotVersionStatus);
}

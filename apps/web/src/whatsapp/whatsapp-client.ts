import { configuredApiBaseUrl } from '@/src/auth/auth-client';

type WhatsAppFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type WhatsAppConnectionStatus = 'PENDING' | 'VERIFYING' | 'CONNECTED' | 'FAILED' | 'DISCONNECTED' | 'NEEDS_REAUTH' | 'CONFLICT';

export interface WhatsAppConnection {
  readonly id: string;
  readonly provider: 'META';
  readonly connectionSource: 'EXISTING_BUSINESS_APP' | 'NEW_NUMBER' | 'EXISTING_PLATFORM';
  readonly connectionStatus: WhatsAppConnectionStatus;
  readonly displayPhoneNumber: string | null;
  readonly verificationStatus: 'VERIFIED' | 'CHECK_FAILED' | null;
  readonly lastVerifiedAt: string | null;
}

export interface MetaEmbeddedSignupPublicConfig {
  readonly appId: string;
  readonly embeddedSignupConfigurationId: string;
  readonly graphApiVersion: string;
}

export interface StartedWhatsAppOnboarding {
  readonly transactionId: string;
  readonly expiresAt: string;
  readonly meta: MetaEmbeddedSignupPublicConfig;
}

export type WhatsAppConnectionReadResult =
  | { readonly ok: true; readonly connection: WhatsAppConnection | null }
  | { readonly ok: false };

export type WhatsAppOnboardingStartResult =
  | { readonly ok: true; readonly onboarding: StartedWhatsAppOnboarding }
  | { readonly ok: false };

export type WhatsAppOnboardingCompletionResult =
  | { readonly ok: true; readonly connection: WhatsAppConnection }
  | {
    readonly ok: false;
    readonly issue: WhatsAppOnboardingCompletionIssue;
    readonly httpStatus: number | undefined;
  };

export type WhatsAppOnboardingCompletionIssue =
  | 'META_AUTHORIZATION_CODE_EXCHANGE_FAILED'
  | 'META_PHONE_OWNERSHIP_VERIFICATION_FAILED'
  | 'WHATSAPP_CONNECTION_PERSISTENCE_FAILED'
  | 'WHATSAPP_ONBOARDING_COMPLETION_UNAVAILABLE'
  | 'META_ONBOARDING_NOT_CONFIGURED'
  | 'UNAVAILABLE';

export async function getWhatsAppConnection(
  organizationId: string,
  fetcher: WhatsAppFetch = fetch,
  apiBaseUrl = configuredApiBaseUrl(),
  signal?: AbortSignal,
): Promise<WhatsAppConnectionReadResult> {
  try {
    const response = await fetcher(connectionUrl(apiBaseUrl, organizationId), {
      credentials: 'include',
      cache: 'no-store',
      signal,
    });
    if (response.status === 404) return { ok: true, connection: null };
    if (!response.ok) return { ok: false };
    const payload: unknown = await response.json();
    return isConnectionEnvelope(payload)
      ? { ok: true, connection: payload.connection }
      : { ok: false };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return { ok: false };
  }
}

export async function validateWhatsAppConnection(
  organizationId: string,
  fetcher: WhatsAppFetch = fetch,
  apiBaseUrl = configuredApiBaseUrl(),
): Promise<WhatsAppConnectionReadResult> {
  try {
    const csrf = await requestCsrfToken(fetcher, apiBaseUrl);
    if (csrf === undefined) return { ok: false };
    const response = await fetcher(`${connectionUrl(apiBaseUrl, organizationId)}/validate`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-csrf-token': csrf },
    });
    if (!response.ok) return { ok: false };
    const payload: unknown = await response.json();
    return isConnectionEnvelope(payload)
      ? { ok: true, connection: payload.connection }
      : { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function startWhatsAppOnboarding(
  organizationId: string,
  fetcher: WhatsAppFetch = fetch,
  apiBaseUrl = configuredApiBaseUrl(),
): Promise<WhatsAppOnboardingStartResult> {
  try {
    const csrf = await requestCsrfToken(fetcher, apiBaseUrl);
    if (csrf === undefined) return { ok: false };
    const response = await fetcher(`${connectionUrl(apiBaseUrl, organizationId)}/onboarding`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrf,
      },
      body: JSON.stringify({ source: 'EXISTING_BUSINESS_APP' }),
    });
    if (!response.ok) return { ok: false };
    const payload: unknown = await response.json();
    if (!isStartEnvelope(payload)) return { ok: false };
    return {
      ok: true,
      onboarding: {
        transactionId: payload.onboarding.transactionId,
        expiresAt: payload.onboarding.expiresAt,
        meta: payload.meta,
      },
    };
  } catch {
    return { ok: false };
  }
}

export async function completeWhatsAppOnboarding(
  organizationId: string,
  transactionId: string,
  input: {
    readonly authorizationCode: string;
    readonly phoneNumberId: string;
    readonly whatsappBusinessAccountId: string;
  },
  fetcher: WhatsAppFetch = fetch,
  apiBaseUrl = configuredApiBaseUrl(),
): Promise<WhatsAppOnboardingCompletionResult> {
  try {
    const csrf = await requestCsrfToken(fetcher, apiBaseUrl);
    if (csrf === undefined) return { ok: false, issue: 'UNAVAILABLE', httpStatus: undefined };
    logWhatsAppCompletion('Completion POST invoked', {
      authorizationCodePresent: input.authorizationCode.length > 0,
      whatsappBusinessAccountIdPresent: input.whatsappBusinessAccountId.length > 0,
      phoneNumberIdPresent: input.phoneNumberId.length > 0,
    });
    const response = await fetcher(
      `${connectionUrl(apiBaseUrl, organizationId)}/onboarding/${encodeURIComponent(transactionId)}/complete`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': csrf,
        },
        body: JSON.stringify(input),
      },
    );
    if (!response.ok) return { ok: false, issue: await completionIssueFromResponse(response), httpStatus: response.status };
    const payload: unknown = await response.json();
    return isConnectionEnvelope(payload)
      ? { ok: true, connection: payload.connection }
      : { ok: false, issue: 'UNAVAILABLE', httpStatus: response.status };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE', httpStatus: undefined };
  }
}

function connectionUrl(apiBaseUrl: string, organizationId: string): string {
  return `${apiBaseUrl}/organizations/${encodeURIComponent(organizationId)}/whatsapp-connection`;
}

async function requestCsrfToken(fetcher: WhatsAppFetch, apiBaseUrl: string): Promise<string | undefined> {
  const response = await fetcher(`${apiBaseUrl}/auth/csrf`, { credentials: 'include' });
  if (!response.ok) return undefined;
  const payload: unknown = await response.json();
  return typeof payload === 'object' && payload !== null && 'csrfToken' in payload && typeof payload.csrfToken === 'string'
    ? payload.csrfToken
    : undefined;
}

async function completionIssueFromResponse(response: Response): Promise<WhatsAppOnboardingCompletionIssue> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload !== 'object' || payload === null || !('error' in payload)) return 'UNAVAILABLE';
    const error = payload.error;
    if (typeof error !== 'object' || error === null || !('code' in error)) return 'UNAVAILABLE';
    return isCompletionIssue(error.code) ? error.code : 'UNAVAILABLE';
  } catch {
    return 'UNAVAILABLE';
  }
}

function isCompletionIssue(value: unknown): value is Exclude<WhatsAppOnboardingCompletionIssue, 'UNAVAILABLE'> {
  return value === 'META_AUTHORIZATION_CODE_EXCHANGE_FAILED'
    || value === 'META_PHONE_OWNERSHIP_VERIFICATION_FAILED'
    || value === 'WHATSAPP_CONNECTION_PERSISTENCE_FAILED'
    || value === 'WHATSAPP_ONBOARDING_COMPLETION_UNAVAILABLE'
    || value === 'META_ONBOARDING_NOT_CONFIGURED';
}

/** Development-only diagnostics deliberately contain presence flags, never provider values. */
function logWhatsAppCompletion(message: string, detail: Readonly<Record<string, boolean>>): void {
  if (process.env.NODE_ENV !== 'production') console.info(`[WhatsApp onboarding] ${message}`, detail);
}

function isConnectionEnvelope(value: unknown): value is { readonly connection: WhatsAppConnection } {
  if (typeof value !== 'object' || value === null || !('connection' in value)) return false;
  const connection = value.connection;
  return typeof connection === 'object' && connection !== null
    && 'id' in connection && typeof connection.id === 'string'
    && 'provider' in connection && connection.provider === 'META'
    && 'connectionSource' in connection && isConnectionSource(connection.connectionSource)
    && 'connectionStatus' in connection && isConnectionStatus(connection.connectionStatus)
    && 'displayPhoneNumber' in connection
    && (connection.displayPhoneNumber === null || typeof connection.displayPhoneNumber === 'string')
    && 'verificationStatus' in connection
    && (connection.verificationStatus === null || connection.verificationStatus === 'VERIFIED' || connection.verificationStatus === 'CHECK_FAILED')
    && 'lastVerifiedAt' in connection
    && (connection.lastVerifiedAt === null || typeof connection.lastVerifiedAt === 'string');
}

function isStartEnvelope(value: unknown): value is {
  readonly onboarding: { readonly transactionId: string; readonly provider: 'META'; readonly source: 'EXISTING_BUSINESS_APP'; readonly expiresAt: string };
  readonly meta: MetaEmbeddedSignupPublicConfig;
} {
  if (typeof value !== 'object' || value === null || !('onboarding' in value) || !('meta' in value)) return false;
  const onboarding = value.onboarding;
  const meta = value.meta;
  return typeof onboarding === 'object' && onboarding !== null
    && 'transactionId' in onboarding && typeof onboarding.transactionId === 'string'
    && 'provider' in onboarding && onboarding.provider === 'META'
    && 'source' in onboarding && onboarding.source === 'EXISTING_BUSINESS_APP'
    && 'expiresAt' in onboarding && typeof onboarding.expiresAt === 'string'
    && typeof meta === 'object' && meta !== null
    && 'appId' in meta && typeof meta.appId === 'string'
    && 'embeddedSignupConfigurationId' in meta && typeof meta.embeddedSignupConfigurationId === 'string'
    && 'graphApiVersion' in meta && typeof meta.graphApiVersion === 'string';
}

function isConnectionSource(value: unknown): value is WhatsAppConnection['connectionSource'] {
  return value === 'EXISTING_BUSINESS_APP' || value === 'NEW_NUMBER' || value === 'EXISTING_PLATFORM';
}

function isConnectionStatus(value: unknown): value is WhatsAppConnectionStatus {
  return value === 'PENDING'
    || value === 'VERIFYING'
    || value === 'CONNECTED'
    || value === 'FAILED'
    || value === 'DISCONNECTED'
    || value === 'NEEDS_REAUTH'
    || value === 'CONFLICT';
}

import { configuredApiBaseUrl } from '@/src/auth/auth-client';

type NotificationSettingsFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface BusinessNotificationSettings {
  readonly handoverTeamId: string | null;
  readonly fallbackEmailAddresses: readonly string[];
  readonly emailNotificationsEnabled: boolean;
}

/** The Business-level fallback destination used by the handover notification service. */
export async function getBusinessNotificationSettings(
  organizationId: string,
  fetcher: NotificationSettingsFetch = fetch,
): Promise<BusinessNotificationSettings | undefined> {
  try {
    const response = await fetcher(`${configuredApiBaseUrl()}/organizations/${encodeURIComponent(organizationId)}/notification-settings`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!response.ok) return undefined;
    return notificationSettingsFromPayload(await response.json());
  } catch {
    return undefined;
  }
}

export async function saveBusinessNotificationSettings(
  organizationId: string,
  settings: BusinessNotificationSettings,
  fetcher: NotificationSettingsFetch = fetch,
): Promise<BusinessNotificationSettings | undefined> {
  try {
    const csrfToken = await requestCsrfToken(fetcher);
    if (csrfToken === undefined) return undefined;
    const response = await fetcher(`${configuredApiBaseUrl()}/organizations/${encodeURIComponent(organizationId)}/notification-settings`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify(settings),
    });
    if (!response.ok) return undefined;
    return notificationSettingsFromPayload(await response.json());
  } catch {
    return undefined;
  }
}

async function requestCsrfToken(fetcher: NotificationSettingsFetch): Promise<string | undefined> {
  const response = await fetcher(`${configuredApiBaseUrl()}/auth/csrf`, { credentials: 'include' });
  if (!response.ok) return undefined;
  const payload: unknown = await response.json();
  return typeof payload === 'object' && payload !== null && 'csrfToken' in payload && typeof payload.csrfToken === 'string'
    ? payload.csrfToken
    : undefined;
}

function notificationSettingsFromPayload(value: unknown): BusinessNotificationSettings | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  if (!('handoverTeamId' in value) || !('fallbackEmailAddresses' in value) || !('emailNotificationsEnabled' in value)) return undefined;
  const handoverTeamId = value.handoverTeamId;
  const fallbackEmailAddresses = value.fallbackEmailAddresses;
  const emailNotificationsEnabled = value.emailNotificationsEnabled;
  if (!isNullableString(handoverTeamId)) return undefined;
  if (!isStringArray(fallbackEmailAddresses)) return undefined;
  if (typeof emailNotificationsEnabled !== 'boolean') return undefined;
  return {
    handoverTeamId,
    fallbackEmailAddresses,
    emailNotificationsEnabled,
  };
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

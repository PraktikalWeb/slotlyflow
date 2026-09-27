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
  if ((value.handoverTeamId !== null && typeof value.handoverTeamId !== 'string') || !Array.isArray(value.fallbackEmailAddresses) || typeof value.emailNotificationsEnabled !== 'boolean') return undefined;
  if (!value.fallbackEmailAddresses.every((address) => typeof address === 'string')) return undefined;
  return {
    handoverTeamId: value.handoverTeamId,
    fallbackEmailAddresses: value.fallbackEmailAddresses,
    emailNotificationsEnabled: value.emailNotificationsEnabled,
  };
}

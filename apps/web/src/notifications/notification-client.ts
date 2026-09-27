import { configuredApiBaseUrl } from '@/src/auth/auth-client';

type NotificationFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface DashboardNotification {
  readonly id: string;
  readonly type: 'HANDOVER_ASSIGNED';
  readonly resourceType: 'CONVERSATION';
  readonly resourceId: string;
  readonly title: string;
  readonly body: string;
  readonly readAt: string | null;
  readonly createdAt: string;
}

export async function getDashboardNotifications(organizationId: string, fetcher: NotificationFetch = fetch): Promise<readonly DashboardNotification[] | undefined> {
  try {
    const response = await fetcher(`${configuredApiBaseUrl()}/organizations/${encodeURIComponent(organizationId)}/notifications`, {
      credentials: 'include', cache: 'no-store',
    });
    if (!response.ok) return undefined;
    const payload: unknown = await response.json();
    return notificationsFromPayload(payload);
  } catch {
    return undefined;
  }
}

export async function getUnreadNotificationCount(organizationId: string, fetcher: NotificationFetch = fetch): Promise<number | undefined> {
  try {
    const response = await fetcher(`${configuredApiBaseUrl()}/organizations/${encodeURIComponent(organizationId)}/notifications/unread-count`, {
      credentials: 'include', cache: 'no-store',
    });
    if (!response.ok) return undefined;
    const payload: unknown = await response.json();
    return typeof payload === 'object' && payload !== null && 'count' in payload && typeof payload.count === 'number'
      ? payload.count
      : undefined;
  } catch {
    return undefined;
  }
}

export async function markDashboardNotificationRead(organizationId: string, notificationId: string, fetcher: NotificationFetch = fetch): Promise<boolean> {
  try {
    const csrf = await csrfToken(fetcher);
    if (csrf === undefined) return false;
    const response = await fetcher(`${configuredApiBaseUrl()}/organizations/${encodeURIComponent(organizationId)}/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'POST', credentials: 'include', headers: { 'x-csrf-token': csrf },
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function csrfToken(fetcher: NotificationFetch): Promise<string | undefined> {
  const response = await fetcher(`${configuredApiBaseUrl()}/auth/csrf`, { credentials: 'include' });
  if (!response.ok) return undefined;
  const payload: unknown = await response.json();
  return typeof payload === 'object' && payload !== null && 'csrfToken' in payload && typeof payload.csrfToken === 'string'
    ? payload.csrfToken
    : undefined;
}

function notificationsFromPayload(value: unknown): readonly DashboardNotification[] | undefined {
  if (typeof value !== 'object' || value === null || !('notifications' in value) || !Array.isArray(value.notifications)) return undefined;
  const notifications: DashboardNotification[] = [];
  for (const notification of value.notifications) {
    if (!isDashboardNotification(notification)) return undefined;
    notifications.push(notification);
  }
  return notifications;
}

function isDashboardNotification(value: unknown): value is DashboardNotification {
  return typeof value === 'object' && value !== null
    && 'id' in value && typeof value.id === 'string'
    && 'type' in value && value.type === 'HANDOVER_ASSIGNED'
    && 'resourceType' in value && value.resourceType === 'CONVERSATION'
    && 'resourceId' in value && typeof value.resourceId === 'string'
    && 'title' in value && typeof value.title === 'string'
    && 'body' in value && typeof value.body === 'string'
    && 'readAt' in value && (value.readAt === null || typeof value.readAt === 'string')
    && 'createdAt' in value && typeof value.createdAt === 'string';
}

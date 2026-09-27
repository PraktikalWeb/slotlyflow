import { configuredApiBaseUrl } from '@/src/auth/auth-client';

type BotPublicationFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type BotPublicationStatus = 'PUBLISHED' | 'UNPUBLISHED' | 'NOT_CONFIGURED';

export interface BotPublication {
  readonly status: BotPublicationStatus;
}

/** Reads only safe, Business-derived publication state. */
export async function getBotPublication(
  organizationId: string,
  fetcher: BotPublicationFetch = fetch,
): Promise<BotPublication | undefined> {
  try {
    const response = await fetcher(`${configuredApiBaseUrl()}/organizations/${encodeURIComponent(organizationId)}/automation/publication`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!response.ok) return undefined;
    return publicationFromPayload(await response.json());
  } catch {
    return undefined;
  }
}

/** The body carries only the desired publication state, never deployment identity. */
export async function saveBotPublication(
  organizationId: string,
  published: boolean,
  fetcher: BotPublicationFetch = fetch,
): Promise<BotPublication | undefined> {
  try {
    const csrfToken = await requestCsrfToken(fetcher);
    if (csrfToken === undefined) return undefined;
    const response = await fetcher(`${configuredApiBaseUrl()}/organizations/${encodeURIComponent(organizationId)}/automation/publication`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ published }),
    });
    if (!response.ok) return undefined;
    return publicationFromPayload(await response.json());
  } catch {
    return undefined;
  }
}

async function requestCsrfToken(fetcher: BotPublicationFetch): Promise<string | undefined> {
  const response = await fetcher(`${configuredApiBaseUrl()}/auth/csrf`, { credentials: 'include' });
  if (!response.ok) return undefined;
  const payload: unknown = await response.json();
  return typeof payload === 'object' && payload !== null && 'csrfToken' in payload && typeof payload.csrfToken === 'string'
    ? payload.csrfToken
    : undefined;
}

function publicationFromPayload(value: unknown): BotPublication | undefined {
  if (typeof value !== 'object' || value === null || !('status' in value)) return undefined;
  return value.status === 'PUBLISHED' || value.status === 'UNPUBLISHED' || value.status === 'NOT_CONFIGURED'
    ? { status: value.status }
    : undefined;
}

import { parsePublicApiBaseUrl } from '@/src/config/public-environment';

export type ServerSessionStatus = 'authenticated' | 'unauthenticated' | 'unavailable';

interface ServerSessionOptions {
  readonly endpoint: '/auth/me' | '/admin/me';
  readonly sessionToken: string | undefined;
}

/**
 * Resolves only the server-owned opaque session through the API. It never
 * decodes or exposes session material to client components.
 */
export async function resolveServerSession({ endpoint, sessionToken }: ServerSessionOptions): Promise<ServerSessionStatus> {
  if (sessionToken === undefined || sessionToken === '') return 'unauthenticated';

  const apiBaseUrl = parsePublicApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
  const cookieName = process.env.AUTH_SESSION_COOKIE_NAME ?? 'slotlyflow_session';

  try {
    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
      cache: 'no-store',
      headers: { cookie: `${cookieName}=${sessionToken}` },
    });
    if (response.ok) return 'authenticated';
    if (response.status === 401 || response.status === 403) return 'unauthenticated';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

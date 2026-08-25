const requiredApiBaseUrlMessage =
  'NEXT_PUBLIC_API_BASE_URL is required and must be an absolute HTTP(S) URL, for example http://localhost:3001.';

export function parsePublicApiBaseUrl(value: string | undefined): string {
  if (value === undefined || value.trim() === '') {
    throw new Error(requiredApiBaseUrlMessage);
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(requiredApiBaseUrlMessage);
  }

  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    throw new Error(requiredApiBaseUrlMessage);
  }

  return parsed.toString().replace(/\/$/, '');
}

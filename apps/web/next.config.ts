import type { NextConfig } from 'next';

import { parsePublicApiBaseUrl } from './src/config/public-environment';

const publicApiBaseUrl = parsePublicApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
const developmentApiProxyTarget = parseDevelopmentApiProxyTarget(
  process.env.SLOTLYFLOW_DEV_API_PROXY_TARGET,
  process.env.NODE_ENV,
);
const developmentSameOriginApiProxyTarget = process.env.NODE_ENV === 'production'
  ? undefined
  : developmentApiProxyTarget ?? parseDevelopmentApiProxyTarget(publicApiBaseUrl, process.env.NODE_ENV);

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_BASE_URL: publicApiBaseUrl,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async rewrites() {
    return developmentSameOriginApiProxyTarget === undefined
      ? []
      // The API owns routes at its root; `/api` is only the browser-facing marker.
      : [{ source: '/api/:path*', destination: `${developmentSameOriginApiProxyTarget}/:path*` }];
  },
};

export default nextConfig;

/** Development-only reverse proxy target validation for local HTTPS browser testing. */
function parseDevelopmentApiProxyTarget(
  value: string | undefined,
  nodeEnvironment: string | undefined,
): string | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  if (nodeEnvironment === 'production') {
    throw new Error('SLOTLYFLOW_DEV_API_PROXY_TARGET is development-only.');
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('SLOTLYFLOW_DEV_API_PROXY_TARGET must be an absolute loopback HTTP URL.');
  }

  const loopbackHost = parsed.hostname === 'localhost'
    || parsed.hostname === '127.0.0.1'
    || parsed.hostname === '[::1]';
  if (
    parsed.protocol !== 'http:'
    || !loopbackHost
    || parsed.username !== ''
    || parsed.password !== ''
    || (parsed.pathname !== '' && parsed.pathname !== '/')
    || parsed.search !== ''
    || parsed.hash !== ''
  ) {
    throw new Error('SLOTLYFLOW_DEV_API_PROXY_TARGET must be an absolute loopback HTTP URL.');
  }

  return parsed.origin;
}

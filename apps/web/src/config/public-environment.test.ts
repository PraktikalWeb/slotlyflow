import { describe, expect, it } from 'vitest';

import { parsePublicApiBaseUrl } from './public-environment';

describe('parsePublicApiBaseUrl', () => {
  it('normalizes an absolute HTTP(S) API base URL', () => {
    expect(parsePublicApiBaseUrl('http://localhost:3001/')).toBe('http://localhost:3001');
    expect(parsePublicApiBaseUrl('https://api.example.test/v1/')).toBe('https://api.example.test/v1');
  });

  it.each([undefined, '', '/api', 'ftp://localhost:3001', 'http://user:password@localhost:3001', 'http://localhost:3001?unsafe=true'])(
    'rejects missing or unsafe public API configuration: %s',
    (value) => {
      expect(() => parsePublicApiBaseUrl(value)).toThrow('NEXT_PUBLIC_API_BASE_URL is required');
    },
  );
});

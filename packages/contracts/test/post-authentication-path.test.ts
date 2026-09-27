import { describe, expect, it } from 'vitest';

import { defaultPostAuthenticationPath, safePostAuthenticationPath } from '../src/index.js';

describe('safePostAuthenticationPath', () => {
  it('preserves a dashboard destination, including its search and fragment', () => {
    expect(safePostAuthenticationPath('/dashboard')).toBe('/dashboard');
    expect(safePostAuthenticationPath('/dashboard/connect?source=setup#step-1')).toBe('/dashboard/connect?source=setup#step-1');
  });

  it.each([
    undefined,
    '',
    '/',
    '/sign-in',
    'https://evil.example',
    '//evil.example',
    '/dashboard%2f%2fevil.example',
    '/dashboard/../sign-in',
  ])('rejects an unsafe return path: %s', (value) => {
    expect(safePostAuthenticationPath(value)).toBe(defaultPostAuthenticationPath);
  });
});

import { describe, expect, it } from 'vitest';

import { publicErrorMessage } from '../src/index.js';

describe('publicErrorMessage', () => {
  it('keeps controlled dependency failures generic without classifying them as unexpected', () => {
    expect(publicErrorMessage(503, 'DEPENDENCY_UNAVAILABLE')).toBe('The request could not be completed.');
  });

  it('retains the generic unexpected message for unclassified server failures', () => {
    expect(publicErrorMessage(500, 'INTERNAL_ERROR')).toBe('An unexpected error occurred.');
  });
});

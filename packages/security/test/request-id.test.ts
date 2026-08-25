import { describe, expect, it } from 'vitest';

import { isSafeRequestId } from '../src/index.js';

describe('isSafeRequestId', () => {
  it('accepts bounded identifier values and rejects unsafe input', () => {
    expect(isSafeRequestId('req-123.abc')).toBe(true);
    expect(isSafeRequestId('bad value')).toBe(false);
    expect(isSafeRequestId('x'.repeat(129))).toBe(false);
  });
});

const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function isSafeRequestId(value: unknown): value is string {
  return typeof value === 'string' && requestIdPattern.test(value);
}

export function publicErrorMessage(statusCode: number): string {
  if (statusCode >= 500) {
    return 'An unexpected error occurred.';
  }

  return 'The request could not be completed.';
}

# Error Handling

## Categories

- validation error;
- authentication error;
- authorization error;
- not found;
- conflict;
- rate limited;
- provider transient failure;
- provider permanent failure;
- infrastructure unavailable;
- internal invariant violation.

## Principles

- Client receives stable error code.
- Internal log receives correlation ID and diagnostic metadata.
- Sensitive details remain server-side.
- Retryability is explicit for async failures.
- Expected domain errors are not logged as unhandled exceptions.
